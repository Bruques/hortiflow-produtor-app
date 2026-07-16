# Backlog / notas soltas

Rascunho livre para anotar ideias, melhorias e bugs observados usando o app no dia a dia — antes de virarem uma spec formal em `docs/specs/`. Quando um item aqui estiver claro o suficiente pra implementar, ele sai daqui e vira `docs/specs/0X-nome.md` (ver processo de SDD no `CLAUDE.md`).

Sem estrutura rígida — anote como quiser, mova de seção quando fizer sentido.

## Bugs / coisas quebradas

-

## Melhorias de UX

-

## Ideias de funcionalidade

- Registrar acerto: hoje o período tem que ser preenchido manualmente; pensar em funcionalidades que facilitem e deem mais liberdade ao usuário na hora de definir o que/quando pagar
- Despesas pessoais: desenhar o fluxo no `docs/design/wireframes.html` — ainda não existe nenhum wireframe para essa parte do app
- **(REPENSAR — mudança grande, validar antes de fazer)** Generalizar Venda para além de "caixa de morango": hoje o produtor só vende em caixa, mas morango que amadureceu demais é congelado e vendido por quilo; a ideia de fundo é o app dar suporte a outras culturas além do morango (ex: brócolis), então "caixa" não deveria ser a única unidade
  - Depende da task acima: `RegraDespesaRecorrente` do tipo `por_venda` hoje só calcula por caixa vendida — precisaria ser ajustada junto

## Dúvidas de negócio

(perguntas que exigem validar com a contadora/produtores — ver também "Perguntas em aberto" no `CLAUDE.md`)

-

## Já resolvido / descartado

(mover pra cá o que foi feito ou decidido não fazer, pra não perder o histórico da decisão)

- Header da safra agora leva para "/" (Início), que decide sozinho pra onde ir
- Despesas e Vendas agora podem ser editadas e excluídas (bloqueado se já fizerem parte de um Acerto registrado)
- Toggle de período da tela Início/Despesas/Vendas agora abre em "Hoje"
- Bottom nav: Vendas passou para a esquerda, Despesas para a direita
