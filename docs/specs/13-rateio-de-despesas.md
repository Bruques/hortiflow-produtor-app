# Task 13 — Rateio de despesas independente do percentual de lucro

## Objetivo

Hoje toda Despesa da sociedade entra num pool único e é rateada implicitamente pelo mesmo `percentual_lucro` que divide o lucro (`calcularDivisao`, `backend/src/services/divisao.service.ts`). Na prática da região isso nem sempre reflete a realidade: um financiador relatou que despesas de frete e embalagem do morango são custeadas **só pelo meeiro**, sem entrar na conta dele — e o rateio do lucro (ex: 60/40) frequentemente é diferente do rateio de certas despesas específicas.

Esta task generaliza o cálculo pra suportar isso: cada Despesa (e cada regra recorrente) pode ter um **rateio próprio**, diferente do percentual de lucro da sociedade. Quando nenhum rateio é definido, o comportamento é idêntico ao atual (rateio = percentual de lucro vigente) — não quebra nada já lançado.

**Diferente de `DespesaPessoal`:** despesa pessoal é privada (só quem lançou vê, fora de qualquer cálculo da sociedade). O que esta task resolve é o caso intermediário: despesa **visível a todos** (mantém a transparência, ponto central do produto), mas custeada por um rateio próprio, que pode ser 100% de um sócio só ou qualquer combinação de percentuais.

## Escopo

**Entra:**
- Rateio por Despesa: opcional, se omitido segue o `percentual_lucro` vigente da sociedade (comportamento atual, sem mudança)
- Rateio por `RegraDespesaRecorrente`: definido **na criação da regra** (decisão do dev — não haverá tela de editar rateio de uma regra já existente, mesma limitação que já existe hoje pra outros campos da regra, só `ativo` é editável via `PATCH`); copiado (congelado) pra cada Despesa gerada por ela
- Generalização de `calcularDivisao` pra considerar o rateio de cada despesa individualmente
- Validação de soma 100% entre os sócios incluídos no rateio (mesmo padrão já usado no rateio de despesa compartilhada, spec 11)
- Frontend: seletor "Quem paga essa despesa?" (Padrão / Só eu / Só [outro sócio] / Personalizado) tanto em `NovaDespesaPage.tsx` quanto na tela de criar regra recorrente
- Indicação visual na listagem de despesas quando o rateio não é o padrão (transparência)

**Fica de fora (não implementar nesta task):**
- Editar o rateio de uma regra recorrente já criada
- Rateio na Venda/receita (só despesa, por ora — não foi relatado caso de receita rateada diferente do lucro)
- Mudar `AcertoSocio.despesas_bancadas` (continua sendo "quanto aquele sócio desembolsou/lançou", independente de como a despesa foi rateada — ver "Decisão de arquitetura")
- Fórmula de reembolso integral de quem bancou antes de dividir o restante (pergunta em aberto separada do CLAUDE.md)

## Regras de negócio

### Rateio de uma Despesa

- `rateio?: { socio_id: string; percentual: number }[]` — `socio_id` é o id de `SocioSociedade` (o mesmo id usado em `calcularDivisao`, não `Usuario.id`)
- Omitido (ou não enviado): a despesa segue o rateio **padrão**, ou seja, o `percentual_lucro` vigente de cada sócio no momento do cálculo — igual a hoje. Isso significa que uma despesa sem rateio explícito **acompanha** mudanças futuras no `percentual_lucro` da sociedade (não é congelada), consistente com o comportamento atual
- Presente: precisa cobrir só os sócios que participam do rateio daquela despesa (quem não está na lista fica com 0%); a soma dos `percentual` informados precisa fechar em 100% (tolerância de 0.01, mesma usada na spec 11), senão `422`
- Todos os `socio_id` do rateio precisam ser `SocioSociedade` da mesma sociedade da despesa, senão `422`
- Persistido em `RateioDespesa` (nova tabela) — uma linha por sócio incluído. Ausência de linhas = rateio padrão

### Rateio de uma `RegraDespesaRecorrente`

- Mesmo formato (`rateio?`) aceito na criação da regra (`POST /sociedades/:id/regras-recorrentes`)
- Persistido em `RateioRegra` (nova tabela), vinculado à regra
- Ao gerar uma Despesa a partir da regra (gatilho `POR_VENDA` confirmado na tela de venda, ou `POR_PERIODO` confirmado na sugestão do dia), o rateio da regra é **copiado** para `RateioDespesa` daquela despesa específica — não referencia a regra ao vivo. Isso segue o mesmo princípio já usado em `Acerto.percentual_aplicado`: se o rateio da regra for alterado depois (não há endpoint pra isso nesta task, mas o princípio vale se vier a existir), despesas já geradas no passado não mudam retroativamente

