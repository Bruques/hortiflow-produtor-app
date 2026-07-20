# Task 2 — Sociedade e sócios

## Objetivo

Permitir que um usuário autenticado crie uma Sociedade (a parceria), defina os sócios que participam dela com seus percentuais de lucro, e permitir que outros usuários entrem numa Sociedade existente através de um código simples de 6 dígitos. É a base de tenant do sistema — nenhuma Safra, Despesa, Venda ou Acerto (tasks seguintes) existe fora do contexto de uma Sociedade.

## Escopo

**Entra:**
- Criar Sociedade (usuário autenticado vira o primeiro sócio automaticamente)
- Gerar e expor um código de convite de 6 dígitos por Sociedade
- Entrar em uma Sociedade existente informando o código (usuário autenticado vira sócio)
- Definir/editar o percentual de lucro e papel (financiador/meeiro/misto) de cada sócio da Sociedade, com validação de que a soma dos percentuais é 100%
- Listar as Sociedades do usuário autenticado (ele pode participar de várias)
- Listar os sócios de uma Sociedade (com nome, telefone, percentual, papel)
- Middleware/checagem simples de que o usuário só acessa dados de Sociedades das quais é sócio

**Fica de fora (não implementar nesta task):**
- Safra, Despesa, Venda, Acerto (tasks 3 a 6)
- Remover sócio de uma Sociedade (não pedido no roadmap; fica em aberto para decisão futura se necessário)
- Edição do nome da Sociedade depois de criada (não crítico agora)
- Qualquer tela de painel/simulação (task 5)
- Permissões granulares por papel — o CLAUDE.md já define que financiador e meeiro têm a mesma visão de dados no MVP

## Regras de negócio

### Criar Sociedade
- `POST /sociedades` com `{ nome }`, autenticado
- Cria a Sociedade e automaticamente cria o `SocioSociedade` do criador com `percentual_lucro = 100` e `papel = MISTO` (será ajustado quando os demais sócios entrarem — ver abaixo)
- Gera um código de convite de 6 dígitos, único entre sociedades ativas (evita colisão)

### Código de convite
- Formato: 6 dígitos numéricos (ex: "482913")
- Persistido na Sociedade (campo novo `codigo_convite`, não existe no schema atual — decisão registrada abaixo)
- Não expira nesta task (simplicidade do MVP); reemissão de código não é escopo

### Entrar via código
- `POST /sociedades/entrar` com `{ codigo_convite }`, autenticado
- Se código válido e usuário ainda não é sócio dessa Sociedade: cria `SocioSociedade` para o usuário com `percentual_lucro = 0` e `papel = MEEIRO` como default — o percentual real é ajustado depois via edição de percentuais (ver abaixo), já que a soma tem que ser fechada por quem está organizando a divisão
- Se código inválido: 404
- Se usuário já é sócio dessa Sociedade: 409

### Definir percentuais de lucro
- `PUT /sociedades/:id/socios/percentuais` com `{ socios: [{ usuario_id, percentual_lucro, papel }] }`, autenticado, só quem já é sócio da Sociedade
- Precisa cobrir **todos** os sócios atuais da Sociedade (não parcial) — evita ficar com soma indefinida por sócio esquecido
- Valida que a soma dos `percentual_lucro` enviados é exatamente 100 (com tolerância de arredondamento de até 0.01 pra evitar erro de ponto flutuante em decimais tipo 33.33/33.33/33.34)
- Se soma diferente de 100: 422 com mensagem explicando a soma recebida
- Atualiza `percentual_lucro` e `papel` de cada `SocioSociedade` informado

### Listagem
- `GET /sociedades` — lista as Sociedades do usuário autenticado (id, nome, código de convite — só visível pra quem já é sócio)
- `GET /sociedades/:id/socios` — lista os sócios da Sociedade (nome, telefone, percentual_lucro, papel), só acessível a quem é sócio dela

### Autorização
- Toda rota que referencia `:id` de Sociedade verifica que `req.usuario` tem um `SocioSociedade` correspondente; caso contrário, 403

## Contrato de API

