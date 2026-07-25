# 12 — Hub de categorias em Configurações

## Objetivo

Reestruturar a navegação da tela de Configurações (`ConfiguracoesPage.tsx`) — hoje uma página única e comprida com seis blocos empilhados (sócios/percentual, unidades de venda, despesa recorrente, trocar senha) — numa tela "hub" com cartões grandes por categoria, cada um levando a uma subtela dedicada. Nenhuma regra de negócio muda: é reorganização de navegação/UI sobre o que já existe e funciona.

Motivação: o público do app (produtor rural, pouco costume com apps) não navega "explorando" uma tela longa em busca de algo — se não está visível de cara, tende a presumir que não existe. Hoje "Trocar senha" é o último bloco da rolagem, e o desenvolvedor precisa explicar verbalmente onde encontrá-lo. Um hub de categorias com ícone grande reaproveita o padrão de "Ajustes" que qualquer pessoa já viu no próprio celular (reconhecimento em vez de memorização) e reduz o número de decisões visíveis por tela (menos itens competindo por atenção).

Este plano foi validado com mockups antes desta spec — ver decisão de agrupamento abaixo.

## Escopo

**Entra:**
- Nova tela hub em `/sociedades/:id/configuracoes`, substituindo o conteúdo atual dessa rota: 3 ou 4 cartões (conforme papel do usuário — ver regras), cada um navegando para uma subrota
- 4 subtelas novas, cada uma reaproveitando a lógica/chamadas de API já existentes em `ConfiguracoesPage.tsx`, só separadas fisicamente:
  1. **Sócios e Sociedade** (`/sociedades/:id/configuracoes/socios`) — barra de proporção, percentual por sócio (steppers +/-5%, botão "Salvar alterações"), formulário "Adicionar sócio", código de convite
  2. **Regras de Despesa** (`/sociedades/:id/configuracoes/regras-despesa`) — lista de regras recorrentes, toggle ativo/inativo, formulário "Nova regra" (só financiador/misto)
  3. **Unidades de Venda** (`/sociedades/:id/configuracoes/unidades-de-venda`) — lista de unidades, toggle ativo/inativo, formulário "Nova unidade" (só financiador/misto)
  4. **Conta e Senha** (`/sociedades/:id/configuracoes/conta`) — formulário de troca de senha
- Cada subtela tem cabeçalho próprio com botão "Voltar" (mesmo componente/padrão visual do cabeçalho atual da `ConfiguracoesPage`), que volta para o hub
- Um componente de cartão de categoria reutilizável para o hub (ícone, título, subtítulo curto)

**Fica de fora:**
- Qualquer mudança de regra de negócio, endpoint de API ou payload — é só separação de tela
- Mudança de ícones (usa lucide-react, mesma biblioteca já em uso)
- Onboarding, tour guiado ou tooltip explicando o hub — fica para avaliação futura se a confusão persistir

## Decisões de agrupamento (fechadas com o desenvolvedor antes de codar)

- **Unidades de Venda é categoria própria**, não uma subseção dentro de Regras de Despesa — apesar de estarem próximas hoje no código, são conceitos distintos para quem usa (uma é "o que eu vendo", outra é "o que é descontado automaticamente")
- **Sócios e percentual de lucro + código de convite continuam juntos** numa única subtela "Sócios e Sociedade" — são poucos elementos e já convivem bem hoje; não há necessidade de separar em mais uma subtela só para o código de convite (ação rara)

## Regras de negócio

- O cartão **"Unidades de Venda"** só aparece no hub para sócio financiador ou misto (`souFinanciador`) — mesma regra que já esconde essa seção inteira hoje para o meeiro
- O cartão **"Regras de Despesa"** aparece para todos os papéis — meeiro entra na subtela e vê a lista em modo leitura (toggle desabilitado, sem botão "Nova regra"), exatamente como hoje
- Os cartões **"Sócios e Sociedade"** e **"Conta e Senha"** aparecem para todos, sem diferenciação por papel
- O botão "Salvar alterações" dos percentuais migra para dentro da subtela "Sócios e Sociedade" (deixa de ser um rodapé fixo da tela de Configurações inteira, porque agora só faz sentido no contexto daquela subtela)
- Nenhuma outra regra de negócio muda: soma de percentual = 100%, restrição de quem edita regra/unidade, validação de senha, etc. — todas herdadas sem alteração das specs 02, 04, 08 e 09

## Contrato de API

Nenhum endpoint novo ou alterado — reaproveita integralmente:
- `GET/PUT /sociedades/:id/socios` (percentuais)
- `POST /sociedades/:id/socios` (adicionar sócio)
- `GET /sociedades` (código de convite)
- `GET/POST /sociedades/:id/regras-despesa-recorrente`, `PATCH /regras-despesa-recorrente/:id`
- `GET/POST /sociedades/:id/unidades-venda`, `PATCH /unidades-venda/:id`
- `PUT /auth/senha`

## Critérios de aceite

1. Dado um usuário (qualquer papel) que abre `/sociedades/:id/configuracoes`, quando a tela carrega, então vê cartões de categoria (não mais a lista longa de seções) — 4 cartões se for financiador/misto, 3 se for meeiro (sem "Unidades de Venda")
2. Dado o hub aberto, quando o usuário toca em qualquer cartão, então navega para a subrota correspondente e vê só o conteúdo daquela categoria, com botão "Voltar" que retorna ao hub
3. Dado um meeiro que entra em "Regras de Despesa", quando visualiza a lista, então os toggles aparecem desabilitados e não há botão "Nova regra" — mesmo comportamento restritivo de hoje, só em tela própria
4. Dado um meeiro, quando olha o hub, então não vê o cartão "Unidades de Venda"
5. Dado um usuário na subtela "Sócios e Sociedade", quando ajusta percentuais e toca em "Salvar alterações", então o comportamento (validação de soma, mensagens de sucesso/erro) é idêntico ao da tela antiga
6. Dado um usuário na subtela "Conta e Senha", quando troca a senha, então o comportamento é idêntico ao já coberto pela spec 09
7. Navegar para o hub a partir de qualquer entrada existente (Menu, Resumo "Ver sócios", lista de Safras) continua funcionando sem mudança de link
8. Nenhuma chamada de API muda de payload ou endpoint em relação ao comportamento atual