### Generalização de `calcularDivisao`

Assinatura muda de `despesas: { valor: number }[]` para:

```ts
interface DespesaInput {
  valor: number;
  rateio?: { socio_id: string; percentual: number }[];
}
```

Nova regra de cálculo, por sócio:

```
parte_despesas(sócio) = Σ, para cada despesa:
  se despesa.rateio existe → despesa.valor × (percentual do sócio nesse rateio, 0 se ausente) / 100
  se despesa.rateio ausente → despesa.valor × percentual_lucro(sócio) / 100

valor(sócio) = receita × percentual_lucro(sócio) / 100 − parte_despesas(sócio)
```

Quando **nenhuma** despesa tem rateio explícito, essa fórmula é matematicamente idêntica à atual (`lucroLiquido × percentual_lucro/100`) — é generalização, não substituição. A invariante `Σ valor(sócio) = receita − despesasTotal` continua valendo sempre, desde que cada rateio (explícito ou padrão) some 100% entre os sócios — o que já é validado na criação.

`receita`, `despesasTotal` e `lucroLiquido` continuam agregados como hoje (somas simples), sem depender de rateio — só a distribuição por sócio muda.

## Contrato de API

```
POST /safras/:id/despesas
  (mantém contrato atual, adiciona campo opcional)
  body: { socio_id, tipo, valor, data, foto_comprovante?, descricao?, rateio?: [{ socio_id, percentual }] }
  → 201 { despesa: { ..., rateio: [{ socio_id, socio_nome, percentual }] | null } }
  → 422 se algum socio_id do rateio não pertence à sociedade, ou soma ≠ 100%

PUT /safras/:id/despesas/:despesaId  (via /despesas/:despesaId, rota existente)
  body aceita rateio?: [{ socio_id, percentual }] | null
    - campo omitido: rateio atual não é alterado
    - null: remove rateio customizado, volta a seguir o padrão
    - array: substitui o rateio (apaga e recria as linhas de RateioDespesa)
  (mesmas travas de 409 por Acerto já existentes)

GET /safras/:id/despesas
  → cada despesa passa a incluir rateio: [{ socio_id, socio_nome, percentual }] | null

POST /sociedades/:id/regras-recorrentes
  body adiciona rateio?: [{ socio_id, percentual }] (mesma validação de soma 100%)
  → 201 { regra: { ..., rateio: [{ socio_id, socio_nome, percentual }] | null } }

GET /sociedades/:id/regras-recorrentes
  → cada regra passa a incluir rateio: [{ socio_id, socio_nome, percentual }] | null
```

Nenhuma mudança nos contratos de `GET /safras/:id/simulacao`, `POST /safras/:id/acertos` ou `GET /acertos/:id` — a mudança fica isolada dentro de `calcularDivisao` e de como as despesas chegam até ele.

## Decisão de schema a registrar

```prisma
model RateioDespesa {
  id                  String  @id @default(uuid())
  despesa_id          String
  socio_sociedade_id  String
  percentual          Decimal @db.Decimal(5, 2)

  despesa        Despesa        @relation(fields: [despesa_id], references: [id])
  socioSociedade SocioSociedade @relation(fields: [socio_sociedade_id], references: [id])

  @@unique([despesa_id, socio_sociedade_id])
  @@map("rateios_despesa")
}

model RateioRegra {
  id                  String  @id @default(uuid())
  regra_id            String
  socio_sociedade_id  String
  percentual          Decimal @db.Decimal(5, 2)

  regra          RegraDespesaRecorrente @relation(fields: [regra_id], references: [id])
  socioSociedade SocioSociedade         @relation(fields: [socio_sociedade_id], references: [id])

  @@unique([regra_id, socio_sociedade_id])
  @@map("rateios_regra")
}
```

Em `Despesa` e `RegraDespesaRecorrente`, adicionar as relações reversas (`rateios RateioDespesa[]` / `rateios RateioRegra[]`); em `SocioSociedade`, as duas relações reversas também.

**Por que uma tabela nova em vez de um campo binário (`socio_exclusivo_id`) no `Despesa`:** um campo binário só resolve "essa despesa é 100% de um sócio". Não resolve o caso de 3+ sócios com percentuais distintos (ex: financiador + 2 meeiros, despesa rateada 50/50 só entre os meeiros, excluindo o financiador) — que é um cenário real relatado. A tabela genérica cobre os dois casos (exclusivo é só o caso particular de 1 linha com 100%) sem precisar migrar de novo depois.

