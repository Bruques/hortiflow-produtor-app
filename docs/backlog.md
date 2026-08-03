# Backlog / notas soltas

Rascunho livre para anotar ideias, melhorias e bugs observados usando o app no dia a dia — antes de virarem uma spec formal em `docs/specs/`. Quando um item aqui estiver claro o suficiente pra implementar, ele sai daqui e vira `docs/specs/0X-nome.md` (ver processo de SDD no `CLAUDE.md`).

Sem estrutura rígida — anote como quiser, mova de seção quando fizer sentido.

## Bugs / coisas quebradas

- As vezes eu abro o site do ambiente de desenvolvimento e tomo um erro 401, na tela fica um botao de tentar novamente, mas eu nunca consigo. Fui ver o response e estou recebendo isso: {"error":"Token inválido"}. Como resolvemos isso? caso não de pra fazer muita coisa podemos deslogar o usuario nesse momento, pois como está hoje nao consigo deslogar

## Melhorias de UX

- Hoje temos uma seção bem legal de cards na tela de configurações, mas na tela anterior já temos varias coisas também, porem num formato diferente, entender se não ficaria legal tudo numa tela só, e com o layout igual o da tela de configurações
- Ajustar tela de acerto partcial, colocar um calendario ou pickers mais facil do que digitar a data na mão
- Quando usuário criar conta e for tentar registrar venda e não tiver unidade registrada ainda mostrar um botão atalho para registrar unidade
- por que o get retorna um 304 ao inves de um 200? - curiosidade

## Ideias de funcionalidade
- 

## App mobile nativo (React Native/Expo) — roadmap de specs

Iniciativa em construção desde 2026-07-30 (motivação e regras de arquitetura registradas no `CLAUDE.md`). Specs em `docs/specs/mobile/`, todas já escritas e aprovadas — implementação segue uma sessão por spec, nesta ordem.

**Regra permanente**: assim que uma spec abaixo for implementada e validada (rodando o app, não só type-check — mesmo critério do SDD no `CLAUDE.md`), marcar `[x]` aqui nesta lista.

- [x] `00-setup-e-infra.md` — scaffold Expo/TS, cliente de API, persistência local + fila de sincronização genérica, CI por pasta
- [x] `01-auth.md` — cadastro, login, bootstrap de sessão offline, logout, troca de senha
- [x] `02-sociedade-e-socios.md` — criar/entrar por código, sócio sem conta, percentuais
- [x] `03-safra.md` — abrir/encerrar safra, observações, `SafraContext`
- [x] `04-despesas-da-sociedade.md` — despesa com rateio, foto via câmera, fila offline
- [x] `05-painel-e-acerto.md` — painel de simulação e Acerto (sem cálculo local)
- [ ] `06-vendas-e-despesa-recorrente.md` — unidades de venda, vendas, regra recorrente, sugestões do dia
- [ ] `07-despesa-pessoal.md` — despesa pessoal isolada, offline sem dependência de cache de sócios
- [ ] `08-navegacao-resumo-e-menu.md` — bottom nav + FAB, tela de Resumo e Menu (composição, sem dado novo — depende de `01` a `07`)

### Prioridade alta (segurança / risco ativo)

- **[ALTA]** Tornar o repositório privado no GitHub.

### Prioridade média (melhorias de produto com valor claro)

- **[MÉDIA]** Registrar Acerto: hoje o período (data início/fim) precisa ser preenchido manualmente pelo usuário. Pensar em atalhos e mais liberdade na hora de definir o intervalo — por exemplo, sugerir automaticamente "desde o último Acerto registrado", ou opções rápidas tipo "mês atual" / "safra inteira" — reduzindo erro de digitação e fricção nesse passo.

### Prioridade baixa / precisa de mais definição antes de virar spec

