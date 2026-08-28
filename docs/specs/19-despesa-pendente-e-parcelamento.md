# Task 19 — Despesa pendente de pagamento e parcelamento

## Objetivo

Hoje toda despesa lançada é tratada como já paga: ao registrar R$5.000 de adubo comprado hoje mas pago em 90 dias (ou parcelado no boleto), o painel já mostra o saldo negativo imediatamente, sem forma de indicar que o dinheiro ainda não saiu do bolso. Esta task dá ao sócio um jeito de marcar uma despesa como **pendente de pagamento** (com data de vencimento) e de **parcelar** uma compra em várias despesas, mantendo o controle sobre o que já foi pago e o que ainda vai ser.

## Faseamento (decisão do dev, 2026-08-27)

Backend + frontend web primeiro; app mobile só depois de o dev validar em staging. Como o backend é uma API única compartilhada pelos dois clientes (ver "API precisa continuar agnóstica de cliente" no CLAUDE.md), essa divisão não parte a spec em duas — o contrato de API abaixo já sai completo e pronto pro mobile consumir quando chegar a vez dele; falta só a tela.

Web validado pelo dev em 2026-08-27 (achou e corrigiu, junto comigo, um bug onde a `data` de lançamento de cada parcela ficava presa na data de hoje em vez de acompanhar o vencimento — ver histórico da conversa). Mobile implementado na sequência, mesmo dia: `despesas_cache` (SQLite local) ganhou as mesmas 3 colunas, com migração via `ALTER TABLE` guardada em try/catch pra quem já tinha o app instalado antes desta task; parcelamento reaproveita a fila de sincronização offline-first já existente (`criarDespesa` em `mobile/src/lib/despesasQueue.ts`), chamada N vezes em sequência — diferente do web, essa chamada nunca lança por falha de rede (grava local na hora, tenta enviar se houver conexão), então a tela mobile não precisa da lógica de retry parcial que o formulário web tem. "Marcar como pago" ganhou uma operação de fila própria (`despesa.pagar`), incluindo o caso de uma despesa pendente que ainda nem chegou ao servidor (edita o payload em fila antes de enviar, sem chamada de rede).

## Escopo

**Entra:**
- Campo de status de pagamento (`PAGO` / `PENDENTE`) na Despesa da sociedade, com data de vencimento quando pendente
- Ação de marcar uma despesa pendente como paga
- Fluxo de lançamento parcelado na tela de Despesa: o sócio informa o valor total e o número de parcelas, e o frontend cria N despesas independentes, cada uma com valor proporcional e descrição indicando a parcela e a compra de origem
- Selo visual (Pendente/Pago) e um filtro "só pendentes" na lista de despesas, web e mobile
- Mesmo comportamento no app mobile, incluindo lançamento offline (a fila de sincronização já existente cobre os campos novos sem redesenho — ver `docs/specs/mobile/00-setup-e-infra.md`)

**Fica de fora (não implementar nesta task):**
- Qualquer mudança em `calcularDivisao` ou no painel de simulação — despesa pendente continua contando no lucro líquido na data do lançamento, igual hoje (decisão do dev, 2026-08-27); só ganha um selo visual. Ver "Regra crítica de arquitetura" no CLAUDE.md
- Relação formal entre as parcelas de uma mesma compra no banco (ex: `compra_id`, tabela de agrupamento) — o vínculo é só textual, na `descricao` de cada parcela (decisão do dev: simplicidade em vez de modelar uma nova entidade)
- Edição/exclusão de despesa da sociedade já existem desde a task 13 (`PUT`/`DELETE /safras/:id/despesas/:despesaId`) — esta task só estende esses contratos com os campos novos, sem mudar a regra de quem pode editar/excluir nem a trava de "coberta por Acerto"
- `DespesaPessoal` e `Venda` — o problema relatado é só em Despesa da sociedade; Venda a prazo fica pra uma rodada futura se virar necessidade real
- Endpoint novo de "criar parcelado" no backend — o parcelamento é resolvido no frontend chamando `POST /safras/:id/despesas` N vezes em sequência, reaproveitando o endpoint que já existe
- Notificação/lembrete de vencimento próximo (ex: push avisando "vence amanhã") — fica de fora até existir infra de notificação (ver Fase 2 do CLAUDE.md)

## Regras de negócio

### Status de pagamento
- Toda Despesa da sociedade ganha `status_pagamento`, com dois valores: `PAGO` (default) e `PENDENTE`
- Se `status_pagamento = PENDENTE`, `data_vencimento` é obrigatória
- Se `status_pagamento = PAGO`, `data_vencimento` é ignorada/opcional e `data_pagamento` é preenchida automaticamente com a própria `data` do lançamento (assume-se pago na hora, comportamento idêntico ao atual)
- `data_pagamento` é só informativa (mostrada no histórico) — **não entra em nenhum cálculo**, ela existe apenas para o sócio saber quando marcou como quitado

### Marcar como pago
- `PATCH /safras/:id/despesas/:despesaId/pagar`, autenticado, requer ser sócio da Sociedade dona da despesa (mesmo padrão de rota de `atualizar`/`excluir` despesa, já existentes)
- Muda `status_pagamento` para `PAGO` e grava `data_pagamento = now()`
- Se a despesa já estiver `PAGO`: 409
- Qualquer sócio da sociedade pode marcar como pago (mesma regra de "sem permissões granulares no MVP" já usada pro lançamento de despesa em nome de outro sócio)

