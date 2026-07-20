# Task 5 — Cálculo de divisão e painel de simulação

## Objetivo

Dar a cada sócio (financiador ou meeiro) uma visão em tempo real de "quanto cada um tem a receber", calculada a partir das Despesas e Vendas já lançadas na Safra, filtrável por período (dia, semana, mês ou safra inteira). É o coração da proposta de valor do produto — substitui a prestação de contas manual e opaca por um número que todos os sócios enxergam e conferem juntos.

Esta task **não** grava nada novo no banco — é leitura pura sobre dados já existentes (Despesa, Venda, SocioSociedade). O registro formal de "os sócios se acertaram" fica pra task 6 (Acerto), que vai reaproveitar esse mesmo cálculo como snapshot.

## Escopo

**Entra:**
- Service puro `calcularDivisao(despesas, vendas, socios)` — recebe listas já filtradas por período, devolve o lucro líquido e o valor de cada sócio
- Rota que aceita filtro de período (dia/semana/mês/safra inteira, ou datas customizadas) e devolve o resultado do cálculo pra aquela Safra
- Tela de painel com seletor de período mostrando: receita, despesas, lucro líquido e a divisão por sócio (nome, percentual, valor)
- Mesma visão para financiador e meeiro (transparência total, sem dado oculto)

**Fica de fora (não implementar nesta task):**
- Persistir o resultado do cálculo (isso é o que o Acerto faz — task 6)
- Reembolso de quem bancou a despesa antes de dividir o restante (variação mencionada no CLAUDE.md como "a confirmar" — fórmula base atual só aplica o percentual sobre o lucro líquido; o modelo de dados já suporta a variação depois, mas não é implementada agora)
- Fórmula de divisão configurável por sociedade (Fase 2)
- Considerar `DespesaPessoal` no cálculo (por definição, nunca entra — CLAUDE.md é explícito nisso)
- Considerar `AporteTrabalho` no cálculo (é informativo, não monetário, nas perguntas em aberto)

## Regras de negócio

### Service `calcularDivisao`

Vive isolado em `backend/src/services/divisao.service.ts`, sem acoplamento a Express/Prisma — recebe dados já buscados e devolve um resultado, pra trocar a fórmula depois ser mudança em um arquivo só (regra crítica do CLAUDE.md).

```ts
function calcularDivisao(
  despesas: { valor: number }[],
  vendas: { total: number }[],
  socios: { socio_id: string; nome: string; percentual_lucro: number }[]
): {
  receita: number;
  despesasTotal: number;
  lucroLiquido: number;
  divisao: { socio_id: string; nome: string; percentual: number; valor: number }[];
}
```

- `receita` = soma de `venda.total` no período
- `despesasTotal` = soma de `despesa.valor` no período (de todos os sócios, não só o filtrado)
- `lucroLiquido` = `receita - despesasTotal` (pode ser negativo — sociedade no prejuízo no período; o cálculo não trava nesse caso, só reflete o número)
- `divisao[i].valor` = `lucroLiquido × (percentual_lucro / 100)`, um item por sócio da Sociedade, mesmo que `lucroLiquido` seja negativo

### Rota de consulta

- `GET /safras/:id/simulacao?periodo=dia|semana|mes|safra` (ou `?data_inicio=&data_fim=` para intervalo customizado — usado internamente pelo Acerto na task 6, mas já exposto aqui pra não repetir a decisão depois)
- Requer ser sócio da Sociedade dona da Safra (mesma autorização de sempre)
- `periodo=dia` → hoje (00:00 a 23:59 do dia atual)
- `periodo=semana` → semana corrente (segunda a domingo, contendo hoje)
- `periodo=mes` → mês corrente
- `periodo=safra` → sem filtro de data, todas as Despesas/Vendas da Safra
- Se nenhum `periodo` nem `data_inicio`/`data_fim` for passado: erro 400 (evita ambiguidade sobre o que mostrar por padrão)
- O controller busca as Despesas e Vendas da Safra no intervalo, busca os `SocioSociedade` da Sociedade, e repassa pro service — nenhuma lógica de soma/divisão fora do service

## Contrato de API

```
GET /safras/:id/simulacao?periodo=dia|semana|mes|safra
GET /safras/:id/simulacao?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
  auth obrigatório, requer ser sócio da sociedade dona da safra
  → 200 {
      periodo: { data_inicio: string, data_fim: string },
      receita: number,
      despesas: number,
      lucroLiquido: number,
      divisao: [{ socio_id, nome, percentual, valor }]
    }
  → 400 se nenhum filtro de período for informado
  → 403 se não for sócio
```

