# Task 8 — Unidade de venda configurável

## Objetivo

Hoje o produtor só vende morango em caixa, mas parte da produção (o que amadureceu demais) é congelada e vendida por quilo. `Venda.quantidade` é um número genérico sem unidade — "caixa" existe só como texto fixo nas telas e em comentários de código, nunca foi modelado. Esta task adiciona uma unidade de venda **cadastrável por sociedade**, permitindo registrar vendas em caixa, kg, ou qualquer outra unidade que o financiador definir, sem exigir troca de código a cada unidade nova.

Isso resolve o caso concreto do morango fresco/congelado. Não modela ainda "cultura" ou "produto" na Safra — oportunidade citada no `CLAUDE.md` como motivação de fundo, mas fica para uma spec futura.

## Escopo

**Entra:**
- Novo model `UnidadeVenda`, pertencente à Sociedade: nome livre (ex: "Caixa", "Kg"), ativa/inativa
- CRUD de `UnidadeVenda`: só sócio com papel `FINANCIADOR` ou `MISTO` cria/edita/desativa (mesma regra de autorização de `RegraDespesaRecorrente`, task 4)
- `Venda` passa a ter `unidade_id` obrigatório
- `RegraDespesaRecorrente` do tipo `POR_VENDA` passa a ter `unidade_id` obrigatório — a regra só dispara despesa automática para Vendas daquela unidade específica (ex: regra "R$1/caixa" não dispara para uma Venda em Kg)
- Migração de dados: cria automaticamente uma unidade "Caixa" para cada Sociedade já existente, e associa a ela todas as Vendas e regras `POR_VENDA` já cadastradas (nenhum dado antigo fica sem unidade)
- Frontend: seletor de unidade ao lançar Venda; tela de cadastro de unidades em Configurações (mesmo padrão de RegraDespesaRecorrente); card "Caixas vendidas" do painel vira uma quebra por unidade

**Fica de fora (não implementar nesta task):**
- Conceito de Produto/Cultura na Safra (Fase 2 — fora do CLAUDE.md atual, mas citado como motivação)
- Fator de conversão entre unidades (ex: 1 caixa = 5kg) — cada unidade é independente, sem relação matemática entre si
- Geração automática de despesa virar opcional/manual por venda (item adjacente do backlog, não relacionado a unidade)
- Multi-safra/multi-cultura de fato

## Regras de negócio

### UnidadeVenda
- Nome livre (string), sem lista fixa/enum — cada sociedade cadastra as suas
- Único por Sociedade (não permite duas unidades com o mesmo nome, case-insensitive, na mesma sociedade)
- Só sócio com papel `FINANCIADOR` ou `MISTO` cria/edita/desativa
- Desativar uma unidade não apaga nem desvincula Vendas/Regras que já a usam — ela só some da lista de opções ao lançar uma Venda ou regra **nova** (mesmo padrão do campo `ativo` em `RegraDespesaRecorrente`)
- Toda Sociedade nova precisa ter pelo menos uma unidade cadastrada antes de conseguir lançar a primeira Venda (ou a Sociedade já nasce com uma unidade padrão — decisão de UX a confirmar na implementação: provavelmente sugerir "Caixa" pré-preenchida no cadastro da Sociedade, sem travar o fluxo)

### Venda
- `POST /safras/:id/vendas` passa a exigir `unidade_id` no body, validando que a unidade pertence à Sociedade dona da Safra
- Sem mudança na fórmula de `total` (`quantidade × preco`) nem nas demais regras da task 4

### RegraDespesaRecorrente (`POR_VENDA`)
- `POST /sociedades/:id/regras-recorrentes` com `tipo_gatilho: POR_VENDA` passa a exigir `unidade_id`, validando que pertence à mesma Sociedade
- Regras `POR_PERIODO` continuam sem `unidade_id` (não fazem sentido para unidade — não estão amarradas a uma Venda)
- Ao lançar uma Venda, `gerarDespesasPorVenda` (`vendas.service.ts`) passa a filtrar as regras `POR_VENDA` ativas **da mesma unidade** da Venda, em vez de todas as regras `POR_VENDA` da Sociedade

### Migração de dados existentes
- Para cada Sociedade já existente: cria uma `UnidadeVenda` chamada "Caixa"
- Toda `Venda` existente recebe essa unidade
- Toda `RegraDespesaRecorrente` existente com `tipo_gatilho = POR_VENDA` recebe essa unidade
- Isso preserva o comportamento atual sem exigir nenhuma ação manual do financiador após o deploy

### Painel de simulação
- O campo `caixasVendidas` (hoje um único número, somando `quantidade` de todas as Vendas do período — `simulacao.controller.ts`) deixa de fazer sentido como está, já que "quantidade" pode ser caixa ou kg misturados
- Passa a agrupar por unidade: `quantidadePorUnidade: [{ unidade_id, unidade_nome, quantidade }]`
- O card "Caixas vendidas" do dashboard (`ResumoPage.tsx`) exibe essa lista (ex: "120 Caixas · 35 Kg") em vez de um número fixo rotulado "caixas"

## Contrato de API