```
POST /sociedades
  auth obrigatório
  body: { nome: string }
  → 201 { sociedade: { id, nome, codigo_convite }, socio: { percentual_lucro, papel } }

POST /sociedades/entrar
  auth obrigatório
  body: { codigo_convite: string }
  → 200 { sociedade: { id, nome } }
  → 404 se código não corresponde a nenhuma sociedade
  → 409 se usuário já é sócio dessa sociedade

PUT /sociedades/:id/socios/percentuais
  auth obrigatório, requer ser sócio da sociedade :id
  body: { socios: [{ usuario_id: string, percentual_lucro: number, papel: "FINANCIADOR" | "MEEIRO" | "MISTO" }] }
  → 200 { socios: [...] } (lista atualizada)
  → 422 se a lista não cobre todos os sócios atuais, ou se a soma dos percentuais != 100 (±0.01)
  → 403 se usuário autenticado não é sócio da sociedade

GET /sociedades
  auth obrigatório
  → 200 { sociedades: [{ id, nome, codigo_convite, percentual_lucro, papel }] } (dados do vínculo do usuário autenticado em cada uma)

GET /sociedades/:id/socios
  auth obrigatório, requer ser sócio da sociedade :id
  → 200 { socios: [{ usuario_id, nome, telefone, percentual_lucro, papel }] }
  → 403 se usuário autenticado não é sócio da sociedade
```

## Decisão de schema a registrar

O schema atual (task 1) não tem campo de código de convite na Sociedade. Esta task adiciona:

```prisma
model Sociedade {
  ...
  codigo_convite String @unique
  ...
}
```

Vai gerar uma nova migração Prisma. Nenhuma outra entidade do schema muda nesta task.

## Critérios de aceite

1. Dado um usuário autenticado, `POST /sociedades` com nome cria a Sociedade, retorna código de convite de 6 dígitos, e o criador aparece como sócio com 100%
2. Dado um código de convite válido, um segundo usuário autenticado consegue `POST /sociedades/entrar` e passa a aparecer em `GET /sociedades/:id/socios`
3. Dado um código de convite inexistente, `POST /sociedades/entrar` retorna 404
4. Dado um usuário que já é sócio, tentar entrar de novo na mesma sociedade retorna 409
5. Dado uma Sociedade com 2 sócios, `PUT /sociedades/:id/socios/percentuais` com soma 100% (ex: 60/40) atualiza ambos com sucesso
6. Dado o mesmo cenário, mas com soma diferente de 100% (ex: 60/30), retorna 422 e não altera nada no banco
7. Dado o mesmo cenário, mas a lista enviada não cobre todos os sócios (ex: sociedade tem 3 sócios, só 2 enviados), retorna 422
8. Dado um usuário que não é sócio de uma Sociedade, `GET /sociedades/:id/socios` e `PUT .../percentuais` retornam 403
9. `GET /sociedades` retorna só as sociedades das quais o usuário autenticado participa, com o percentual/papel dele em cada uma
10. Frontend: tela para criar Sociedade (nome), tela mostrando o código de convite gerado, tela para entrar via código, e tela de lista de sócios com edição de percentuais (mobile-first, poucos campos por tela)

## Decisões registradas durante a implementação

- **Migração Prisma criada manualmente**: `prisma migrate dev` exige terminal interativo, que não está disponível neste ambiente. A migração foi gerada com `prisma migrate diff` (que produziu o SQL de `ALTER TABLE` + índice único) e aplicada com `prisma migrate deploy`, mesmo resultado de uma migração normal, só sem o prompt interativo.
- **Select de papel do sócio é um `<select>` nativo estilizado**, não um componente shadcn/ui dedicado — evita adicionar uma dependência nova (`@radix-ui/react-select`) para um único campo de 3 opções fixas.
- **`HomePage` virou a tela "Minhas sociedades"**: antes só mostrava saudação e botão de sair; agora lista as sociedades do usuário e dá acesso a criar/entrar, já que é o hub natural pós-login. Continua sendo a rota `/`.
- **Ao entrar via código, o usuário recebe 0% e papel MEEIRO por padrão** (conforme a regra de negócio da spec) — a tela de sócios já deixa claro que a soma precisa fechar em 100%, então o ajuste é o próximo passo natural depois do convite.

---

## Incremento (2026-07-20): sócio sem conta cadastrado manualmente

### Motivação

Na prática, muitas parcerias têm só o financiador usando o app — o meeiro não quer (ou não vai) criar conta. Com o fluxo atual, isso é um bloqueio: o financiador sozinho é 100% sócio, e não existe outro sócio pra dividir o percentual até alguém entrar via código. Este incremento permite ao financiador cadastrar sócios diretamente pela tela de Configurações, sem depender de código de convite nem de outro usuário.