**Por que `socio_sociedade_id` e não `usuario_id`:** `calcularDivisao` já trabalha com o id de `SocioSociedade` (é o que `percentual_lucro` referencia), não com `Usuario.id`. `Despesa.socio_id` (que referencia `Usuario`) continua existindo e significando o mesmo de hoje — "quem lançou/registrou a despesa" (auditoria) — sem nenhuma relação com o rateio. São dois conceitos independentes: **quem lançou** (auditoria, já existia) e **quem paga** (rateio, novo).

**Por que `despesas_bancadas` do Acerto não muda:** esse campo já significa "quanto aquele sócio desembolsou/registrou no período" (via `Despesa.socio_id` = `Usuario`), e continua assim. O valor que passa a refletir o rateio é só `valor_lucro` (resultado de `calcularDivisao`). Misturar os dois conceitos no mesmo campo tornaria o extrato mais confuso, não menos — o sócio já vê os dois números lado a lado no Acerto hoje.

**Por que o rateio da regra é copiado (não referenciado) na despesa gerada:** mesmo princípio já usado em `Acerto.percentual_aplicado` — a despesa gerada é um fato histórico; se o rateio "padrão" da regra pudesse mudar depois e isso recalculasse despesas antigas, um Acerto já fechado sobre aquele período ficaria inconsistente com o extrato mostrado na hora.

## Frontend

- `NovaDespesaPage.tsx`: novo seletor "Quem paga essa despesa?" com opções — **Dividir como o lucro** (padrão, pré-selecionado, nenhum campo extra) / **Só eu** / **Só [nome do outro sócio]** (uma opção por sócio da sociedade) / **Personalizado** (abre um campo de percentual por sócio, com validação de soma 100% antes de salvar)
- Tela de criar regra recorrente: mesmo seletor, mesmas opções, no momento da criação
- `DespesasPage.tsx` (listagem): despesa com rateio customizado mostra uma indicação (ex: badge "Rateio: só [nome]" ou "Rateio personalizado") — reforça a transparência que é o ponto central do produto; despesa sem rateio customizado não mostra nada extra (comportamento visual igual ao de hoje)
- Listagem de regras recorrentes: mesma indicação de rateio customizado, se houver

## Critérios de aceite

1. Dado uma Despesa criada **sem** `rateio`, o resultado de `calcularDivisao` para o período é idêntico ao que seria hoje (rateio = `percentual_lucro` vigente)
2. Dado uma sociedade com financiador 60% / meeiro 40%, uma Despesa de R$100 com `rateio: [{ socio_id: meeiro, percentual: 100 }]` faz o valor do meeiro cair R$100 (não R$40) e o do financiador não ser afetado por essa despesa
3. Dado uma sociedade com financiador + 2 meeiros, uma Despesa com rateio 50/50 só entre os dois meeiros (financiador ausente da lista) distribui exatamente essa despesa entre os dois, com percentual 0 pro financiador
4. `POST /safras/:id/despesas` com `rateio` cuja soma dos percentuais não fecha em 100% retorna 422 e não cria a despesa
5. `POST /safras/:id/despesas` com `rateio` incluindo um `socio_id` que não pertence à sociedade retorna 422
6. `GET /safras/:id/despesas` retorna `rateio: null` para despesas sem rateio customizado e a lista de percentuais para as que têm
7. `PUT` de uma despesa existente sem enviar `rateio` mantém o rateio atual inalterado; enviando `rateio: null` volta ao padrão; enviando um array substitui o rateio anterior
8. `POST /sociedades/:id/regras-recorrentes` aceita `rateio` com a mesma validação de soma 100%
9. Uma Despesa gerada a partir de uma regra com rateio customizado nasce com esse rateio já copiado em `RateioDespesa`, mesmo que a regra seja alterada depois (não há endpoint pra isso agora, mas o dado já nasce congelado)
10. Um Acerto criado sobre um período com despesas de rateio customizado reflete o valor correto por sócio em `valor_lucro`, mas `despesas_bancadas` continua contando por quem lançou (`Despesa.socio_id`), sem relação com o rateio
11. Soma de `valor_lucro` de todos os sócios de um Acerto continua batendo com `lucroLiquido` do período, independente de quantas despesas tiverem rateio customizado
12. Frontend: `NovaDespesaPage.tsx` mostra o seletor de rateio com "Dividir como o lucro" pré-selecionado; escolher "Personalizado" e não fechar 100% bloqueia o salvar com mensagem de erro
13. Frontend: tela de criar regra recorrente mostra o mesmo seletor de rateio
14. Frontend: `DespesasPage.tsx` mostra indicação visual só nas despesas com rateio customizado
