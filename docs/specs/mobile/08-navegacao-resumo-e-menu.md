# Mobile 08 — Casca de navegação, Resumo e Menu

## Objetivo

Fechar uma lacuna encontrada numa revisão das specs `00` a `07`: cada spec anterior cobre o **dado** de uma tela (painel de simulação na `05`, vendas na `06`, observações na `03`, sócios na `02`, regras/unidades na `06`, troca de senha na `01`), mas nenhuma delas assume a **composição final** de duas telas que já existem no web — a tela de Resumo (dashboard inicial da safra) e o Menu (hub de configurações) — nem a casca de navegação que dá acesso a elas (bottom nav + FAB). Sem esta spec, `03` a `07` ficariam implementadas mas sem um jeito de navegar entre elas, e a tela inicial da safra não existiria.

Esta spec **não introduz nenhum dado novo** — é composição pura sobre o que as specs anteriores já expõem. Depende de `01` a `07` já estarem implementadas (ou, no mínimo, dos serviços/telas que ela referencia).

## Escopo

**Entra:**
- **Casca de navegação** (equivalente ao `SafraLayout` + `BottomNavV2` do web): bottom nav fixa com 4 abas — **Resumo, Vendas, Despesas, Menu** — mais um **FAB central** que abre uma folha de opções ("Nova venda" / "Nova despesa"). Fonte de verdade pro conjunto de abas é `frontend/src/components/BottomNavV2.tsx`, não o texto antigo de `docs/design/notas-de-design.md` (corrigido nesta rodada — a 4ª aba é "Menu", não "Acertos")
- **Topbar**: logo + wordmark centralizados, sem hambúrguer nem sino (o web já removeu os dois — Menu virou aba própria, notificações não existem no produto ainda)
- **Tela de Resumo** (tela inicial da safra, aba "Resumo"): compõe, numa tela só, dados que já têm contrato de API definido em specs anteriores — nenhuma chamada nova:
  - Painel de simulação com period toggle (`GET /safras/:id/simulacao`, spec `05`): receita, despesas, lucro líquido, divisão por sócio
  - Lista "Vendas recentes" (até 5, do período selecionado) a partir de `GET /safras/:id/vendas` (spec `06`), filtrada client-side pelo mesmo período do painel
  - Observações da safra, se preenchidas (spec `03`)
- **Tela de Menu** (aba "Menu", hub de navegação): grade de cards levando pra telas já especificadas em specs anteriores — Despesas pessoais (`07`), Acertos (`05`), Sócios e Sociedade (`02`), Regras de Despesa (`06`), Unidades de Venda (`06`, só visível a `FINANCIADOR`/`MISTO`, mesma regra de autorização já definida lá), Conta e Senha (`01`), Abrir nova safra (`03`) — e o botão de Sair (logout, spec `01`)

**Fica de fora:**
- Qualquer dado ou regra de negócio nova — cada card/seção só aponta pra uma tela já especificada; se uma tela referenciada aqui ainda não foi implementada, o card correspondente fica sem link funcional até a spec dela ser feita (não é bloqueio pra esta spec)
- Notificações (sino) — não existe no produto, nem no web

## Regras de negócio

### Composição sem endpoint novo
Todo dado desta spec já tem contrato de API definido em outra spec — esta spec só decide **layout e navegação**. Se uma tela precisar de um dado que nenhuma spec anterior expõe, isso é sinal de que falta atualizar a spec dona daquele dado, não de criar lógica nova aqui.

### Resumo: mesmo padrão de offline das specs que ele compõe
- O painel de simulação segue exatamente a regra já definida na spec `05` (cache do último resultado, sem recalcular no cliente)
- "Vendas recentes" usa a mesma lista/cache já definida na spec `06`, só filtrada visualmente pelo período do painel — não é uma chamada nova, é reaproveitamento client-side da lista já carregada
- Observações usam o cache já definido na spec `03`

### Menu: papel na autorização
- O card "Unidades de Venda" só aparece pra sócio com papel `FINANCIADOR` ou `MISTO` (mesma checagem já usada no web `MenuPage.tsx`, espelhando a autorização definida na spec `06`) — os demais cards aparecem pra qualquer papel, porque as telas que eles abrem já fazem sua própria checagem de autorização (ex: só o financiador consegue editar uma regra, mas qualquer sócio pode ver a lista)

### FAB e folha de opções
- Disponível em qualquer aba da casca de navegação (não some ao trocar de aba)
- Abre direto na tela de criar Despesa (spec `04`) ou Venda (spec `06`) — não duplica formulário, só atalho de navegação
- Mesmo princípio do web: **não aparece em telas de formulário em tela cheia** (nova/editar), pra não competir visualmente com o botão de salvar

## Contrato de API

Nenhum — esta spec não introduz chamada nova. Reaproveita:
- `GET /safras/:id/simulacao` (spec `05`)
- `GET /safras/:id/vendas` (spec `06`)
- Dado de `observacoes` já presente no objeto Safra (spec `03`)

## Critérios de aceite

1. Dado o usuário dentro de uma safra, a bottom nav mostra as 4 abas corretas (Resumo, Vendas, Despesas, Menu) e o FAB central
2. Tocar no FAB abre a folha "Nova venda"/"Nova despesa"; tocar em qualquer uma navega pra tela correspondente (spec `04`/`06`)
3. A tela de Resumo mostra, para o período selecionado: receita, despesas, lucro líquido, divisão por sócio, até 5 vendas recentes e a observação da safra (quando preenchida)
4. Trocar o period toggle no Resumo atualiza o painel e a lista de vendas recentes de forma consistente (mesmo período nos dois)
5. A tela de Menu mostra todos os cards, exceto "Unidades de Venda" quando o sócio autenticado é `MEEIRO`
6. Tocar em cada card do Menu navega pra tela correspondente já especificada em outra spec
7. Tocar em "Sair" no Menu desloga (mesmo comportamento já definido na spec `01`)
8. Em uma tela de formulário em tela cheia (nova despesa, nova venda etc.), a bottom nav e o FAB não aparecem
9. Revisão de código confirma que nenhuma chamada de API nova foi introduzida por esta spec — só composição de dados já buscados por outras specs

## Decisões registradas durante a implementação

*(preencher durante a implementação, seguindo o mesmo padrão das specs `01` a `13` — decisões não previstas aqui entram nesta seção, não são resolvidas silenciosamente)*
