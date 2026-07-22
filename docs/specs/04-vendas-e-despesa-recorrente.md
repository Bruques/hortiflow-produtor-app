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
- `PUT /safras/:id/vendas/:vendaId` e `DELETE /safras/:id/vendas/:vendaId` — edição e exclusão foram implementadas depois desta task (sem adendo registrado na época); regravado aqui para a spec refletir o estado real. Ambas bloqueiam com 409 se a data da venda já estiver coberta por um Acerto registrado. Editar recalcula (apaga e recria) as Despesas geradas por regra `POR_VENDA`, já que quantidade/data podem ter mudado

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

## Adendo (2026-07-20) — filtro de período personalizado na lista de Vendas

Origem: mesmo item de backlog do adendo em `05-calculo-e-painel-simulacao.md` e `03-safra-despesas-e-despesa-pessoal.md`, estendido à tela `VendasPage`.

- Reaproveita o `PeriodoPersonalizadoButton` (ícone de calendário abaixo do `PeriodToggle`, sheet com data início/fim)
- Filtro **client-side** sobre a lista já carregada de `GET /safras/:id/vendas` (que não aceita filtro de período) — mesma função `dataEstaNoIntervalo` usada nas outras telas
- Nenhuma mudança de contrato de API nem de schema

## Adendo (2026-07-20) — campo `pago` na Venda

Origem: nem sempre o pagamento da venda acontece no ato — o produtor pode vender o morango hoje e só receber do comprador dias/semanas depois. Hoje não existe nenhum jeito de sinalizar isso.

- Novo campo `pago Boolean @default(false)` no model `Venda` — nova migration Prisma
- `POST /safras/:id/vendas` aceita `pago?: boolean` no body (default `false` se omitido); `PUT /safras/:id/vendas/:vendaId` também aceita `pago?: boolean` pra permitir marcar como pago depois
- **Não afeta `calcularDivisao` nem nenhum outro cálculo** — a venda entra no faturamento/lucro no momento em que é registrada, independente do status de pagamento (regime de competência, não caixa). `pago` é puramente informativo nesta task
- Frontend: toggle "Já foi pago?" na mesma tela `NovaVendaPage.tsx` (serve tanto pra criar quanto editar), desmarcado por padrão; a listagem `VendasPage.tsx` mostra o status (ex: badge "Pago" / "A receber") em cada item
- **Fica de fora desta task:** filtro por status de pagamento na listagem (mencionado como ideia futura, não implementar agora); qualquer mudança em `calcularDivisao` que leve em conta status de pagamento — se isso vier a ser necessário, é uma decisão de negócio separada (mudaria de regime de competência para regime de caixa) e precisa de spec própria

## Adendo (2026-07-22) — despesa `POR_VENDA` deixa de ser automática, vira opt-in na tela de venda

Origem: item de backlog "Repensar a criação de despesa recorrente automática (gatilho `por_venda`)". Hoje `POST/PUT /safras/:id/vendas` gera a despesa de toda regra `POR_VENDA` ativa da mesma unidade da venda, sem o sócio ver ou poder recusar — mesmo problema de "despesa fantasma" que o gatilho `POR_PERIODO` já resolve com a tela de sugestão. Esta mudança estende o mesmo princípio (visibilidade e confirmação no momento do lançamento) para `POR_VENDA`, mas embutido na própria tela de venda em vez de uma tela de sugestões separada, já que aqui a regra é conhecida no mesmo instante em que a quantidade é informada.

**Decisão de UX (confirmada com o dev):**
- Os toggles das regras aplicáveis vêm **marcados por padrão** ao abrir a tela (preserva a experiência atual de "já vem certo"), mas o sócio pode desmarcar antes de salvar caso aquela despesa específica não deva ocorrer nessa venda (ex: regra de comissão de transporte que não se aplica porque o comprador buscou no local)
- Ao **editar** uma venda existente, os toggles refletem o estado que foi confirmado na criação (quais regras geraram despesa), não voltam a marcar tudo — e o sócio pode alterar; salvar recalcula (apaga e recria) as despesas dessa venda conforme o novo estado, mesmo padrão "apaga e recria" que já existe para `PUT`

### Mudança de contrato de API

- `POST /safras/:id/vendas` e `PUT /safras/:id/vendas/:vendaId` passam a aceitar `regras_por_venda_aplicadas?: string[]` (ids de `RegraDespesaRecorrente`) — é a lista de regras que o sócio deixou marcada na tela no momento de salvar
  - Cada id precisa pertencer à Sociedade dona da Safra, ter `tipo_gatilho = POR_VENDA`, `ativo = true` e `unidade_id` igual ao da venda — senão `422` (mesmo padrão de validação de `socio_id` já usado na spec)
  - Campo **omitido ou `[]`**: nenhuma despesa é gerada — não existe mais fallback implícito de "aplica todas as ativas". O opt-in é sempre explícito, vindo do frontend
  - Em `PUT`: se o campo for enviado, recalcula (apaga todas as despesas com `venda_origem_id` e recria só para os ids da lista); se omitido, **não mexe** nas despesas já geradas (permite editar só `preco`/`pago`/etc sem tocar nas despesas gráce a essa venda)
- `GET /safras/:id/vendas` passa a incluir `regras_aplicadas: string[]` em cada venda — ids das regras que efetivamente geraram despesa para aquela venda (consulta simples: `despesa.regra_origem_id` onde `venda_origem_id = venda.id`). É o que a tela usa para pré-marcar os toggles na edição, reaproveitando o mesmo padrão já existente de "buscar 1 venda filtrando a listagem" (não existe endpoint de venda única)

