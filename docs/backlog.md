# Backlog / notas soltas

Rascunho livre para anotar ideias, melhorias e bugs observados usando o app no dia a dia — antes de virarem uma spec formal em `docs/specs/`. Quando um item aqui estiver claro o suficiente pra implementar, ele sai daqui e vira `docs/specs/0X-nome.md` (ver processo de SDD no `CLAUDE.md`).

Sem estrutura rígida — anote como quiser, mova de seção quando fizer sentido.

## Bugs / coisas quebradas

-

## Melhorias de UX

-

## Ideias de funcionalidade

### Prioridade alta (segurança / risco ativo)

- **[ALTA]** Tornar o repositório privado no GitHub.

### Prioridade média (melhorias de produto com valor claro)

- **[MÉDIA]** Repensar a criação de despesa recorrente automática (gatilho `por_venda`): hoje ela é gerada automaticamente ao lançar uma venda. Ideia: mover essa decisão para a própria tela de registro de venda, mostrando um checkbox/toggle opcional. Exemplo concreto: o usuário cadastra uma regra de despesa recorrente de R$1 por caixa vendida; ao registrar uma venda de N caixas, a tela mostra essa regra aplicável com um toggle — só se o usuário marcar, é criada a despesa de R$1 × N caixas vinculada àquela venda. Objetivo: dar controle e visibilidade ao usuário no momento do lançamento, em vez de gerar despesa "fantasma" em background.
- **[MÉDIA]** Registrar Acerto: hoje o período (data início/fim) precisa ser preenchido manualmente pelo usuário. Pensar em atalhos e mais liberdade na hora de definir o intervalo — por exemplo, sugerir automaticamente "desde o último Acerto registrado", ou opções rápidas tipo "mês atual" / "safra inteira" — reduzindo erro de digitação e fricção nesse passo.
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

- Erro 404 ao atualizar (F5) rotas internas do frontend: faltava `vercel.json` com rewrite de fallback para SPA (`/(.*)` → `/index.html`), corrigido em `frontend/vercel.json`
- Otimização da query de despesas/vendas por período: `GET /:id/despesas` e `GET /:id/vendas` agora aceitam `periodo`/`data_inicio`/`data_fim` e filtram direto no Prisma (`where: { data: { gte, lte } }`), com "hoje" como default quando nenhum é informado; `DespesasPage`, `VendasPage` e `ResumoPage` pararam de buscar a safra inteira e filtrar em memória. Lógica de período compartilhada em `backend/src/lib/periodo.ts` (antes duplicada só em `simulacao.controller.ts`)
- Filtro de venda paga/a receber na tela de listagem de Vendas: adicionado segmented control "Todas / Pagas / A receber" em `VendasPage.tsx`, além do backend passar a aceitar `?pago=true/false` em `GET /:id/vendas`
- Revisão do histórico completo do repositório (48 commits) em busca de dados sensíveis: nenhum `.env` real, credencial, string de conexão, chave privada ou token foi encontrado commitado — só `.env.example` com valores placeholder
- Header da safra agora leva para "/" (Início), que decide sozinho pra onde ir
- Despesas e Vendas agora podem ser editadas e excluídas (bloqueado se já fizerem parte de um Acerto registrado)
- Toggle de período da tela Início/Despesas/Vendas agora abre em "Hoje"
- Bottom nav: Vendas passou para a esquerda, Despesas para a direita