## Decisões registradas durante a implementação

- **Campo `caixasVendidas` na resposta de `GET /safras/:id/simulacao`** (adicionado durante o redesenho da tela de Início, `docs/design/notas-de-design.md`): o card "Caixas vendidas" do dashboard precisa do total de caixas do período, que não existia na resposta original. Somado no controller a partir da lista de vendas já buscada pro período (`vendas.reduce(...)`), sem tocar em `calcularDivisao` — mantém o service de divisão isolado e focado só em valores monetários, conforme a regra crítica do CLAUDE.md.
- **Filtro de data personalizada no painel de Início** (item de backlog, 2026-07-20): até aqui o `PeriodToggle` só oferecia Hoje/Semana/Mês/Safra — o usuário não conseguia ver, por exemplo, só o dia de ontem. O backend já suportava `data_inicio`/`data_fim` (rota já documentada acima), então a lacuna era só de UI. Solução: um ícone de calendário ao lado do `PeriodToggle` (não um 5º botão dentro dele, pra não apertar o toggle em telas mobile) que abre uma sheet com dois `DatePickerField` (data início/fim) e reaproveita `buscarSimulacaoPersonalizadaRequest` (já existente, usado até então só pela tela de Acertos). Ao confirmar um intervalo personalizado, nenhum botão do toggle fica marcado; o ícone passa a mostrar a data (ou intervalo) escolhido no lugar do ícone genérico.
  - Escopo desta rodada: só a tela de Início (`ResumoPage.tsx`). O `PeriodToggle` também é usado em Despesas/Vendas/Despesas Pessoais, mas ali como filtro client-side sobre listas já carregadas (`lib/periodo.ts`), sem chamar a API — aplicar o mesmo filtro personalizado lá é trabalho futuro (pedido explícito do dev de já deixar o componente pronto para essa reutilização).

## Decisão de arquitetura a registrar

Nenhuma mudança de schema — reaproveita `Despesa`, `Venda` e `SocioSociedade` já existentes.

**Por que o service recebe listas já filtradas em vez de buscar do banco:** mantém o service puro e testável sem mock de Prisma, e deixa claro que "filtrar por período" é responsabilidade do controller/repositório, não da regra de negócio de divisão — reforça o isolamento pedido no CLAUDE.md.

**Por que expor `data_inicio`/`data_fim` customizados além dos atalhos de período:** a task 6 (Acerto) vai precisar calcular sobre um intervalo arbitrário (do último Acerto até hoje, por exemplo) — expor isso agora evita decidir de novo depois, e a rota já nasce pronta pro uso que o Acerto vai fazer dela.

## Critérios de aceite

1. Dado uma Safra com Despesas somando R$300 e Vendas somando R$500, `calcularDivisao` retorna `lucroLiquido = 200`
2. Dado dois sócios com 60% e 40%, a divisão retorna R$120 e R$80 respectivamente para um lucro de R$200
3. Se despesas > vendas no período, `lucroLiquido` é negativo e a divisão reflete valores negativos (sem erro)
4. `GET /safras/:id/simulacao?periodo=dia` retorna só despesas/vendas de hoje
5. `GET /safras/:id/simulacao?periodo=semana` retorna despesas/vendas da semana corrente
6. `GET /safras/:id/simulacao?periodo=safra` retorna despesas/vendas de toda a Safra, sem filtro de data
7. `GET /safras/:id/simulacao` sem nenhum filtro retorna 400
8. Um sócio com papel `MEEIRO` vê exatamente o mesmo resultado que um `FINANCIADOR` veria para o mesmo período (nenhum dado oculto)
9. Frontend: tela de painel com seletor de dia/semana/mês/safra, mostrando receita, despesas, lucro líquido e a divisão por sócio (nome, percentual, valor)
10. Frontend (Início): ao lado do `PeriodToggle`, um ícone de calendário abre uma sheet para escolher data início e data fim; ao confirmar, o painel recalcula usando `data_inicio`/`data_fim` (via `buscarSimulacaoPersonalizadaRequest`) e nenhum botão do toggle fica marcado como selecionado
11. Frontend (Início): ao voltar a tocar em Hoje/Semana/Mês/Safra depois de um filtro personalizado, o painel volta a usar `periodo=` normalmente e o ícone de calendário volta ao estado neutro
