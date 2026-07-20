# Task 3 — Safra, despesas e despesa pessoal

## Objetivo

Permitir que os sócios de uma Sociedade abram uma Safra, lancem despesas da sociedade nela (que futuramente entram na divisão de lucro) e, separadamente, cada sócio controle suas próprias despesas pessoais — que não têm nenhuma relação com a conta da sociedade. É a base para as tasks seguintes (Vendas, cálculo de divisão, Acerto), que dependem de Safra e Despesa já existirem.

## Escopo

**Entra:**
- Abrir Safra numa Sociedade (nome, vira `EM_ANDAMENTO`)
- Encerrar Safra (vira `ENCERRADA`) — encerramento simples nesta task, sem exigir Acerto final (isso é regra da task 6)
- Listar Safras de uma Sociedade
- Despesa da sociedade: criar, listar (por Safra), com sócio obrigatório, tipo, valor, data, foto de comprovante opcional
- Despesa Pessoal: criar, listar, editar, excluir — vinculada à Safra ativa e ao usuário autenticado, nunca visível a outros sócios
- Autorização: toda rota de Safra/Despesa exige que o usuário seja sócio da Sociedade dona da Safra

**Fica de fora (não implementar nesta task):**
- Venda e RegraDespesaRecorrente (task 4)
- Cálculo de divisão / painel de simulação (task 5)
- Acerto (task 6)
- Edição/exclusão de Despesa da sociedade (não pedido no roadmap; só criar/listar por ora — evita reabrir discussão de "quem pode editar despesa lançada por outro sócio", que está nas perguntas em aberto do CLAUDE.md)
- Upload real de foto para storage externo (S3 etc.) — nesta task o campo `foto_comprovante` aceita uma URL/string simples; a captura via câmera do celular fica pro polimento mobile (task 7)
- Múltiplas Safras simultâneas `EM_ANDAMENTO` na mesma Sociedade — nesta task não há trava impedindo isso, mas o fluxo natural é uma por vez (decisão a revisitar se virar problema real)

## Regras de negócio

### Abrir Safra
- `POST /sociedades/:id/safras` com `{ nome }`, autenticado, requer ser sócio da Sociedade `:id`
- Cria a Safra com `status = EM_ANDAMENTO` e `data_inicio = now()`

### Encerrar Safra
- `PATCH /safras/:id/encerrar`, autenticado, requer ser sócio da Sociedade dona da Safra
- Muda `status` para `ENCERRADA` e grava `data_fim = now()`
- Se a Safra já estiver `ENCERRADA`: 409

### Listar Safras
- `GET /sociedades/:id/safras` — lista as Safras da Sociedade, requer ser sócio

### Despesa da sociedade
- `POST /safras/:id/despesas` com `{ socio_id, tipo, valor, data, foto_comprovante? }`, autenticado, requer ser sócio da Sociedade dona da Safra
- `socio_id` precisa ser um sócio da mesma Sociedade (não necessariamente quem está autenticado — qualquer sócio pode lançar despesa em nome de outro, já que no MVP não há permissões granulares; trilha de auditoria fica por conta do `criado_em` + o autor fica implícito no JWT, mas o campo relevante pro cálculo é sempre `socio_id`)
- `valor` positivo, `data` obrigatória
- `GET /safras/:id/despesas` — lista despesas da Safra, requer ser sócio; retorna todas as despesas de todos os sócios (transparência total, conforme jornada do meeiro no CLAUDE.md)

### Despesa Pessoal
- `POST /safras/:id/despesas-pessoais` com `{ tipo, valor, data, descricao? }`, autenticado, requer ser sócio da Sociedade dona da Safra
- Sempre criada com `usuario_id = req.usuarioId` — não existe campo pra lançar despesa pessoal em nome de outro usuário
- `GET /safras/:id/despesas-pessoais` — lista **só as despesas pessoais do usuário autenticado** nessa Safra (nunca as de outro sócio, mesmo que ele seja sócio da mesma Sociedade)
- `PUT /despesas-pessoais/:id` e `DELETE /despesas-pessoais/:id` — só o dono (`usuario_id`) pode editar/excluir; outro usuário tentando: 403
- Despesa Pessoal **nunca** aparece em nenhuma rota/listagem de despesa da sociedade, e não é somada em nenhum cálculo de divisão (reforça a regra do CLAUDE.md: cálculo de divisão isolado)

## Contrato de API

```
POST /sociedades/:id/safras
  auth obrigatório, requer ser sócio da sociedade :id
  body: { nome: string }
  → 201 { safra: { id, nome, status, data_inicio } }
  → 403 se não for sócio

PATCH /safras/:id/encerrar
  auth obrigatório, requer ser sócio da sociedade dona da safra
  → 200 { safra: { id, status, data_fim } }
  → 403 se não for sócio
  → 409 se já estiver encerrada

GET /sociedades/:id/safras
  auth obrigatório, requer ser sócio da sociedade :id
  → 200 { safras: [{ id, nome, status, data_inicio, data_fim }] }
  → 403 se não for sócio

POST /safras/:id/despesas
  auth obrigatório, requer ser sócio da sociedade dona da safra
  body: { socio_id: string, tipo: TipoDespesa, valor: number, data: string, foto_comprovante?: string }
  → 201 { despesa: { id, socio_id, tipo, valor, data, foto_comprovante } }
  → 422 se socio_id não for sócio da sociedade dona da safra
  → 403 se autenticado não for sócio

GET /safras/:id/despesas
  auth obrigatório, requer ser sócio da sociedade dona da safra
  → 200 { despesas: [{ id, socio_id, socio_nome, tipo, valor, data, foto_comprovante }] }
  → 403 se não for sócio

POST /safras/:id/despesas-pessoais
  auth obrigatório, requer ser sócio da sociedade dona da safra
  body: { tipo: TipoDespesa, valor: number, data: string, descricao?: string }
  → 201 { despesaPessoal: { id, tipo, valor, data, descricao } }
  → 403 se não for sócio

GET /safras/:id/despesas-pessoais
  auth obrigatório, requer ser sócio da sociedade dona da safra
  → 200 { despesasPessoais: [...] } (só do usuário autenticado)
  → 403 se não for sócio

PUT /despesas-pessoais/:id
  auth obrigatório, requer ser o dono da despesa pessoal
  body: { tipo?, valor?, data?, descricao? }
  → 200 { despesaPessoal: {...} }
  → 403 se não for o dono

DELETE /despesas-pessoais/:id
  auth obrigatório, requer ser o dono da despesa pessoal
  → 204
  → 403 se não for o dono
```