```
POST /sociedades/:id/unidades-venda
  auth obrigatório, requer papel FINANCIADOR ou MISTO na sociedade :id
  body: { nome: string }
  → 201 { unidade: { id, nome, ativo } }
  → 409 se já existe unidade com esse nome (case-insensitive) na sociedade
  → 403 se papel MEEIRO ou não for sócio

GET /sociedades/:id/unidades-venda
  auth obrigatório, requer ser sócio da sociedade :id
  → 200 { unidades: [{ id, nome, ativo }] }
  → 403 se não for sócio

PATCH /unidades-venda/:id
  auth obrigatório, requer papel FINANCIADOR ou MISTO na sociedade dona da unidade
  body: { ativo: boolean }
  → 200 { unidade: { id, ativo } }
  → 403 se papel MEEIRO ou não for sócio

POST /safras/:id/vendas
  auth obrigatório, requer ser sócio da sociedade dona da safra
  body: { data: string, quantidade: number, preco: number, comprador?: string, unidade_id: string }
  → 201 { venda: { id, data, quantidade, preco, total, comprador, unidade_id, unidade_nome } }
  → 422 se unidade_id não pertencer à sociedade dona da safra
  → 403 se não for sócio

GET /safras/:id/vendas
  → 200 { vendas: [{ ..., unidade_id, unidade_nome }] }  (demais campos sem mudança)

POST /sociedades/:id/regras-recorrentes
  body: { socio_id, tipo_gatilho, tipo_despesa, valor, unidade_id? }
  → unidade_id obrigatório quando tipo_gatilho = POR_VENDA; ignorado/rejeitado quando POR_PERIODO
  → 422 se unidade_id não pertencer à sociedade, ou ausente quando POR_VENDA

GET /safras/:id/simulacao
  → 200 { ..., quantidadePorUnidade: [{ unidade_id, unidade_nome, quantidade }] }
  (substitui o campo caixasVendidas: number)
```

## Decisão de schema a registrar

```prisma
model UnidadeVenda {
  id           String   @id @default(uuid())
  sociedade_id String
  nome         String
  ativo        Boolean  @default(true)
  criado_em    DateTime @default(now())

  sociedade Sociedade                @relation(fields: [sociedade_id], references: [id])
  vendas    Venda[]
  regras    RegraDespesaRecorrente[]

  @@unique([sociedade_id, nome])
  @@map("unidades_venda")
}

model Venda {
  ...
  unidade_id String
  unidade    UnidadeVenda @relation(fields: [unidade_id], references: [id])
  ...
}

model RegraDespesaRecorrente {
  ...
  unidade_id String?
  unidade    UnidadeVenda? @relation(fields: [unidade_id], references: [id])
  ...
}
```

**Por que `unidade_id` é opcional em `RegraDespesaRecorrente` (nullable) mesmo sendo obrigatório na prática para `POR_VENDA`:** o Prisma não modela "obrigatório condicional" nativamente sem duplicar a tabela; a obrigatoriedade quando `tipo_gatilho = POR_VENDA` é validada na camada de aplicação (controller/service), igual já acontece hoje com outras combinações de campos dessa tabela.

**Por que não migrar `RegraDespesaRecorrente` para ter unidade fixa por linha em vez de nullable:** regras `POR_PERIODO` nunca vão ter unidade (não estão amarradas a uma Venda), então forçar not-null exigiria um valor "dummy", o que é pior do que nullable + validação.

**Por que a migração cria "Caixa" em vez de deixar `unidade_id` nullable também em `Venda`:** o CLAUDE.md e a spec 04 já tratam "caixa" como o comportamento histórico real do app — criar a unidade retroativamente é mais simples para o resto do sistema (nenhuma query em `Venda`/`Despesa` precisa lidar com unidade ausente) do que introduzir um estado "sem unidade" que só existiria por causa de dados antigos.

**Por que não adicionar fator de conversão entre unidades:** não há caso de uso real ainda que precise somar 3 caixas + 10kg num único total físico — o painel mostra os totais separados por unidade. Se isso mudar, é uma decisão de produto que merece spec própria, não uma antecipação agora.

## Critérios de aceite

1. Dado uma Sociedade nova, o financiador consegue cadastrar uma unidade (ex: "Kg") via `POST /sociedades/:id/unidades-venda`
2. `GET /sociedades/:id/unidades-venda` lista as unidades da Sociedade (ativas e inativas), visível a qualquer sócio
3. Cadastrar uma unidade com nome já existente na mesma Sociedade (mesmo com capitalização diferente) retorna 409
4. Um sócio com papel `MEEIRO` que tenta criar/desativar unidade recebe 403
5. `POST /safras/:id/vendas` sem `unidade_id`, ou com `unidade_id` de outra Sociedade, retorna 422
6. Dado uma Sociedade com unidades "Caixa" e "Kg", e uma regra `POR_VENDA` de R$1/Caixa: lançar uma Venda de 50 Kg **não** gera despesa automática dessa regra; lançar uma Venda de 50 Caixas gera R$50 normalmente
7. `PATCH /unidades-venda/:id` com `{ ativo: false }` faz a unidade sumir da lista de opções para novas Vendas/Regras, mas Vendas e Regras já existentes continuam funcionando normalmente
8. Rodada a migração: toda Sociedade existente tem uma unidade "Caixa", e toda Venda/Regra `POR_VENDA` antiga aponta para ela — nenhum dado antigo fica com `unidade_id` nulo
9. `GET /safras/:id/simulacao` retorna `quantidadePorUnidade` agrupando corretamente por unidade (não existe mais o campo `caixasVendidas`)
10. Frontend: tela de lançar Venda tem seletor de unidade (obrigatório); tela de Configurações permite cadastrar/desativar unidades (só visível/editável para papel `FINANCIADOR`/`MISTO`); card do dashboard mostra quantidade por unidade
