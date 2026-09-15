# 26 — Aceite de Termos de Uso e Política de Privacidade

## Motivação

O HortiFlow Produtor trata dado pessoal (nome, telefone, dados financeiros de uma parceria real entre sócios) e ainda não tem Termos de Uso nem Política de Privacidade — nem o texto, nem o fluxo de aceite, nem o registro de quem aceitou o quê. Isso expõe o produto legalmente: em caso de disputa entre sócios sobre o cálculo de divisão, ou de uma solicitação de dados via LGPD, não há hoje nenhum documento que delimite responsabilidade nem nenhum registro de consentimento.

As minutas dos textos (a serem revisadas por advogado antes de publicar) estão em `docs/legal/termos-de-uso.md` e `docs/legal/politica-de-privacidade.md`. Esta spec cobre só o **fluxo técnico de aceite** — tela, endpoint, modelo de dados e o que acontece quando os textos mudam de versão — não o conteúdo jurídico em si.

## Escopo

**Entra:**
- Modelo de dados para registrar aceite (usuário, versão de cada documento, data/hora), com **histórico preservado** — não sobrescrito a cada novo aceite
- Endpoint para consultar se o usuário logado está com aceite pendente (versão vigente diferente da última aceita)
- Endpoint para registrar o aceite
- Tela bloqueante de aceite no cadastro (web e mobile) — igual ao restante do fluxo de autenticação, sempre implementado nos dois clientes
- Tela bloqueante equivalente quando a versão de algum dos dois documentos muda e o usuário já tem conta (login não é o suficiente até ele aceitar de novo)
- Links para o usuário ler o Termos de Uso e a Política de Privacidade antes de aceitar
- Evento `ACEITE_TERMOS` em `EventoAuditoria` (spec 17), com a versão aceita nos metadados
- Versão dos documentos vigente é uma constante no código do backend (não precisa de painel admin nem tela de edição)

**Fica de fora:**
- O conteúdo jurídico dos textos em si (fica em `docs/legal/`, tratado fora desta spec)
- Aceite por sócio sem conta própria — como ele nunca loga, não há o que aceitar; a responsabilidade por ele é do titular que o cadastrou (cláusula 3 da minuta de Termos)
- Versionamento independente por idioma/região (produto é só PT-BR, sem previsão de internacionalização)
- Notificação proativa (push/e-mail) avisando que os termos mudaram — o usuário só vê a tela na próxima vez que abrir o app, igual ao padrão observado no concorrente Alô Meeiro

## Regras de negócio

1. **Duas versões independentes**: Termos de Uso e Política de Privacidade têm número de versão próprio (ex: `TERMOS_VERSAO_ATUAL = "1.0"`, `PRIVACIDADE_VERSAO_ATUAL = "1.0"`), porque um documento pode mudar sem o outro precisar de reaceite.
2. **Aceite é uma coisa só na UI, duas versões no banco**: como no app do concorrente, o usuário marca um único checkbox ("Li e concordo com os Termos de Uso e a Política de Privacidade") e isso grava um aceite para a versão vigente de **ambos** os documentos ao mesmo tempo — não existe aceitar um sem o outro.
3. **Cadastro novo**: `POST /auth/register` só cria a conta se o corpo da requisição confirmar o aceite (ex: `aceitouTermos: true`); sem isso, retorna erro de validação. O aceite é registrado no mesmo instante da criação do usuário.
4. **Usuário existente com nova versão**: a checagem de "aceite pendente" acontece do mesmo jeito que o bloqueio de conta (spec 16) — não só no login, mas em toda rota autenticada via `authMiddleware`, para que uma mudança de versão publicada com o usuário já logado também bloqueie a sessão em andamento. Diferente do bloqueio de conta, aqui o 401 tem um código específico (ex: `TERMOS_PENDENTES`) para o frontend/mobile saber que deve mostrar a tela de aceite, e não deslogar o usuário.
5. **Histórico nunca é sobrescrito**: cada aceite gera um novo registro (não um update no último) — se um dia houver disputa sobre "essa pessoa sabia que X ao aceitar", precisa dar pra provar exatamente qual texto (qual versão) ela aceitou e quando.
6. **Sem retroatividade**: publicar uma nova versão não apaga nem invalida o aceite de versões antigas — só passa a exigir um novo aceite pra continuar usando a partir daquele momento.
7. **Trilha de auditoria**: todo aceite registrado dispara um `EventoAuditoria` do tipo `ACEITE_TERMOS`, com `{ versaoTermos, versaoPrivacidade }` em `metadata`, seguindo o padrão já usado por outros eventos de conta (spec 17).

