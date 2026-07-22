# Backlog / notas soltas

Rascunho livre para anotar ideias, melhorias e bugs observados usando o app no dia a dia — antes de virarem uma spec formal em `docs/specs/`. Quando um item aqui estiver claro o suficiente pra implementar, ele sai daqui e vira `docs/specs/0X-nome.md` (ver processo de SDD no `CLAUDE.md`).

Sem estrutura rígida — anote como quiser, mova de seção quando fizer sentido.

## Bugs / coisas quebradas

- **[ALTA]** Erro 404 ao atualizar a página (F5) em qualquer rota do frontend que não seja a raiz. Suspeita: falta configurar fallback de rota para SPA no servidor (redirecionar qualquer path pra `index.html` e deixar o React Router assumir a partir daí). Precisa investigar a config de deploy/servidor estático.

## Melhorias de UX

-

## Ideias de funcionalidade

### Prioridade alta (segurança / risco ativo)

- **[ALTA]** Revisar o histórico completo do repositório no GitHub (não só o estado atual) em busca de credenciais, tokens, strings de conexão de banco ou qualquer dado sensível commitado por engano.
- **[ALTA]** Depois da revisão acima, tornar o repositório privado no GitHub.

### Prioridade média (melhorias de produto com valor claro)

- **[MÉDIA]** ~~Colocar um tipo de filtro se a venda já foi paga ou não~~ — **parece já resolvido** pelo commit `802d9ed` ("Adiciona campo pago à Venda, com toggle na tela de lançamento/edição"). Confirmar se cobre o caso de uso completo e, se sim, mover para "Já resolvido".
- **[MÉDIA]** Repensar a criação de despesa recorrente automática (gatilho `por_venda`): hoje ela é gerada automaticamente ao lançar uma venda. Ideia: mover essa decisão para a própria tela de registro de venda, mostrando um checkbox/toggle opcional. Exemplo concreto: o usuário cadastra uma regra de despesa recorrente de R$1 por caixa vendida; ao registrar uma venda de N caixas, a tela mostra essa regra aplicável com um toggle — só se o usuário marcar, é criada a despesa de R$1 × N caixas vinculada àquela venda. Objetivo: dar controle e visibilidade ao usuário no momento do lançamento, em vez de gerar despesa "fantasma" em background.
- **[MÉDIA]** Registrar Acerto: hoje o período (data início/fim) precisa ser preenchido manualmente pelo usuário. Pensar em atalhos e mais liberdade na hora de definir o intervalo — por exemplo, sugerir automaticamente "desde o último Acerto registrado", ou opções rápidas tipo "mês atual" / "safra inteira" — reduzindo erro de digitação e fricção nesse passo.
- **[MÉDIA]** Otimizar a query de despesas/vendas por período: hoje o backend busca todos os registros da safra inteira e o filtro por período é aplicado depois (não na query do banco). Com a safra acumulando lançamentos ao longo do tempo, isso pode custar memória e performance desnecessárias. Ideia: fazer o backend já filtrar por período flexível direto no banco, buscando por padrão só os dados do dia atual, e trazendo mais dados sob demanda quando o usuário expandir o filtro.
- **[MÉDIA]** Troca de senha: permitir que o usuário autenticado troque a própria senha (provavelmente na tela de Configurações).
- **[MÉDIA]** Detalhes/observações da safra: permitir que o usuário registre informações livres sobre a safra atual, exibidas como texto informativo (sem entrar em nenhum cálculo) — exemplo: "Safra 2026 | Estufa | Córrego do Bom Jesus | 20 mil pés".

### Prioridade baixa / precisa de mais definição antes de virar spec

- **[BAIXA]** Entender se dá pra melhorar a URL do app — ainda não está claro o que exatamente incomoda (domínio próprio? rota feia? falta de HTTPS?). Definir isso antes de repassar pra implementação.
- **[BAIXA]** Chatbot ouvindo as notificações do grupo (WhatsApp?) de preço de morango diário, exibindo isso em uma aba dedicada do app. Ideia grande, fora do escopo atual de gestão de meação — provavelmente Fase 2. Falta definir de onde vem a notificação (grupo de WhatsApp? outra fonte?) e o que o chatbot faz com a informação (só exibe? resume? alerta variação de preço?).
- **[BAIXA]** Criar um local dentro do app para anúncios, promoções etc. Ideia ainda sem escopo nem modelo de negócio definido (quem anuncia, como monetiza) — precisa de mais definição antes de virar spec.

## Dúvidas de negócio

(perguntas que exigem validar com a contadora/produtores — ver também "Perguntas em aberto" no `CLAUDE.md`)

-

## Já resolvido / descartado

(mover pra cá o que foi feito ou decidido não fazer, pra não perder o histórico da decisão)

- Header da safra agora leva para "/" (Início), que decide sozinho pra onde ir
- Despesas e Vendas agora podem ser editadas e excluídas (bloqueado se já fizerem parte de um Acerto registrado)
- Toggle de período da tela Início/Despesas/Vendas agora abre em "Hoje"
- Bottom nav: Vendas passou para a esquerda, Despesas para a direita