### Mudança de comportamento do backend

`gerarDespesasPorVenda` deixa de buscar "todas as regras `POR_VENDA` ativas da unidade" e passa a receber a lista de ids confirmados, filtrando:
```
where: { id: { in: regras_por_venda_aplicadas }, sociedade_id, tipo_gatilho: POR_VENDA, unidade_id: venda.unidade_id, ativo: true }
```
(o filtro por `sociedade_id`/`tipo_gatilho`/`unidade_id`/`ativo` continua, mesmo recebendo ids explícitos, pra não confiar cegamente em id vindo do client — um id de outra sociedade ou já desativado é ignorado silenciosamente, sem gerar despesa)

### Frontend (`NovaVendaPage.tsx`)

- O card de preview "Vai gerar despesa automática de R$X" (hoje só informativo) vira uma lista de **toggles**, um por regra `POR_VENDA` ativa da unidade selecionada, cada um mostrando `tipo_despesa` e o valor calculado (`regra.valor × quantidade`)
- Nova venda: todos os toggles aplicáveis começam marcados; trocar a unidade recalcula a lista de regras aplicáveis e reseta os toggles pra marcados
- Edição: toggles iniciam conforme `regras_aplicadas` da venda (vindo da listagem); trocar a unidade na edição também reresate para o padrão marcado (as regras da unidade antiga deixam de fazer sentido)
- Salvar envia `regras_por_venda_aplicadas` com os ids atualmente marcados

**Fica de fora desta mudança:** qualquer alteração no fluxo `POR_PERIODO` (sugestão do dia continua igual); mudança de `calcularDivisao` (despesas geradas continuam entrando no cálculo normalmente, só muda como/quando são criadas).

## Critérios de aceite

1. Dado uma Safra em andamento, `POST /safras/:id/vendas` cria a Venda com `total` calculado no backend
2. `GET /safras/:id/vendas` lista as vendas da Safra
3. Dado uma regra `POR_VENDA` ativa (ex: R$1/caixa, atribuída ao sócio B), ao lançar uma Venda de 100 caixas **com o id dessa regra em `regras_por_venda_aplicadas`**, uma Despesa de R$100 é criada para o sócio B com `regra_origem_id` apontando pra regra (ver adendo 2026-07-22 — deixou de ser automática incondicional)
4. Uma regra `POR_VENDA` **inativa**, ou não incluída em `regras_por_venda_aplicadas`, não gera despesa ao lançar Venda
5. Dado um sócio com papel `MEEIRO`, `POST /sociedades/:id/regras-recorrentes` retorna 403
6. Dado um sócio com papel `FINANCIADOR`, `POST /sociedades/:id/regras-recorrentes` com `tipo_gatilho: POR_PERIODO` cria a regra, e ela **não** gera nenhuma Despesa sozinha
7. `GET /safras/:id/regras-recorrentes/sugestoes` lista a regra `POR_PERIODO` ativa até que seja confirmada hoje
8. `POST /safras/:id/regras-recorrentes/:regraId/confirmar` cria a Despesa do dia e a regra some da lista de sugestões
9. Confirmar a mesma regra duas vezes no mesmo dia: segunda chamada retorna 409
10. `PATCH /regras-recorrentes/:id` com `{ ativo: false }` desativa a regra; ela deixa de gerar despesa automática (`POR_VENDA`) e de aparecer nas sugestões (`POR_PERIODO`)
11. Frontend: tela de lançamento e lista de Vendas; tela de configuração de regras recorrentes (só visível/editável para papel `FINANCIADOR`/`MISTO`, mas listagem visível a todos); um bloco de "sugestões do dia" com botão de confirmação de 1 clique, visível na home ou na tela de despesas
12. Dado uma Venda criada sem informar `pago`, ela é salva com `pago = false`
13. Dado uma Venda existente com `pago = false`, `PUT /safras/:id/vendas/:vendaId` com `{ pago: true }` atualiza só esse campo, sem exigir os demais
14. Marcar uma Venda como paga ou não paga **não altera** o valor calculado em `calcularDivisao` no mesmo período
15. Frontend: toggle "Já foi pago?" em `NovaVendaPage.tsx` (criar e editar) e indicação visual do status em `VendasPage.tsx`
16. Dado 2 regras `POR_VENDA` ativas da mesma unidade da venda, a tela de lançamento mostra 2 toggles, ambos marcados por padrão; desmarcar um e salvar gera despesa só da regra que ficou marcada
17. Enviar `POST /safras/:id/vendas` com `regras_por_venda_aplicadas` omitido ou `[]` não gera nenhuma Despesa, mesmo havendo regras `POR_VENDA` ativas aplicáveis
18. Enviar um id de regra que não pertence à Sociedade, está inativa, ou é de outra unidade em `regras_por_venda_aplicadas`: `422`, nenhuma despesa é criada a partir desse id
19. `GET /safras/:id/vendas` retorna `regras_aplicadas` com os ids das regras que geraram despesa para cada venda
20. Dado uma Venda editada com um novo `regras_por_venda_aplicadas` diferente do estado salvo, `PUT /safras/:id/vendas/:vendaId` apaga as despesas antigas dessa venda e recria só para os ids da nova lista; se o campo for omitido no `PUT`, as despesas já geradas não são alteradas
21. Frontend: ao abrir a tela para editar uma Venda existente, os toggles de regra `POR_VENDA` vêm marcados conforme `regras_aplicadas` daquela venda, não todos marcados por padrão