## Modelo de dados

Novo model, histórico (nunca atualizado in-place):

```prisma
model AceiteTermos {
  id                  String   @id @default(uuid())
  usuario_id          String
  versao_termos       String
  versao_privacidade  String
  aceito_em           DateTime @default(now())

  usuario Usuario @relation(fields: [usuario_id], references: [id])

  @@map("aceites_termos")
}
```

No `Usuario`, adicionar a relação reversa (`aceitesTermos AceiteTermos[]`). Não é necessário desnormalizar "última versão aceita" em campo separado — a consulta de status busca o registro mais recente por `usuario_id` (ordenado por `aceito_em desc`, limit 1) e compara com as constantes vigentes.

## Contrato de API

```
POST /auth/register
  Body: { nome, telefone, senha, aceitouTermos: true, ... campos já existentes }
  400: { error: "É necessário aceitar os Termos de Uso e a Política de Privacidade" } — aceitouTermos ausente ou false
  201: (comportamento atual) — e grava o primeiro AceiteTermos do usuário, com as versões vigentes no momento do cadastro

GET /termos/status   (autenticado)
  200: {
    pendente: boolean,
    versaoTermosAtual: string,
    versaoPrivacidadeAtual: string
  }
  # pendente = true quando não existe AceiteTermos do usuário com AMBAS as versões
  # (termos e privacidade) iguais às vigentes

POST /termos/aceite   (autenticado)
  200: { ok: true } — cria um novo AceiteTermos com as versões vigentes no momento da chamada,
                       e um EventoAuditoria do tipo ACEITE_TERMOS
  # idempotente: aceitar de novo quando já está em dia apenas cria outro registro de histórico,
  # sem erro

Qualquer rota autenticada (via authMiddleware), exceto GET /termos/status e POST /termos/aceite
  401: { error: "TERMOS_PENDENTES" } — quando o usuário tem aceite pendente (ver regra 4)
```

## Fluxo na UI (web e mobile)

- **Cadastro**: checkbox obrigatório "Li e concordo com os Termos de Uso e a Política de Privacidade", com os dois nomes como link (abre o texto correspondente, dentro do próprio app). Botão de criar conta desabilitado até marcar.
- **Login com aceite pendente**: após autenticar com sucesso, o app consulta `GET /termos/status`; se `pendente: true`, mostra tela bloqueante equivalente à do cadastro — mesmo checkbox único, mais um botão secundário "Sair da conta" (logout) para quem não quiser aceitar. Só depois do aceite (`POST /termos/aceite`) o usuário segue para a Home.
- Os textos completos (Termos de Uso e Política de Privacidade) ficam acessíveis a qualquer momento em Configurações, mesmo fora do fluxo de aceite.

## Critérios de aceite

1. Dado um cadastro sem marcar o aceite, quando o usuário envia o formulário, então o backend rejeita com 400 e a conta não é criada.
2. Dado um cadastro com o aceite marcado, quando a conta é criada, então existe um `AceiteTermos` gravado com as versões vigentes no momento e um `EventoAuditoria` do tipo `ACEITE_TERMOS`.
3. Dado um usuário já cadastrado, quando a versão de Termos ou de Privacidade é incrementada no backend e ele faz login ou usa uma rota autenticada, então recebe `TERMOS_PENDENTES` e o app mostra a tela de aceite, sem deslogar.
4. Dado um usuário com aceite pendente, quando ele aceita novamente, então `GET /termos/status` passa a retornar `pendente: false` e as rotas autenticadas voltam a funcionar normalmente.
5. Dado um usuário que já aceitou a versão vigente, quando aceita de novo (ex: reenvio acidental), então um novo registro de histórico é criado, sem erro.
6. Dado o histórico de aceites de um usuário, quando consultado (ex: via Prisma Studio, em caso de disputa), então é possível ver exatamente qual versão de cada documento ele aceitou e quando, para cada aceite já feito.
