# 17 — Observabilidade e auditoria

## Objetivo

Dar visibilidade real ao dono do SaaS sobre duas coisas que hoje são invisíveis em produção: **o que os usuários estão fazendo** (quem se cadastrou, logou, deslogou, teve a conta bloqueada) e **quando algo quebra** (erro técnico no backend ou crash no app mobile).

Motivação direta: ao investigar se as pessoas que o primo convidou para testar estavam realmente usando o app, a única fonte disponível foi consultar o banco de produção manualmente e ler logs HTTP crus do Railway — não existe hoje nenhum registro de evento de login/logout, e a checagem dos logs de aplicação revelou que **nenhum erro técnico fica registrado**: existe um error handler global no `app.ts`, mas como nenhum controller tem `try/catch` (nem existe `express-async-errors`), uma exceção lançada dentro de um controller assíncrono nunca chega até esse handler — ela vira uma promise rejeitada sem tratamento, que o Node não imprime de forma útil no console. Ou seja, se algo quebrar de verdade em produção hoje, ninguém fica sabendo.

Esta spec cobre a infraestrutura de captura (backend + mobile). A tela de dashboard web para consultar esses dados fica registrada como Fase 2 (ver "Fica de fora"), mas o desenho dos dados abaixo já é pensado para alimentá-la sem redesenho.

## Escopo

**Entra:**
- Correção do gap de captura de erro no backend: exceções assíncronas de controller passam a chegar até um error handler central (via wrapper de rota ou `express-async-errors`)
- Tabela própria no Postgres (`EventoAuditoria`) para eventos de negócio: conta criada, login, logout, conta bloqueada/desbloqueada — nada de serviço externo, é dado que o próprio dashboard futuro vai consultar
- Integração com **Sentry** (tier gratuito) para erros técnicos — backend (Node/Express) e mobile (Expo/React Native) — escolhido em vez de analytics de terceiro (Google Analytics/Firebase) porque o objetivo aqui é stack trace + agrupamento de exceção, não comportamento de uso; e em vez de solução 100% própria porque captura de crash mobile offline (guardar o erro no aparelho e reenviar quando a conexão voltar) já vem pronta no SDK
- No mobile, captura de erro/crash **mesmo offline**, reaproveitando o padrão de fila já existente (`sync_queue`/`registrarProcessador`, spec `mobile/00`) só que via a fila própria do SDK do Sentry (não precisa reinventar a fila — o SDK do Sentry para React Native já enfileira localmente e reenvia sozinho ao reconectar)
- Login/logout do mobile e do web passam a registrar evento em `EventoAuditoria` (mesma tabela, os dois clientes já falam com a mesma API)

**Fica de fora (Fase 2, não implementar nesta spec):**
- Tela de dashboard no app web para visualizar os eventos de auditoria e os erros do Sentry — implementar quando houver volume de usuários que justifique, usando os dados já estruturados por esta spec
- Registro de exclusão de conta em `EventoAuditoria` — hoje não existe funcionalidade de excluir conta no produto (nem pelo usuário, nem por admin); quando essa funcionalidade for especificada, ela emite o evento correspondente
- Auditoria de criação de despesa/venda/sociedade/acerto — esses registros já têm `criado_em` e (na maioria) o autor rastreado no próprio modelo de negócio (ver "Trilha de auditoria simples" no `CLAUDE.md`); não duplicar em `EventoAuditoria` a menos que uma necessidade concreta apareça
- Alertas automáticos (e-mail/push quando um erro novo acontece) — o Sentry free tier já manda e-mail por padrão nas configurações básicas dele; qualquer regra além disso (ex: Slack) fica para quando fizer falta
- Reescrever os controllers para usar `try/catch` individualmente — a correção do gap é um wrapper genérico, não uma mudança em cada controller

## Regras de negócio

### Captura de erro no backend
- Todas as rotas continuam declaradas como hoje (`async (req, res) => {...}`), mas passam a ser registradas através de um wrapper (`asyncHandler`) que captura a rejeição da promise e chama `next(err)` — sem precisar tocar em nenhum controller individualmente
- O error handler existente em `app.ts` (que já faz `console.error` e responde 500 genérico) ganha uma chamada a `Sentry.captureException(err)` antes de responder, mantendo o comportamento de resposta ao cliente inalterado
- Erros de validação (Zod) e erros de negócio esperados (409, 401, 404 tratados explicitamente pelo próprio controller com `res.status(...).json(...)`) **não** disparam captura no Sentry — só exceções não tratadas chegam até o wrapper. Isso evita que o Sentry vire ruído de "erro" para fluxo normal (ex: telefone já cadastrado)

