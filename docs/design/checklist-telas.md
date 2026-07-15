# Checklist de implementação — telas do wireframe

Uma tela (ou componente compartilhado) por vez, igual ao fluxo de SDD do `CLAUDE.md`: spec → aprovação → código → verificação. Marque `[x]` conforme for concluindo, numa sessão nova a cada item.

**Como pedir**: "vamos implementar a tela de X" — a sessão nova só precisa ler `docs/design/notas-de-design.md` (decisões visuais) e a spec relacionada abaixo (regras de negócio). Não precisa colar este arquivo inteiro nem o histórico da conversa de design.

## 0. Componentes compartilhados (fazer antes das telas que dependem deles)

- [ ] **Bottom nav v2 + FAB + bottom sheet** — 4 abas + botão central, folha de opções Nova venda/Nova despesa. Usado em Início, Despesas, Vendas, Acertos.
- [ ] **Period toggle** (Hoje/Semana/Mês/Safra) — usado em Início, Despesas, Vendas. Depende do `calcularDivisao` já existente (task 5, `docs/specs/05-calculo-e-painel-simulacao.md`), só variando o filtro de data.
- [ ] **Topbar** (menu + logo + notificações) — usado em toda tela com bottom nav.

## 1. Telas

- [ ] **Login** — spec: `docs/specs/01-setup.md` (auth telefone+senha). Provavelmente já implementada; conferir se o visual bate com o wireframe ou se é só ajuste de estilo.
- [ ] **Início** — spec: `docs/specs/05-calculo-e-painel-simulacao.md`. Depende do Period toggle e da Bottom nav v2 (item 0). Cards: Receita, Despesas, Lucro líquido, Caixas vendidas + Divisão do lucro + Atalhos rápidos.
- [ ] **Despesas (lista)** — spec: `docs/specs/03-safra-despesas-e-despesa-pessoal.md` + `docs/specs/04-vendas-e-despesa-recorrente.md` (card de sugestão `por_periodo`).
- [ ] **Vendas (lista)** — spec: `docs/specs/04-vendas-e-despesa-recorrente.md` (selo de despesa automática `por_venda`).
- [ ] **Nova despesa** — spec: `docs/specs/03-safra-despesas-e-despesa-pessoal.md`.
- [ ] **Nova venda** — spec: `docs/specs/04-vendas-e-despesa-recorrente.md`.
- [ ] **Acertos (histórico)** — spec: `docs/specs/06-acerto.md`.
- [ ] **Extrato do acerto** — spec: `docs/specs/06-acerto.md`.
- [ ] **Registrar acerto** — spec: `docs/specs/06-acerto.md`. ⚠️ Campo de comprovante de pagamento precisa de migration nova (ver pendência em `notas-de-design.md`) — resolver isso antes ou tratar como sub-tarefa separada.
- [ ] **Configurações** (percentuais + regras recorrentes) — specs: `docs/specs/02-sociedade-e-socios.md` (percentuais, código de convite) + `docs/specs/04-vendas-e-despesa-recorrente.md` (regras). Pode já existir como telas separadas no código atual; esta é a versão consolidada numa tela só.
- [ ] **Splash / Carregando** — usa `frontend/src/assets/Logo hortiflow.png` direto, sem depender de spec funcional.

## Observação

As specs de 01 a 07 já foram implementadas (ver commits `Task 3` a `Task 7`). Isso significa que boa parte deste trabalho é **redesign visual de telas que já existem e funcionam**, não funcionalidade nova — então cada sessão deve começar conferindo o componente atual antes de reescrever do zero, pra não perder lógica já validada (cálculos, chamadas de API, etc.), só atualizando estilo/estrutura visual conforme `notas-de-design.md`.
