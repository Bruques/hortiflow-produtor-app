# Task 21 — Relatório completo do período (dashboard no app)

## Objetivo

Dar a qualquer sócio (financiador ou meeiro) uma tela dentro do app com uma visão completa do período selecionado — receita, despesas, lucro líquido, divisão entre sócios, quantidade vendida e preço médio por unidade, e despesas quebradas por categoria. Diferente do PDF da task 15 (documento formal pra contadora, restrito a quem banca a produção), esta é uma tela de consulta rápida, pros dois lados da parceria acompanharem o próprio negócio — mesmo espírito de transparência total que já vale pra despesas e vendas.

## Escopo

**Entra:**
- Card "Relatório" na grid do Menu (`MenuPage.tsx`), visível para **todos** os sócios da safra ativa (sem a restrição de papel que o card "Gerar relatório" PDF tem)
- Tela nova `RelatorioCompletoPage.tsx`, reaproveitando o mesmo `PeriodToggle` + `PeriodoAvancadoButton` já usados em Resumo/Despesas/Vendas (dia, semana, mês, safra inteira, período customizado)
- Endpoint novo no backend que devolve os agregados do período: receita, despesas, lucro líquido, divisão por sócio, quantidade vendida por unidade, **preço médio por unidade** (novo cálculo) e **despesas por categoria** (novo agrupamento)
- Web primeiro; mobile fica para spec futura reaproveitando o mesmo endpoint (`docs/specs/mobile/`)

**Fica de fora (não implementar nesta task):**
- Qualquer exportação/PDF — isso já existe e continua como está (task 15), sem alteração
- Despesa Pessoal — nunca entra em nada da Sociedade, mesma regra do resto do produto
- Comparação com período anterior (ex: "▲ 12% vs mês passado") — fica pra uma task futura
- Gráficos (linha, pizza, etc.) — MVP é cards e listas com números, sem introduzir biblioteca de charts nova; se fizer falta depois de usar em produção, vira task própria
- Qualquer cálculo novo de divisão — reaproveita `calcularDivisao` (task 5) sem alterá-lo

## Regras de negócio

### Quem acessa

Qualquer sócio (`FINANCIADOR`, `MEEIRO` ou `MISTO`) da sociedade dona da safra — sem restrição de papel. Diferente do PDF da task 15 (documento de saída que o financiador leva à contadora), esta tela é só consulta, e a transparência total pro meeiro já é o valor central do produto (ele já vê todas as despesas e vendas hoje).

### Período

Mesma resolução de período já usada em Simulação/Acerto/Relatório PDF (`backend/src/lib/periodo.ts`, `resolverPeriodo` + `filtroDataPrisma`) — sem lógica de data nova.

### Preço médio por unidade

Para cada unidade de venda (`unidade_id`) com vendas no período: `media_preco = soma(total das vendas daquela unidade) / soma(quantidade daquela unidade)`. Não é a média simples do campo `preco` das vendas — dividir a soma dos totais pela soma das quantidades pondera corretamente vendas de tamanhos diferentes (ex: uma venda de 10 caixas a R$50 não deve pesar igual a uma de 1 caixa a R$50 na média).

### Despesas por categoria

Soma das despesas do período agrupada por `TipoDespesa` (`TERRA`, `MUDAS`, `ADUBO`, `DEFENSIVOS`, `MAO_DE_OBRA`, `EMBALAGEM`, `TRANSPORTE`, `OUTRO`). Cada categoria retorna o valor total e o percentual sobre o total de despesas do período. Categoria sem nenhuma despesa no período não aparece na resposta (não retorna zero).

### Despesa Pessoal

Nunca entra em nenhum número desta tela — mesma regra do resto do produto (ver `calcularDivisao` e Acerto).

## Contrato de API

```
GET /safras/:id/relatorio-completo
  auth obrigatório, requer ser sócio (qualquer papel) da sociedade dona da safra
  query: periodo=dia|semana|mes|safra  OU  data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
  → 200
    {
      periodo: { data_inicio: string | null, data_fim: string | null },
      receita: number,
      despesas: number,
      lucroLiquido: number,
      divisao: [{ socio_id, nome, percentual, valor }],
      quantidadePorUnidade: [{ unidade_id, unidade_nome, quantidade }],
      mediaPrecoPorUnidade: [{ unidade_id, unidade_nome, media_preco }],
      despesasPorCategoria: [{ tipo, valor, percentual }]
    }
  → 400 se nem periodo nem par data_inicio/data_fim válido
  → 403 se não for sócio da sociedade
  → 404 se a safra não existe
```

Endpoint próprio (não estende `GET /safras/:id/simulacao`) para não inflar o payload das telas que já consomem simulação com frequência (Home, Resumo) com dados que só esta tela usa. Internamente reaproveita os mesmos helpers do controller de simulação (`resolverPeriodo`, `filtroDataPrisma`, `calcularDivisao`, `mapearRateioParaDivisao`).

## Contrato de frontend

- Novo card na grid do `MenuPage.tsx` — título "Relatório", subtítulo curto (ex: "Receita, despesas e mais"), fora do bloco condicional `souFinanciador`, para aparecer pra todos os sócios
- `RelatorioCompletoPage.tsx` (rota `/safras/:id/relatorio-completo`): `PeriodToggle` no topo, seguido de cards/listas com os blocos: resumo (receita/despesas/lucro), divisão por sócio, vendas por unidade (quantidade + preço médio), despesas por categoria
- Sem exportação/download nesta tela — é só leitura

## Critérios de aceite

1. Dado uma safra com despesas e vendas lançadas, `GET /safras/:id/relatorio-completo?periodo=mes` chamado por um sócio `MEEIRO` retorna 200 com os mesmos totais de receita/despesas/lucro/divisão que `GET /safras/:id/simulacao?periodo=mes` retornaria
2. O mesmo endpoint chamado por `FINANCIADOR` ou `MISTO` também retorna 200 (sem restrição de papel)
3. Chamado por alguém que não é sócio da sociedade, retorna 403
4. `mediaPrecoPorUnidade` bate com `soma(total)/soma(quantidade)` calculado manualmente a partir das vendas do período, por unidade
5. `despesasPorCategoria` soma corretamente por `TipoDespesa` e os percentuais somam 100% do total de despesas do período (arredondamento à parte); categoria sem despesa no período não aparece na lista
6. `data_inicio=2026-07-01&data_fim=2026-07-31` filtra despesas e vendas só dentro do intervalo, mesma resolução de período já usada em Simulação
7. Sem `periodo` nem par `data_inicio`/`data_fim` válido, retorna 400
8. Despesa Pessoal nunca aparece em nenhum número da resposta, independente do período
9. Frontend: card "Relatório" visível no Menu para qualquer sócio (financiador ou meeiro); a tela reaproveita o `PeriodToggle`/`PeriodoAvancadoButton` já usado em Resumo/Despesas/Vendas, sem filtro novo
