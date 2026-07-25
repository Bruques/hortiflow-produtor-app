# Task 11 — Resumo consolidado entre sociedades e despesa compartilhada

## Objetivo

Caso real trazido por um produtor da região: um financiador ("Luiz") tem uma terra grande com **vários meeiros trabalhando nela ao mesmo tempo**, cada um com seus próprios pés de morango, vendidos separadamente — ele sempre sabe de qual meeiro veio cada venda. O percentual de divisão combinado com cada meeiro pode ser diferente (ex: 60/40 com o Carlos, 70/30 com o Igor). Isso já é modelável hoje sem nenhuma mudança de schema: **uma Sociedade por par financiador+meeiro**, cada uma com sua própria Safra e seu próprio percentual fechado em 100%.

O problema é de usabilidade, não de modelo de dados: hoje o financiador não tem nenhuma tela que mostre "quanto tenho a receber, somando todos os meeiros" — precisa entrar em cada Safra separadamente. E despesas genuinamente compartilhadas entre meeiros (ex: um insumo ou trator usado na terra toda) exigem lançamento manual repetido e rateio de cabeça em cada Sociedade.

Esta task resolve os dois pontos **sem alterar `calcularDivisao`, o modelo de Acerto, nem a regra de percentuais somarem 100% por Sociedade** — mantendo o princípio do projeto de isolar o cálculo de divisão. Investigação completa e alternativas consideradas (Opção A: nenhuma mudança; Opção C: remodelar o domínio com sub-grupos dentro de uma Sociedade) ficaram registradas na conversa que originou esta spec; esta é a opção escolhida (Opção B).

## Escopo

**Entra:**
- Endpoint agregado que soma a simulação de todas as Safras ativas do usuário autenticado
- Tela inicial/resumo com alternância entre "Tudo" (soma consolidada) e "Esta sociedade" (comportamento atual, uma Safra por vez)
- Fluxo de lançamento de despesa compartilhada: escolher 2+ Safras do próprio usuário, um valor total, e um modo de rateio — o sistema cria uma `Despesa` normal em cada Safra selecionada, com o valor já prorateado

**Fica de fora (não implementar nesta task):**
- Qualquer mudança em `Venda`, `Despesa`, `SocioSociedade` ou `AcertoSocio` no schema — nenhum vínculo novo de "grupo"/"par" é criado
- Rateio proporcional a vendas do período ou a qualquer outro critério automático — só "igual entre as sociedades escolhidas" ou "percentual customizado informado manualmente" (ver Regras de negócio)
- Edição/exclusão em lote das despesas geradas por um lançamento compartilhado — cada uma vira uma Despesa independente, editável/excluível individualmente como qualquer outra (mesmo comportamento de hoje)
- Consolidar Acerto entre sociedades — cada Sociedade continua fechando Acerto separadamente
- Vendas compartilhadas — não existe caso de uso relatado para isso (o financiador sempre sabe de qual meeiro veio cada venda)

## Regras de negócio

### Resumo consolidado
- Considera apenas Safras com `status = EM_ANDAMENTO` em que o usuário autenticado é sócio (qualquer papel)
- Para cada Safra elegível, reaproveita a mesma lógica hoje usada por `GET /safras/:id/simulacao` (via `calcularDivisao`, sem alteração) para obter `receita`, `despesas`, `lucroLiquido` e o valor do próprio usuário naquela divisão (`meuValor`)
- O total consolidado é a soma de `meuValor` de todas as Safras elegíveis no período — não é uma soma de `lucroLiquido` (que pertenceria à sociedade inteira, não ao usuário)
- Aceita os mesmos parâmetros de período que `GET /safras/:id/simulacao` já aceita hoje (`periodo` predefinido ou `data_inicio`/`data_fim`), aplicados igualmente a todas as Safras somadas
- Se o usuário tem só 1 Safra ativa, o resumo consolidado e o resumo da sociedade única são idênticos — o filtro "Tudo vs. Esta sociedade" só aparece na tela quando há 2+ Safras ativas (mesmo critério que `HomePage` já usa hoje pra decidir se mostra o seletor de safras)

### Despesa compartilhada
- Quem lança escolhe 2 ou mais Safras dentre as suas próprias (`GET /safras` já existente) — não pode incluir uma Safra de outro usuário
- Todas as Safras escolhidas precisam estar com `status = EM_ANDAMENTO`
- Dois modos de rateio:
  - **Igual**: `valor_total / quantidade_de_safras`, com arredondamento de 2 casas decimais; a diferença de centavos por arredondamento (se houver) é absorvida pela primeira safra da lista
  - **Percentual customizado**: usuário informa um percentual por safra escolhida; a soma precisa fechar em 100% (mesma tolerância de 0.01 já usada em `sociedades.service.ts::atualizarPercentuais`)
- Para cada safra, cria uma `Despesa` normal via a mesma lógica de `despesas.service.ts::criarDespesa` — mesmo `tipo`, mesma `data`, mesma `foto_comprovante` (se houver) em todas, `valor` já prorateado, e `socio_id` = o usuário autenticado (quem lançou/a quem é atribuída, mesmo significado que despesa normal já tem hoje)
- A `descricao` de cada despesa gerada recebe um prefixo automático indicando que veio de um lançamento compartilhado e o valor total original, ex: `"[Rateio compartilhado de R$ 300,00] Adubo pra toda a terra"` — isso é só texto, não um campo novo de schema; depois de criada, a despesa é editável normalmente e perde essa rastreabilidade automática se o texto for apagado (aceitável para esta task — não há requisito de agrupar/desfazer em lote)
- Não gera nenhuma despesa em Safras não selecionadas nem em `DespesaPessoal`

