# Task 4 — Vendas e despesa recorrente

## Objetivo

Permitir lançar as Vendas de uma Safra e configurar `RegraDespesaRecorrente`, que evita lançamento manual repetitivo de despesas que se repetem por padrão (ex: "R$1 por caixa vendida", "R$50/dia de diesel do frete"). É pré-requisito da task 5 (cálculo de divisão), que soma despesas e vendas por período.

## Escopo

**Entra:**
- Venda da safra: criar, listar (por Safra)
- RegraDespesaRecorrente: criar, listar, ativar/desativar — só sócio com papel `FINANCIADOR` ou `MISTO` pode criar/editar
- Gatilho `POR_VENDA`: ao lançar uma Venda, gera automaticamente uma Despesa da sociedade para cada regra ativa desse tipo na Sociedade (valor = valor da regra × quantidade vendida)
- Gatilho `POR_PERIODO`: **não** gera Despesa sozinho em background. Aparece como sugestão do dia; o sócio confirma com 1 clique, o que então cria a Despesa
- Autorização: mesma regra das tasks anteriores — toda rota exige ser sócio da Sociedade dona da Safra/regra

**Fica de fora (não implementar nesta task):**
- Edição/exclusão de Venda (não pedido no roadmap; só criar/listar, mesma decisão já tomada para Despesa na task 3)
- Cálculo de divisão / painel de simulação (task 5)
- Acerto (task 6)
- `POR_PERIODO` virando 100% automático sem confirmação (Fase 2, listado explicitamente no CLAUDE.md)
- Papel `MEEIRO` configurando regras recorrentes — só `FINANCIADOR`/`MISTO`

## Regras de negócio

### Venda
- `POST /safras/:id/vendas` com `{ data, quantidade, preco, comprador? }`, autenticado, requer ser sócio da Sociedade dona da Safra
- `total` é calculado no backend (`quantidade × preco`), não recebido do cliente — evita inconsistência
- `quantidade` e `preco` positivos
- Após criar a Venda, o service busca todas as `RegraDespesaRecorrente` **ativas** da Sociedade com `tipo_gatilho = POR_VENDA` e, para cada uma, cria automaticamente uma Despesa: `valor = regra.valor × venda.quantidade`, `socio_id = regra.socio_id`, `tipo = regra.tipo_despesa`, `data = venda.data`, `regra_origem_id = regra.id` (rastreia a origem automática)
- `GET /safras/:id/vendas` — lista vendas da Safra, requer ser sócio

### RegraDespesaRecorrente
- `POST /sociedades/:id/regras-recorrentes` com `{ socio_id, tipo_gatilho, tipo_despesa, valor }`, autenticado, requer que o autenticado seja sócio da Sociedade `:id` **com papel `FINANCIADOR` ou `MISTO`** (papel `MEEIRO` autenticado: 403)
  - `socio_id` precisa ser sócio da mesma Sociedade (a despesa gerada será atribuída a ele — pode ser diferente de quem criou a regra)
  - `criado_por` é sempre `req.usuarioId`
  - `ativo` inicia `true`
- `GET /sociedades/:id/regras-recorrentes` — lista todas as regras da Sociedade (ativas e inativas), requer ser sócio (qualquer papel, transparência total)
- `PATCH /regras-recorrentes/:id` com `{ ativo }` — ativa/desativa. Requer papel `FINANCIADOR` ou `MISTO` na Sociedade dona da regra (não precisa ser quem criou — qualquer financiador da sociedade pode desativar)

### Sugestão do dia (gatilho `POR_PERIODO`)
- `GET /safras/:id/regras-recorrentes/sugestoes` — lista as regras `POR_PERIODO` **ativas** da Sociedade dona da Safra que **ainda não têm** uma Despesa com `regra_origem_id` = a regra e `data` = hoje, nessa Safra. Requer ser sócio
- `POST /safras/:id/regras-recorrentes/:regraId/confirmar` — cria a Despesa do dia para essa regra (`valor = regra.valor`, `socio_id = regra.socio_id`, `tipo = regra.tipo_despesa`, `data = hoje`, `regra_origem_id = regra.id`). Requer ser sócio (qualquer sócio pode confirmar, mesma lógica de "qualquer sócio lança despesa em nome de outro" da task 3)
  - Se já existe Despesa dessa regra hoje nessa Safra: 409 (evita duplicar ao clicar duas vezes)

## Contrato de API