### Escopo

**Entra:**
- Cadastrar um sócio manualmente (nome + papel), sem vínculo com nenhuma conta de usuário
- Esse sócio participa normalmente do percentual de lucro, do painel de simulação e dos Acertos
- Qualquer sócio já existente na Sociedade pode cadastrar (mesma autorização já usada em `PUT .../percentuais` — não é uma restrição nova só pro financiador)
- Código de convite continua existindo e funcionando do jeito que já funciona hoje, para quem quiser entrar com conta própria
- **Vincular uma conta real a um sócio sem conta já cadastrado**, em vez de sempre criar um sócio novo ao entrar por código — evita duplicar a mesma pessoa (ver "Vincular conta" abaixo)

**Fica de fora (registrado como pergunta em aberto, não decidir agora):**
- Lançar despesa/venda "em nome de" um sócio sem conta — despesas e vendas continuam exigindo um usuário autenticado que lançou
- Editar nome ou remover um sócio sem conta depois de criado (mesma lacuna que já existe hoje pra sócios com conta — não é escopo)

### Regras de negócio

**Cadastrar sócio sem conta**
- `POST /sociedades/:id/socios` com `{ nome: string, papel: "FINANCIADOR" | "MEEIRO" | "MISTO" }`, autenticado, só quem já é sócio da Sociedade
- Cria um `SocioSociedade` com `usuario_id = null`, `nome` preenchido, `percentual_lucro = 0` (mesmo default do fluxo de entrada por código — o ajuste pra fechar 100% é o passo seguinte, via `PUT .../percentuais`)
- `nome` obrigatório, não vazio

**Identificação do sócio nas demais rotas**
- Hoje `GET /sociedades/:id/socios` e `PUT .../percentuais` usam `usuario_id` como identificador do sócio — isso quebra pra sócio sem conta. Passa a usar o `id` do próprio `SocioSociedade` como identificador único em toda a API de sócios, painel de simulação e Acerto (`socio_id` nessas rotas passa a significar "id do vínculo SocioSociedade", não "id do usuário")
- `nome` retornado em `GET /sociedades/:id/socios` vem de `Usuario.nome` quando há conta vinculada, ou do campo `nome` gravado no `SocioSociedade` quando não há
- `telefone` retornado é `null` quando não há conta vinculada

**Entrar por código, com opção de vincular a um sócio sem conta**
- `GET /sociedades/convite/:codigo_convite` (novo, autenticado) retorna o preview do convite: `{ sociedade: { id, nome }, socios_sem_conta: [{ id, nome, papel }] }` — usado pela tela pra perguntar "é algum desses sócios?" antes de confirmar a entrada
- `POST /sociedades/entrar` ganha um campo opcional: `{ codigo_convite, vincular_socio_id? }`
  - Sem `vincular_socio_id`: comportamento atual, inalterado — cria um `SocioSociedade` novo com 0%/MEEIRO
  - Com `vincular_socio_id`: em vez de criar linha nova, preenche `usuario_id` do `SocioSociedade` existente (preserva `nome` → passa a exibir `Usuario.nome`, preserva `percentual_lucro` e `papel` já definidos, preserva histórico de Acerto, já que o `id` do vínculo não muda)
    - 404 se `vincular_socio_id` não existe ou não pertence à sociedade do código
    - 409 se esse sócio já tem `usuario_id` preenchido (já foi vinculado)

**Cálculo de divisão e Acerto**
- `calcularDivisao` (já é agnóstico de Usuario, recebe `socio_id`/`nome`/`percentual_lucro` genéricos — nenhuma mudança nesse service) passa a receber o `id` do `SocioSociedade` como `socio_id`
- `AcertoSocio.socio_id` passa a referenciar `SocioSociedade.id` em vez de `Usuario.id` — sócio sem conta aparece normalmente num Acerto, com `despesas_bancadas = 0` (já que não pode ter despesa própria lançada, ver escopo)

### Contrato de API

