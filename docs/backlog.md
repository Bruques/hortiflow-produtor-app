# Backlog / notas soltas

Rascunho livre para anotar ideias, melhorias e bugs observados usando o app no dia a dia — antes de virarem uma spec formal em `docs/specs/`. Quando um item aqui estiver claro o suficiente pra implementar, ele sai daqui e vira `docs/specs/0X-nome.md` (ver processo de SDD no `CLAUDE.md`).

Sem estrutura rígida — anote como quiser, mova de seção quando fizer sentido.

## Bugs / coisas quebradas

- 

## Melhorias de UX

- Na tela de registro de despesa e venda, quando o usuario quer selecionar uma data especifica para o registro ele tem que digitar a data, quero permitir ele ver um calendário, acho que fica mais amigavel para ele ao inves de digitar a data
- Na tela de registro de venda, ele tem que apertar no + ou no - para adicionar a quantidade de caixas, se ele vender 200 caixas ele tem que apertar nesse botão de + 200 vezes, quero melhorar isso
- Na tela de registro de despesas quando o usuario seleciona a opção outro, ele atualmente não tem nenhum lugar onde ele pode identificar esse outro gasto, seria interessante pensar em alguma coisa para que depois ele possa dizer o que foi esse gasto, para ele poder ter o controle do que foi esse "outro" gasto
- Em relação a tela de registro de despesas, não temos uma mascara para adicionarmos o valor, seria interessante colocar uma mascara para que o usuario so possa digitar numeros, e funcione igual é os apps de banco na hora de colocar o valor pra fazer o pix por exemplo
- Não criamos os wireframes do fluxo de despesas pessoais do usuário - criar e aplicar ele na nossa aplicação
- Nas configurações quando clicamos abrir nova safra, estamos indo para um tela antiga, quero criar o wireframe dessa tela também e aplicar ela no app
- Quando clico no menu e vamos na opção configurações e listamos os socios, quando clicamos no voltar ele não volta pra tela anterior, e sim para uma tela de configuração de safras (uma tela antiga)
- Quando eu abro no celular, a tela anda para os lados se eu arrastas, queria que a tela ficasse ao maximo parecida com um app nativo
- quando eu levemente rolo a tela pra cima, a barra de navegação do safari cresce e tampa a navigation bar do app

## Ideias de funcionalidade

- Registrar acerto: hoje o período tem que ser preenchido manualmente; pensar em funcionalidades que facilitem e deem mais liberdade ao usuário na hora de definir o que/quando pagar
- Despesas pessoais: desenhar o fluxo no `docs/design/wireframes.html` — ainda não existe nenhum wireframe para essa parte do app
- **(REPENSAR — mudança grande, validar antes de fazer)** Generalizar Venda para além de "caixa de morango": hoje o produtor só vende em caixa, mas morango que amadureceu demais é congelado e vendido por quilo; a ideia de fundo é o app dar suporte a outras culturas além do morango (ex: brócolis), então "caixa" não deveria ser a única unidade
- Depende da task acima: `RegraDespesaRecorrente` do tipo `por_venda` hoje só calcula por caixa vendida — precisaria ser ajustada junto
- (REPENSAR) A criação de despesa automática, talvez possa ficar no registro de venda, com um botão pro usuario adicionar se quer ou não a respesa recorrente previamente cadastrada, ao inves de sempre ir de forma automatica. Exemplo: o Usuario cadastra uma recorrencia de despesa de 1 real por caixa vendida, mas ela só vai ser adicionada na venda na tela de registro de venda, onde ele veria por exemplo essa opção, e um toggle ou um checkbox dizendo que se ele marcar, uma dispesa de 1 real por caixa vai ser adicionada as caixas que ele registrou na venda

## Dúvidas de negócio

(perguntas que exigem validar com a contadora/produtores — ver também "Perguntas em aberto" no `CLAUDE.md`)

-

## Já resolvido / descartado

(mover pra cá o que foi feito ou decidido não fazer, pra não perder o histórico da decisão)

- Header da safra agora leva para "/" (Início), que decide sozinho pra onde ir
- Despesas e Vendas agora podem ser editadas e excluídas (bloqueado se já fizerem parte de um Acerto registrado)
- Toggle de período da tela Início/Despesas/Vendas agora abre em "Hoje"
- Bottom nav: Vendas passou para a esquerda, Despesas para a direita