## Decisão de schema a registrar

O schema atual (task 1) já tem `Safra`, `Despesa`, `TipoDespesa`, `StatusSafra`. Falta o model de Despesa Pessoal:

```prisma
model DespesaPessoal {
  id         String      @id @default(uuid())
  safra_id   String
  usuario_id String
  tipo       TipoDespesa
  valor      Decimal     @db.Decimal(10, 2)
  data       DateTime
  descricao  String?
  criado_em  DateTime    @default(now())

  safra   Safra   @relation(fields: [safra_id], references: [id])
  usuario Usuario @relation(fields: [usuario_id], references: [id])

  @@map("despesas_pessoais")
}
```

Reaproveita o enum `TipoDespesa` já existente (mesmas categorias fazem sentido pra gasto pessoal de produtor rural). Vai gerar uma nova migração Prisma.

## Adendo (2026-07-16) — campo `descricao` na Despesa da sociedade

Origem: item de backlog — ao lançar despesa com tipo `OUTRO`, o sócio não tinha onde identificar do que se tratava o gasto, perdendo controle sobre esse "outro".

Decisão registrada com o desenvolvedor:
- `Despesa` (sociedade) ganha um campo `descricao String?`, mesmo padrão já existente em `DespesaPessoal` — reaproveita o modelo, sem model novo
- **Opcional para qualquer tipo**, não só `OUTRO` — evita reabrir a tela em duas variações (com/sem campo) dependendo da categoria escolhida
- Exibido **apenas na lista/histórico de despesas** da Safra (como detalhe abaixo do tipo), como texto auxiliar — não entra no cálculo de divisão, não aparece no painel de simulação nem é copiado pro snapshot de Acerto nesta rodada (pode ser revisitado depois se virar necessidade real)

Contrato afetado:
```
POST /safras/:id/despesas
  body: { socio_id, tipo, valor, data, foto_comprovante?, descricao? }

GET /safras/:id/despesas
  → despesas: [{ ..., descricao }]
```

Schema Prisma (`model Despesa`): adicionar `descricao String?`, nova migração.

## Adendo (2026-07-20) — filtro de período personalizado nas listas de Despesas e Despesas Pessoais

Origem: mesmo item de backlog do adendo de `05-calculo-e-painel-simulacao.md` (usuário não conseguia filtrar a lista por uma data avulsa, ex: ontem), estendido às telas `DespesasPage` e `DespesasPessoaisPage` depois de validado no painel de Início.

- Reaproveita o `PeriodoPersonalizadoButton` já construído pro painel de Início — mesmo ícone de calendário abaixo do `PeriodToggle`, mesma sheet com duas datas (início/fim)
- Diferença em relação ao painel de Início: aqui o filtro é **client-side**, sobre a lista já carregada da Safra inteira (`GET /safras/:id/despesas` e `GET /safras/:id/despesas-pessoais` não aceitam filtro de período — nunca aceitaram, mesmo antes deste adendo)
- Nova função `dataEstaNoIntervalo(dataISO, dataInicio, dataFim)` em `frontend/src/lib/periodo.ts`, ao lado de `dataEstaNoPeriodo` — mesma comparação por dia em UTC, mas contra um intervalo arbitrário em vez dos atalhos fixos
- Nenhuma mudança de contrato de API nem de schema

## Critérios de aceite

1. Dado um sócio de uma Sociedade, `POST /sociedades/:id/safras` cria a Safra com status `EM_ANDAMENTO`
2. Dado um usuário que não é sócio, `POST /sociedades/:id/safras` retorna 403
3. `GET /sociedades/:id/safras` lista as Safras da Sociedade
4. `PATCH /safras/:id/encerrar` muda o status para `ENCERRADA`; chamando de novo retorna 409
5. Dado uma Safra em andamento, `POST /safras/:id/despesas` com `socio_id` de um sócio válido da mesma Sociedade cria a despesa
6. Dado um `socio_id` que não pertence à Sociedade dona da Safra, `POST /safras/:id/despesas` retorna 422
7. `GET /safras/:id/despesas` retorna despesas de **todos** os sócios da Safra (não só do usuário autenticado) — confirma a transparência total do produto
8. Dado dois sócios A e B na mesma Safra, cada um lança sua própria despesa pessoal; `GET /safras/:id/despesas-pessoais` autenticado como A retorna só as despesas de A, nunca as de B
9. Dado uma despesa pessoal de A, o usuário B tentando `PUT` ou `DELETE` nela recebe 403
10. Nenhuma despesa pessoal aparece em `GET /safras/:id/despesas` (sociedade) e vice-versa
11. Frontend: tela pra abrir/encerrar Safra, tela de lançamento e lista de despesas da sociedade (mobile-first), e uma aba separada "Minhas despesas pessoais" com CRUD simples, deixando visualmente clara a separação entre as duas contas