```
POST /sociedades/:id/socios
  auth obrigatório, requer ser sócio da sociedade :id
  body: { nome: string, papel: "FINANCIADOR" | "MEEIRO" | "MISTO" }
  → 201 { socio: { id, nome, telefone: null, percentual_lucro: 0, papel } }
  → 400 se nome vazio
  → 403 se usuário autenticado não é sócio da sociedade

GET /sociedades/:id/socios        (contrato muda)
  → 200 { socios: [{ id, nome, telefone: string | null, percentual_lucro, papel }] }
  (campo id substitui usuario_id como identificador; telefone pode ser null)

PUT /sociedades/:id/socios/percentuais   (contrato muda)
  body: { socios: [{ id: string, percentual_lucro: number, papel: ... }] }
  (campo id substitui usuario_id)

GET /sociedades/convite/:codigo_convite   (novo)
  auth obrigatório
  → 200 { sociedade: { id, nome }, socios_sem_conta: [{ id, nome, papel }] }
  → 404 se código não corresponde a nenhuma sociedade

POST /sociedades/entrar   (contrato muda)
  body: { codigo_convite: string, vincular_socio_id?: string }
  → 200 { sociedade: { id, nome } }
  → 404 se código não corresponde a nenhuma sociedade, ou vincular_socio_id não existe/não pertence à sociedade
  → 409 se usuário já é sócio dessa sociedade, ou vincular_socio_id já está vinculado a uma conta
```

### Decisões de schema a registrar

```prisma
model SocioSociedade {
  id               String     @id @default(uuid())
  usuario_id       String?    // agora opcional — null quando o sócio não tem conta
  nome             String?    // obrigatório quando usuario_id é null; ignorado (usa Usuario.nome) quando não é
  sociedade_id     String
  percentual_lucro Decimal    @db.Decimal(5, 2)
  papel            PapelSocio
  criado_em        DateTime   @default(now())

  usuario   Usuario?  @relation(fields: [usuario_id], references: [id])
  sociedade Sociedade @relation(fields: [sociedade_id], references: [id])

  @@unique([usuario_id, sociedade_id])
  @@map("socio_sociedades")
}

model AcertoSocio {
  ...
  socio_id String   // passa a referenciar SocioSociedade.id, não mais Usuario.id
  socio    SocioSociedade @relation(fields: [socio_id], references: [id])
  ...
}
```

- `@@unique([usuario_id, sociedade_id])` continua válido com `usuario_id` nulo — Postgres trata `NULL` como distinto em constraints únicas, então múltiplos sócios sem conta na mesma Sociedade não colidem entre si
- **Migração de dados**: `AcertoSocio.socio_id` hoje guarda `Usuario.id`; a migração precisa fazer backfill pra `SocioSociedade.id` correspondente (join por `usuario_id` + `sociedade_id` da safra do Acerto) antes de trocar a FK. Há dados reais no ambiente atual (6 Acertos / 12 AcertoSocio / 26 SocioSociedade) — a migração roda contra esses dados, não é banco vazio

### Critérios de aceite

1. Dado um usuário sozinho numa Sociedade (100%), ele consegue `POST /sociedades/:id/socios` com nome e papel, e o novo sócio aparece em `GET /sociedades/:id/socios` com 0%
2. Dado o cenário acima, `PUT .../percentuais` referenciando os `id`s dos dois sócios (o usuário e o sem conta) com soma 100% funciona normalmente
3. O painel de simulação e um novo Acerto criado nesse cenário mostram o sócio sem conta com o valor de lucro correto pro percentual definido, e `despesas_bancadas = 0`
4. Acertos criados antes desta mudança continuam sendo exibidos corretamente em `GET /acertos/:id` após a migração (valores e sócios preservados)
5. `POST /sociedades/:id/socios` com nome vazio retorna 400; por um usuário que não é sócio da sociedade retorna 403
6. Dado uma Sociedade com um sócio sem conta chamado "João", um segundo usuário que entra com o código de convite vê "João" listado em `GET /sociedades/convite/:codigo`; ao confirmar entrada com `vincular_socio_id` = id do João, o sócio "João" passa a ter conta (aparece com telefone), mantendo o mesmo `id`, percentual e papel de antes — nenhum sócio novo é criado
7. Tentar vincular um `vincular_socio_id` que já tem conta retorna 409; um que não existe/não é dessa sociedade retorna 404
8. Frontend: tela de Configurações ganha um botão "Adicionar sócio" (nome + papel) na seção de sócios; tela de "Entrar por código" pergunta "é algum desses sócios?" quando o convite tem sócios sem conta, com opção "Não, sou novo sócio"