### Captura de erro no mobile
- Sentry inicializado o mais cedo possível no bootstrap do app (antes do `AuthContext`/navegação), para capturar erro mesmo em telas iniciais
- Error Boundary do React (tela de fallback "Algo deu errado", sem detalhe técnico visível ao produtor) envolvendo a navegação principal, para que um crash de renderização não derrube o app inteiro sem explicação nenhuma na tela
- Erros de rede esperados (sem conexão, 401 que já aciona logout automático) **não** são capturados como exceção no Sentry — são comportamento normal do modo offline-first, já tratado pela UI (banner de conexão, spec `mobile/00`); só erro inesperado (ex: exceção de runtime, erro 500 vindo do backend) é reportado

### Auditoria de conta (`EventoAuditoria`)
- Eventos cobertos nesta spec: `CONTA_CRIADA`, `LOGIN`, `LOGOUT`, `CONTA_BLOQUEADA`, `CONTA_DESBLOQUEADA`
- Cada evento grava: usuário (quando aplicável — bloqueio/desbloqueio feito manualmente no banco, spec `16`, pode não ter um "autor" no sistema ainda, já que não existe painel admin), tipo do evento, timestamp, e um campo livre `metadata` (JSON) para contexto específico do evento (ex: IP/origem do login, se fizer sentido depois) sem precisar migração de schema a cada novo detalhe
- `LOGIN` é registrado após autenticação bem-sucedida (não em tentativa falha — tentativa falha já aparece nos logs HTTP como 401, não precisa duplicar)
- `LOGOUT` é registrado quando o cliente (web ou mobile) chama a ação de sair; login/logout automático por token expirado (401 que aciona deslogamento automático) também conta como `LOGOUT`, com `metadata` indicando que foi automático
- Gravação do evento **não pode bloquear ou atrasar** a resposta da ação principal (ex: se gravar o evento de login falhar por algum motivo, o login em si não pode falhar por causa disso) — grava de forma best-effort, erro na gravação do evento vai para o Sentry, não para o usuário

## Contrato de API

Nenhuma rota nova exposta ao frontend/mobile além do que já existe — os eventos são gravados como efeito colateral das rotas já existentes:

```
POST /auth/register  → já existe, passa a gravar CONTA_CRIADA
POST /auth/login      → já existe, passa a gravar LOGIN (só em caso de sucesso)
POST /auth/logout     → novo endpoint, só para registrar LOGOUT (o token já é
                         descartado localmente pelo cliente hoje; este endpoint
                         existe só para ter um ponto central de gravação de evento)
  200: { ok: true }
```

Bloqueio/desbloqueio de conta continua manual no banco (spec `16`) — ao fazer isso, quem operar deve também inserir a linha correspondente em `EventoAuditoria` manualmente (ou, se/quando existir painel admin, ele grava automaticamente).

## Modelo de dados (novo)

```prisma
model EventoAuditoria {
  id         String   @id @default(uuid())
  usuario_id String?
  tipo       String   // CONTA_CRIADA | LOGIN | LOGOUT | CONTA_BLOQUEADA | CONTA_DESBLOQUEADA
  metadata   Json?
  criado_em  DateTime @default(now())

  usuario Usuario? @relation(fields: [usuario_id], references: [id])

  @@index([usuario_id])
  @@index([tipo])
  @@map("eventos_auditoria")
}
```

## Critérios de aceite