```
POST /safras/:id/vendas
  auth obrigatório, requer ser sócio da sociedade dona da safra
  body: { data: string, quantidade: number, preco: number, comprador?: string }
  → 201 { venda: { id, data, quantidade, preco, total, comprador } }
  → 403 se não for sócio

GET /safras/:id/vendas
  auth obrigatório, requer ser sócio da sociedade dona da safra
  → 200 { vendas: [{ id, data, quantidade, preco, total, comprador }] }
  → 403 se não for sócio

POST /sociedades/:id/regras-recorrentes
  auth obrigatório, requer papel FINANCIADOR ou MISTO na sociedade :id
  body: { socio_id: string, tipo_gatilho: 'POR_VENDA' | 'POR_PERIODO', tipo_despesa: TipoDespesa, valor: number }
  → 201 { regra: { id, socio_id, tipo_gatilho, tipo_despesa, valor, ativo } }
  → 422 se socio_id não for sócio da sociedade
  → 403 se papel MEEIRO ou não for sócio

GET /sociedades/:id/regras-recorrentes
  auth obrigatório, requer ser sócio da sociedade :id
  → 200 { regras: [{ id, socio_id, socio_nome, tipo_gatilho, tipo_despesa, valor, ativo, criado_por }] }
  → 403 se não for sócio

PATCH /regras-recorrentes/:id
  auth obrigatório, requer papel FINANCIADOR ou MISTO na sociedade dona da regra
  body: { ativo: boolean }
  → 200 { regra: { id, ativo } }
  → 403 se papel MEEIRO ou não for sócio

GET /safras/:id/regras-recorrentes/sugestoes
  auth obrigatório, requer ser sócio da sociedade dona da safra
  → 200 { sugestoes: [{ id, socio_id, socio_nome, tipo_despesa, valor }] }
  → 403 se não for sócio

POST /safras/:id/regras-recorrentes/:regraId/confirmar
  auth obrigatório, requer ser sócio da sociedade dona da safra
  → 201 { despesa: { id, socio_id, tipo, valor, data, regra_origem_id } }
  → 403 se não for sócio
  → 409 se já confirmada hoje
```

## Decisão de schema a registrar

Novo enum e model, mais um campo em `Despesa` para rastrear origem automática:

```prisma
enum TipoGatilhoRegra {
  POR_VENDA
  POR_PERIODO
}

model RegraDespesaRecorrente {
  id           String           @id @default(uuid())
  sociedade_id String
  socio_id     String
  criado_por   String
  tipo_gatilho TipoGatilhoRegra
  tipo_despesa TipoDespesa
  valor        Decimal          @db.Decimal(10, 2)
  ativo        Boolean          @default(true)
  criado_em    DateTime         @default(now())

  sociedade Sociedade @relation(fields: [sociedade_id], references: [id])
  socio     Usuario   @relation("RegraSocio", fields: [socio_id], references: [id])
  criador   Usuario   @relation("RegraCriador", fields: [criado_por], references: [id])
  despesas  Despesa[]

  @@map("regras_despesa_recorrente")
}
```

Em `Despesa`, adicionar campo opcional:

```prisma
model Despesa {
  ...
  regra_origem_id String?
  regraOrigem     RegraDespesaRecorrente? @relation(fields: [regra_origem_id], references: [id])
  ...
}
```

**Por que `tipo_despesa` na regra, e não fixo:** a regra precisa dizer que categoria de despesa gerar (ex: diesel = `TRANSPORTE`, valor por caixa pode ser `EMBALAGEM` ou `OUTRO`) — decisão do financiador na hora de configurar, não um valor fixo do sistema.

**Por que `regra_origem_id` em vez de inferir a sugestão de outro jeito:** sem esse campo não dá pra saber, de forma confiável, se a regra `POR_PERIODO` já foi confirmada hoje (não dá pra comparar por valor/tipo, pode haver despesa manual coincidente). Vai gerar uma nova migração Prisma.

**Papel `MISTO` incluído na autorização de criar/editar regra:** o CLAUDE.md diz "sempre o financiador — só ele configura", mas o papel `MISTO` (sócio que financia e trabalha) faz parte financeiramente também; tratcandos-o como equivalente a financiador aqui evita bloquear um caso real sem necessidade. Se isso não fizer sentido na prática, é uma linha só pra restringir a `FINANCIADOR` puro.

## Critérios de aceite

1. Dado uma Safra em andamento, `POST /safras/:id/vendas` cria a Venda com `total` calculado no backend
2. `GET /safras/:id/vendas` lista as vendas da Safra
3. Dado uma regra `POR_VENDA` ativa (ex: R$1/caixa, atribuída ao sócio B), ao lançar uma Venda de 100 caixas, uma Despesa de R$100 é criada automaticamente para o sócio B com `regra_origem_id` apontando pra regra
4. Uma regra `POR_VENDA` **inativa** não gera despesa ao lançar Venda
5. Dado um sócio com papel `MEEIRO`, `POST /sociedades/:id/regras-recorrentes` retorna 403
6. Dado um sócio com papel `FINANCIADOR`, `POST /sociedades/:id/regras-recorrentes` com `tipo_gatilho: POR_PERIODO` cria a regra, e ela **não** gera nenhuma Despesa sozinha
7. `GET /safras/:id/regras-recorrentes/sugestoes` lista a regra `POR_PERIODO` ativa até que seja confirmada hoje
8. `POST /safras/:id/regras-recorrentes/:regraId/confirmar` cria a Despesa do dia e a regra some da lista de sugestões
9. Confirmar a mesma regra duas vezes no mesmo dia: segunda chamada retorna 409
10. `PATCH /regras-recorrentes/:id` com `{ ativo: false }` desativa a regra; ela deixa de gerar despesa automática (`POR_VENDA`) e de aparecer nas sugestões (`POR_PERIODO`)
11. Frontend: tela de lançamento e lista de Vendas; tela de configuração de regras recorrentes (só visível/editável para papel `FINANCIADOR`/`MISTO`, mas listagem visível a todos); um bloco de "sugestões do dia" com botão de confirmação de 1 clique, visível na home ou na tela de despesas