### Parcelamento (resolvido no frontend)
- Na tela de lançamento de despesa, um toggle "Parcelado" revela um campo "número de parcelas" (2 a 24, por exemplo)
- Ao confirmar, o frontend calcula `valor_parcela = valor_total / n`, com a **última parcela absorvendo a diferença de arredondamento em centavos** (ex: R$5.000,00 ÷ 3 = R$1.666,67 + R$1.666,67 + R$1.666,66)
- Cada parcela é criada com uma chamada separada a `POST /safras/:id/despesas`, com:
  - `descricao` = descrição informada pelo sócio (se houver) + sufixo automático `" — parcela X/N de <valor total formatado>"` (ex: `"Adubo — parcela 2/3 de R$ 5.000,00"`)
  - `status_pagamento = PENDENTE`
  - `data_vencimento` = data da 1ª parcela informada pelo sócio, somando 1 mês por parcela subsequente (parcela 1 = data informada, parcela 2 = +1 mês, parcela 3 = +2 meses...) — periodicidade fixa mensal nesta rodada, sem campo pra customizar
  - mesmo `tipo` e `socio_id` em todas as parcelas
- Se uma das N chamadas falhar no meio do processo (ex: rede caiu na parcela 2 de 3), a tela informa quais parcelas foram criadas com sucesso e quais falharam, permitindo tentar de novo só as que faltam — não faz rollback automático das que já foram criadas (não existe transação distribuída aqui, cada `POST` já é uma despesa completa e válida por si)

### Listagem
- `GET /safras/:id/despesas` passa a retornar também `status_pagamento`, `data_vencimento` e `data_pagamento` em cada despesa
- Filtro "só pendentes" é client-side, sobre a lista já carregada (mesmo padrão do filtro de período já implementado na task 3, adendo 2026-07-20) — sem mudança de contrato pra suportar filtro no servidor

## Contrato de API

```
POST /safras/:id/despesas
  auth obrigatório, requer ser sócio da sociedade dona da safra
  body: { socio_id, tipo, valor, data, foto_comprovante?, descricao?, status_pagamento?: 'PAGO' | 'PENDENTE', data_vencimento?: string }
  → 201 { despesa: { id, socio_id, tipo, valor, data, foto_comprovante, descricao, status_pagamento, data_vencimento, data_pagamento } }
  → 422 se socio_id não for sócio da sociedade dona da safra
  → 422 se status_pagamento = 'PENDENTE' e data_vencimento ausente
  → 403 se autenticado não for sócio

GET /safras/:id/despesas
  → 200 { despesas: [{ ..., status_pagamento, data_vencimento, data_pagamento }] }

PATCH /safras/:id/despesas/:despesaId/pagar
  auth obrigatório, requer ser sócio da sociedade dona da despesa
  → 200 { despesa: { id, status_pagamento, data_pagamento } }
  → 403 se não for sócio
  → 409 se já estiver PAGO
```

## Decisão de schema a registrar

```prisma
enum StatusPagamento {
  PAGO
  PENDENTE
}

model Despesa {
  // ...campos existentes...
  status_pagamento StatusPagamento @default(PAGO)
  data_vencimento  DateTime?
  data_pagamento   DateTime?
}
```

Vai gerar uma nova migração Prisma. `status_pagamento` com default `PAGO` preserva o comportamento de todas as despesas já existentes no banco sem precisar de backfill manual.

## Critérios de aceite

1. Dado uma Safra em andamento, `POST /safras/:id/despesas` sem `status_pagamento` cria a despesa com `status_pagamento = PAGO` (comportamento atual preservado)
2. `POST /safras/:id/despesas` com `status_pagamento = 'PENDENTE'` e `data_vencimento` informada cria a despesa como pendente
3. `POST /safras/:id/despesas` com `status_pagamento = 'PENDENTE'` e **sem** `data_vencimento` retorna 422
4. `PATCH /despesas/:id/pagar` numa despesa pendente muda o status pra `PAGO` e grava `data_pagamento`
5. `PATCH /despesas/:id/pagar` numa despesa já paga retorna 409
6. `GET /safras/:id/despesas` retorna `status_pagamento`, `data_vencimento` e `data_pagamento` em cada item
7. O painel de simulação (`docs/specs/05-calculo-e-painel-simulacao.md`) e o `calcularDivisao` continuam somando a despesa pendente normalmente na data do lançamento — nenhuma mudança de valor calculado antes/depois desta task
8. Frontend: ao lançar uma despesa de R$5.000 parcelada em 3x com 1ª parcela vencendo hoje, são criadas 3 despesas com valores R$1.666,67 / R$1.666,67 / R$1.666,66, vencimentos hoje / +1 mês / +2 meses, todas `PENDENTE`, com descrição indicando "parcela X/3 de R$ 5.000,00"
9. Frontend: lista de despesas mostra selo "Pendente" (com data de vencimento) ou "Pago" em cada item, e um filtro que esconde as já pagas
10. Frontend: botão "Marcar como pago" numa despesa pendente, com confirmação, some o selo pendente e some a despesa da lista filtrada por "só pendentes"
11. Mobile: mesmo formulário de despesa ganha o toggle de status pendente/parcelado e a mesma listagem com selo; lançamento pendente/parcelado feito offline entra na fila de sincronização existente e sincroniza normalmente ao voltar a conexão