- **[BAIXA]** Chatbot ouvindo as notificações do grupo (WhatsApp?) de preço de morango diário, exibindo isso em uma aba dedicada do app. Ideia grande, fora do escopo atual de gestão de meação — provavelmente Fase 2. Falta definir de onde vem a notificação (grupo de WhatsApp? outra fonte?) e o que o chatbot faz com a informação (só exibe? resume? alerta variação de preço?).
- **[BAIXA]** Criar um local dentro do app para anúncios, promoções etc. Ideia ainda sem escopo nem modelo de negócio definido (quem anuncia, como monetiza) — precisa de mais definição antes de virar spec.

### Performance — preparar para escala futura, sem antecipar sem necessidade

- **[BAIXA, mas de execução barata/sem risco quando chegar a hora]** Criar índice composto `(safra_id, data desc, criado_em desc)` nas tabelas `vendas`, `despesas` e `despesas_pessoais`. Hoje essas tabelas não têm índice nenhum: toda listagem faz sequential scan + sort na tabela inteira (todas as safras, todas as sociedades), não só na safra do cliente. Para o volume atual (poucas sociedades, uma safra por vez) isso é irrelevante — mas é o primeiro gargalo esperado conforme o número de clientes crescer, porque cresce com o total de linhas do sistema inteiro, não com o tamanho de uma safra isolada (que é limitado por natureza a uma temporada de colheita).
  - **Indicadores de que chegou a hora de fazer**: (1) sintoma direto — tela de Vendas/Despesas/Resumo demorando visivelmente (>1-2s) pra carregar, principalmente no filtro "safra inteira"; (2) proxy de volume — `SELECT count(*) FROM vendas`/`despesas` no Neon passando de dezenas de milhares de linhas, ou `EXPLAIN ANALYZE` numa query de listagem típica mostrando `Seq Scan` custoso; (3) gatilho de negócio — número de sociedades ativas simultâneas saindo de poucas dezenas, mesmo sem sintoma ainda sentido.
  - Migration de baixo risco quando chegar a hora: não muda contrato de API nem comportamento, só acelera uma leitura que já existe.
- **[BAIXA]** Paginação nas listagens de Vendas/Despesas: hoje o filtro de período já é resolvido no banco (não busca mais a safra inteira em memória, ver "Já resolvido"), mas dentro de um período grande (ex: "safra inteira" numa safra de meses com lançamento diário) ainda não há limite de página — pode devolver milhares de linhas numa única resposta. Afeta payload de rede e renderização de lista longa no frontend mais do que o banco em si. Mesma lógica de "esperar o sintoma" do item acima.

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
- Despesa recorrente automática (gatilho `POR_VENDA`) deixou de ser automática/incondicional: a tela de lançamento de venda agora mostra um toggle por regra aplicável (marcado por padrão, editável), e só as regras marcadas geram despesa — ver adendo 2026-07-22 em `docs/specs/04-vendas-e-despesa-recorrente.md`. Corrigido junto um bug no selo "gerou despesa automática" da listagem de Vendas, que calculava a partir do estado *atual* da regra em vez do que cada venda realmente aplicou (mudava retroativamente ao ativar/desativar a regra em Configurações)
- Ordenação de Vendas/Despesas/Despesas Pessoais no mesmo dia: antes ordenava só por `data` (sem hora), então lançamentos do mesmo dia empatavam e apareciam em ordem não previsível (geralmente o primeiro registrado primeiro). Agora ordena por `data desc` e, em caso de empate, por `criado_em desc` — o último registrado no dia aparece primeiro
- Removido o seletor "Sócio (recebe a despesa)" da criação de regra recorrente: o campo era, na prática, "quem bancou" (auditoria/extrato do Acerto), não "quem recebe" — rótulo invertido que podia atribuir a despesa ao sócio errado no extrato. `socio_id` da regra (e da despesa gerada por ela) passa a ser sempre quem criou a regra. Ver adendo 2026-07-31 em `docs/specs/04-vendas-e-despesa-recorrente.md`
