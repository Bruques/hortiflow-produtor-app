# Backlog / notas soltas

Rascunho livre para anotar ideias, melhorias e bugs observados usando o app no dia a dia — antes de virarem uma spec formal em `docs/specs/`. Quando um item aqui estiver claro o suficiente pra implementar, ele sai daqui e vira `docs/specs/0X-nome.md` (ver processo de SDD no `CLAUDE.md`).

Sem estrutura rígida — anote como quiser, mova de seção quando fizer sentido.

## Bugs / coisas quebradas
- Eu abro o app, se eu atualizar a pagina, eu tomo um erro 404, acho que tem algo a ver com a url

## Melhorias de UX
-

## Ideias de funcionalidade
- Pedir ajuda para deixar o app privado no github
- Pedir pra olhar o repo no github pra garantir que não tem nenhum dado sensível sendo vazado
- Entender se consigo melhorar a url do app
- Registrar acerto: hoje o período tem que ser preenchido manualmente; pensar em funcionalidades que facilitem e deem mais liberdade ao usuário na hora de definir o que/quando pagar
- (REPENSAR) A criação de despesa automática, talvez possa ficar no registro de venda, com um botão pro usuario adicionar se quer ou não a respesa recorrente previamente cadastrada, ao inves de sempre ir de forma automatica. Exemplo: o Usuario cadastra uma recorrencia de despesa de 1 real por caixa vendida, mas ela só vai ser adicionada na venda na tela de registro de venda, onde ele veria por exemplo essa opção, e um toggle ou um checkbox dizendo que se ele marcar, uma dispesa de 1 real por caixa vai ser adicionada as caixas que ele registrou na venda
- Colocar um chatbot para ficar ouvindo as notificações do grupo de preço de morango diário, e colocar isso em uma aba
- Criar um local para anuncios, promoções etc
- O backend puxa os dados de toda safra, e só depois filtramos, talvez isso faça gastarmos muita memoria, o ideal talvez seja fazer uma query para filtrarmos, assim inicialmente buscamos só os dados do dia, e caso o usuário queira, a gente busca dados com mais info
- Troca de senha
- Mostrar detalhes da safra, observações que o usuário vai colocar: exemplo: Safra 2026 | estufa | Corrego do bom Jesus | 20mil pés
- Colocar de alguma forma se foi pago ou não, o morango vendido, e colocar um filtro de produtos vendidos que foram pagos ou não - E colocar na edição um botão pra registrar a venda

## Dúvidas de negócio

(perguntas que exigem validar com a contadora/produtores — ver também "Perguntas em aberto" no `CLAUDE.md`)

-

## Já resolvido / descartado

(mover pra cá o que foi feito ou decidido não fazer, pra não perder o histórico da decisão)

- Header da safra agora leva para "/" (Início), que decide sozinho pra onde ir
- Despesas e Vendas agora podem ser editadas e excluídas (bloqueado se já fizerem parte de um Acerto registrado)
- Toggle de período da tela Início/Despesas/Vendas agora abre em "Hoje"
- Bottom nav: Vendas passou para a esquerda, Despesas para a direita
