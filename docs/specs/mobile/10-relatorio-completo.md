# Task 10 (mobile) — Relatório completo do período

## Objetivo

Portar pro app mobile a tela "Relatório completo" já implementada no web (`docs/specs/21-relatorio-completo.md`): dashboard de leitura do período com receita, despesas, lucro líquido, divisão entre sócios, quantidade vendida e preço médio por unidade, e despesas por categoria. Mesmo endpoint do web, mesma regra de negócio — esta spec cobre só o que é específico da plataforma mobile (navegação, cache local, comportamento offline).

## Escopo

**Entra:**
- Card "Relatório completo" na grade do Menu (`MenuScreen.tsx`), visível para qualquer sócio (financiador ou meeiro) — sem restrição de papel, igual ao web
- Tela nova `RelatorioCompletoScreen.tsx`, empilhada fora da casca de navegação (como `AcertosScreen`/`RelatorioScreen`), com cabeçalho próprio e seta de voltar
- Reaproveita `GET /safras/:id/relatorio-completo` (nenhum endpoint novo) e os mesmos componentes `PeriodToggle`/`PeriodoAvancadoButton` já usados no Resumo
- Cache local em SQLite (`relatorio_completo_cache`), seguindo o mesmo padrão cache-then-network de `simulacaoCache.ts`/`ResumoScreen.tsx`

**Fica de fora:**
- Qualquer cálculo novo — o endpoint já existe e não muda (task 21, web)
- PDF/exportação — isso é o `RelatorioScreen.tsx` existente, sem alteração

## Comportamento offline

Tela de leitura, não de escrita — não envolve fila de sincronização. Segue o padrão já estabelecido:
- Ao abrir, lê primeiro o cache local (SQLite) da combinação safra+filtro de período e mostra imediatamente, sem esperar rede
- Em paralelo, tenta buscar dados novos do backend; em sucesso, atualiza tela e cache
- Se a request falhar (sem conexão): mantém o que já estava mostrando; se havia cache, exibe aviso "Atualizado às HH:MM — sem conexão" (mesmo texto/padrão de `AcertosScreen.tsx`); se não havia nada em cache pra esse período, mostra "Nenhum dado salvo — conecte-se à internet para carregar o relatório." — nunca finge que a tela está atualizada
- `BannerSemConexao` (banner fixo no topo) montado igual às demais telas fora da casca

## Contrato de API

Mesmo de `docs/specs/21-relatorio-completo.md` (web) — nenhuma mudança:

```
GET /safras/:id/relatorio-completo
  auth obrigatório, requer ser sócio (qualquer papel) da sociedade dona da safra
  query: periodo=dia|semana|mes|safra  OU  data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
```

## Critérios de aceite

1. Card "Relatório completo" aparece no Menu para qualquer sócio (financiador ou meeiro), navegando pra `RelatorioCompletoScreen`
2. Com conexão, a tela busca e mostra receita, despesas, lucro líquido, divisão por sócio, vendas por unidade com preço médio e despesas por categoria do período selecionado
3. Trocar o período (dia/semana/mês/personalizado) refaz a busca e atualiza a tela
4. Sem conexão e com cache salvo desse período: tela mostra os últimos dados salvos com aviso "Atualizado às HH:MM — sem conexão", sem travar
5. Sem conexão e sem cache desse período: tela mostra "Nenhum dado salvo — conecte-se à internet para carregar o relatório.", sem travar nem mostrar dado desatualizado como se fosse atual
6. Reabrir a tela mais tarde, já com conexão, atualiza silenciosamente o cache e os números — sem exigir ação do usuário
