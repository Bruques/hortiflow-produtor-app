# Checklist de implementação — telas do wireframe

Uma tela (ou componente compartilhado) por vez, igual ao fluxo de SDD do `CLAUDE.md`: spec → aprovação → código → verificação. Marque `[x]` conforme for concluindo, numa sessão nova a cada item.

**Como pedir**: "vamos implementar a tela de X" — a sessão nova só precisa ler `docs/design/notas-de-design.md` (decisões visuais) e a spec relacionada abaixo (regras de negócio). Não precisa colar este arquivo inteiro nem o histórico da conversa de design.

## 0. Componentes compartilhados (fazer antes das telas que dependem deles)

- [x] **Bottom nav v2 + FAB + bottom sheet** — 4 abas (Resumo/Despesas/Vendas/Menu — "Acertos" virou "Menu" por decisão do dev) + botão central, folha de opções Nova venda/Nova despesa. `frontend/src/components/BottomNavV2.tsx`.
- [x] **Period toggle** (Hoje/Semana/Mês/Safra) — `frontend/src/components/PeriodToggle.tsx`, usado na Início.
- [x] **Topbar** (menu + logo + notificações) — `frontend/src/components/Topbar.tsx`. Hambúrguer leva pro Menu; sino sem selo (não existe sistema de notificação ainda).

## 1. Telas

- [x] **Login** — `frontend/src/pages/LoginPage.tsx`. Redesenhada conforme a Tela 1 do wireframe (marca, campos com ícone, toggle de senha, card "seguro e transparente"); lógica de auth mantida sem mudanças.
- [x] **Início** — `frontend/src/pages/ResumoPage.tsx` (rota `/safras/:id`, aba "Resumo"). Substituiu a antiga tela de Simulação (mesmo endpoint `GET /safras/:id/simulacao`, que ganhou o campo `caixasVendidas`). Atalhos rápidos: Nova venda, Nova despesa, Despesas pessoais (no lugar de "Ver simulação", redundante já que esta tela é a simulação), Registrar acerto.
- [ ] **Despesas (lista)** — spec: `docs/specs/03-safra-despesas-e-despesa-pessoal.md` + `docs/specs/04-vendas-e-despesa-recorrente.md` (card de sugestão `por_periodo`).
- [ ] **Vendas (lista)** — spec: `docs/specs/04-vendas-e-despesa-recorrente.md` (selo de despesa automática `por_venda`).
- [ ] **Nova despesa** — spec: `docs/specs/03-safra-despesas-e-despesa-pessoal.md`.
- [ ] **Nova venda** — spec: `docs/specs/04-vendas-e-despesa-recorrente.md`.
- [ ] **Acertos (histórico)** — spec: `docs/specs/06-acerto.md`.
- [ ] **Extrato do acerto** — spec: `docs/specs/06-acerto.md`.
- [ ] **Registrar acerto** — spec: `docs/specs/06-acerto.md`. ⚠️ Campo de comprovante de pagamento precisa de migration nova (ver pendência em `notas-de-design.md`) — resolver isso antes ou tratar como sub-tarefa separada.
- [ ] **Configurações** (percentuais + regras recorrentes) — specs: `docs/specs/02-sociedade-e-socios.md` (percentuais, código de convite) + `docs/specs/04-vendas-e-despesa-recorrente.md` (regras). Pode já existir como telas separadas no código atual; esta é a versão consolidada numa tela só.
- [ ] **Splash / Carregando** — usa `frontend/src/assets/Logo hortiflow.png` direto, sem depender de spec funcional.
- [ ] **Nova safra** — spec: `docs/specs/03-safra-despesas-e-despesa-pessoal.md` (abrir safra). Avisa se já existe safra em andamento; não fecha a anterior sozinha.
- [ ] **Cadastrar meeiro** — spec: `docs/specs/02-sociedade-e-socios.md` (código de 6 dígitos). Só gera/gerencia o convite — não define percentual de lucro; isso continua exclusivo da tela Configurações, pra não duplicar a regra de "soma 100%".

## Observação

As specs de 01 a 07 já foram implementadas (ver commits `Task 3` a `Task 7`). Isso significa que boa parte deste trabalho é **redesign visual de telas que já existem e funcionam**, não funcionalidade nova — então cada sessão deve começar conferindo o componente atual antes de reescrever do zero, pra não perder lógica já validada (cálculos, chamadas de API, etc.), só atualizando estilo/estrutura visual conforme `notas-de-design.md`.