## Contrato de API

```
GET /safras/resumo
  auth obrigatório
  query: periodo? (mesmos valores aceitos por GET /safras/:id/simulacao) | data_inicio? & data_fim?
  → 200 {
      totalReceber: number,
      safras: [{
        safra_id: string,
        safra_nome: string,
        sociedade_id: string,
        sociedade_nome: string,
        receita: number,
        despesas: number,
        lucroLiquido: number,
        meuValor: number
      }]
    }
  (só inclui safras EM_ANDAMENTO em que o usuário é sócio; lista vazia se não houver nenhuma)

POST /despesas/compartilhada
  auth obrigatório
  body: {
    safra_ids: string[],           // mínimo 2
    tipo: TipoDespesa,
    valor_total: number,
    data: string,
    descricao?: string,
    foto_comprovante?: string,
    rateio:
      | { modo: 'igual' }
      | { modo: 'percentual', percentuais: { safra_id: string, percentual: number }[] }
  }
  → 201 { despesas: [{ safra_id: string, despesa: { id, socio_id, tipo, valor, data, foto_comprovante, descricao } }] }
  → 422 se safra_ids tiver menos de 2 itens, se alguma safra não pertencer ao usuário ou não estiver EM_ANDAMENTO,
        se o modo for percentual e a soma não fechar em 100% (tolerância 0.01),
        ou se percentuais.safra_id não corresponder exatamente ao conjunto de safra_ids
```

## Decisão de schema a registrar

**Nenhuma mudança de schema nesta task.** `GET /safras/resumo` é resolvido inteiramente reaproveitando `calcularDivisao` e as buscas de despesas/vendas/sócios já existentes, uma vez por Safra elegível (chamadas em paralelo). `POST /despesas/compartilhada` só chama `despesas.service.ts::criarDespesa` N vezes — nenhuma tabela nova, nenhum campo novo em `Despesa` para "rastrear" que ela veio de um lançamento compartilhado (ver Regras de negócio sobre o prefixo em `descricao` como solução deliberadamente mais simples).

**Por que não criar uma tabela `LancamentoCompartilhado` pra agrupar as N despesas geradas:** o caso de uso relatado é só "lançar rápido, sem conta de cabeça" — não apareceu necessidade de editar/estornar o lote inteiro de uma vez. Adicionar uma tabela e uma FK nova em `Despesa` só pra isso seria complexidade sem requisito comprovado; se essa necessidade aparecer no futuro (ex: "cancelar essa despesa compartilhada em todas as sociedades de uma vez"), vira uma spec própria.

**Por que o rateio "por vendas do período" não entra:** exigiria decidir uma regra de negócio nova (proporcional a quê, exatamente, quando uma Safra ainda não teve nenhuma venda no período?) sem um caso de uso relatado que precise disso — os dois modos simples (igual / percentual manual) cobrem o que foi pedido.

## Critérios de aceite

1. Usuário com 1 única Safra ativa: `GET /safras/resumo` retorna a mesma coisa que `GET /safras/:id/simulacao` dessa Safra, só que no formato consolidado (`totalReceber` = `meuValor` daquela Safra)
2. Usuário com 2+ Safras ativas em sociedades diferentes: `GET /safras/resumo` retorna `totalReceber` igual à soma do `meuValor` de cada uma, e a lista `safras` traz uma entrada por safra com os totais individuais
3. Uma Safra `PLANEJADA` ou `ENCERRADA` não entra na soma nem na lista de `GET /safras/resumo`
4. Na tela inicial/resumo, com 2+ safras ativas, o filtro "Tudo" mostra o total consolidado e "Esta sociedade" volta ao comportamento atual (uma Safra por vez); com 0 ou 1 safra ativa, o filtro não aparece
5. `POST /despesas/compartilhada` com `rateio.modo = 'igual'`, `valor_total = 100` e 3 safras cria 3 despesas de R$33,33 / R$33,33 / R$33,34 (ou distribuição equivalente que feche em R$100,00 exatos)
6. `POST /despesas/compartilhada` com `rateio.modo = 'percentual'` cujos percentuais não somam 100% (tolerância 0.01) retorna 422 e não cria nenhuma despesa
7. `POST /despesas/compartilhada` incluindo uma `safra_id` que não pertence ao usuário autenticado retorna 422 e não cria nenhuma despesa (nem nas safras válidas da mesma requisição — tudo ou nada)
8. `POST /despesas/compartilhada` incluindo uma safra `PLANEJADA` ou `ENCERRADA` retorna 422
9. Cada despesa gerada aparece normalmente na tela de Despesas da sua respectiva Safra, com a `descricao` prefixada indicando o rateio, e pode ser editada/excluída individualmente como qualquer despesa comum — sem efeito nas demais despesas geradas pelo mesmo lançamento
10. `GET /safras/resumo` e `POST /despesas/compartilhada` não alteram em nada o comportamento de `GET /safras/:id/simulacao`, `calcularDivisao` ou `Acerto` já existentes (regressão zero nas specs 05 e 06)