1. Dado um controller assíncrono que lança uma exceção não tratada, a requisição recebe 500 (não trava, não derruba o processo) e o erro aparece no Sentry com stack trace
2. Dado um erro de validação normal (ex: cadastro com telefone duplicado, 409), ele **não** aparece como exceção no Sentry
3. Dado um cadastro bem-sucedido (`POST /auth/register`), uma linha `CONTA_CRIADA` é gravada em `EventoAuditoria`
4. Dado um login bem-sucedido (web ou mobile), uma linha `LOGIN` é gravada; dado um login com credencial errada, nenhuma linha é gravada
5. Dado logout manual (botão "Sair") no web ou no mobile, uma linha `LOGOUT` é gravada
6. Dado um token expirado que aciona logout automático, uma linha `LOGOUT` é gravada com `metadata` indicando que foi automático
7. Dado uma falha simulada na gravação do evento de auditoria, o login/cadastro/logout em si continua funcionando normalmente para o usuário
8. Dado o app mobile sem internet no momento de um crash, o erro é capturado localmente pelo Sentry e reenviado automaticamente quando a conexão volta, sem ação do produtor
9. Dado um erro de renderização em qualquer tela do mobile, o Error Boundary mostra uma tela de fallback genérica em vez do app fechar sozinho
10. Dado um 401 de sessão expirada (fluxo já existente de logout automático) no mobile ou no web, ele **não** aparece como exceção no Sentry

## Perguntas em aberto

- Quando existir painel admin (fora de escopo aqui e da spec `16`), ele passa a gravar bloqueio/desbloqueio automaticamente em vez de exigir gravação manual — registrar isso como dependência quando essa spec futura for escrita
- Retenção de dados do Sentry no tier gratuito tem limite de volume mensal — se o número de usuários crescer bastante, revisitar se ainda cobre o uso ou se vale migrar de plano

## Decisões registradas durante a implementação

- **Correção do gap de captura escolhida: `express-async-errors`**, não um wrapper `asyncHandler` manual — a spec deixava as duas em aberto. Motivo: existem ~40 rotas espalhadas em 8 arquivos; a biblioteca faz o patch de uma vez só (`import 'express-async-errors'` como primeiro import de `app.ts`, antes das rotas serem carregadas) sem precisar tocar em cada arquivo de rota individualmente. Validado na prática: uma rota de teste que lançava exceção proposital passou a cair no error handler com 500 (em vez de travar/sumir), e o processo continuou de pé depois — teste removido após confirmar.
- **`POST /auth/logout` não usa `authMiddleware`**: no logout automático (token expirado), uma chamada autenticada já falharia com 401 de novo antes de conseguir registrar o evento. A rota lê o header `Authorization` (se vier) e faz `jwt.decode` (sem verificar assinatura/expiração) só pra saber de quem é o evento — não é um limite de segurança, é atribuição de um registro de auditoria; na pior hipótese alguém forja um `usuario_id` num log que só o dono do SaaS consulta.
- **Sentry inicializado condicionalmente por variável de ambiente** (`SENTRY_DSN` no backend, `EXPO_PUBLIC_SENTRY_DSN` no mobile) — nenhum dos dois projetos Sentry foi criado ainda (passo manual, conta pessoal). Sem a variável, `initSentry()` não faz nada e `Sentry.captureException` vira no-op — app roda normal sem captura até a credencial existir. **Pendência do desenvolvedor**: criar os dois projetos em sentry.io (um Node, um React Native/Expo) e configurar as variáveis no Railway (produção + staging) e no `.env` do mobile.
- **Filtro `beforeSend` no Sentry do mobile** descarta erro de rede sem `response` (offline/timeout) e 401 (sessão expirada, já tratada pelo logout automático) — sem isso, todo uso normal do modo offline-first viraria "erro" no Sentry, mascarando os erros reais.
- **Migration aplicada via `prisma migrate diff` + `migrate deploy`, não `migrate dev`**: o ambiente de implementação roda de forma não-interativa, e `migrate dev` recusa rodar assim. O SQL gerado pelo diff foi conferido manualmente antes de aplicar (só a tabela `eventos_auditoria` nova, nada inesperado) e salvo como migration nomeada (`add_evento_auditoria`) pra manter o histórico igual ao que `migrate dev` teria gerado.
- **Validado localmente contra o Postgres do `docker-compose.yml`** (Docker não estava rodando no início da sessão, foi iniciado pra isso): cadastro, login (sucesso e falha), e logout manual testados via `curl` direto, com os três eventos (`CONTA_CRIADA`, `LOGIN`, `LOGOUT`) conferidos no banco depois — login com senha errada corretamente não gerou evento. Testes automatizados do mobile (56 testes) e `tsc --noEmit` dos três pacotes (backend/frontend/mobile) passando. **Não validado**: fluxo real em dispositivo/simulador (Error Boundary disparando de verdade, captura de erro chegando no Sentry) — só a integração de código, já que os projetos Sentry ainda não existem.
