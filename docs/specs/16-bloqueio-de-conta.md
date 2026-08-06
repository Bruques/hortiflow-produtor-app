# 16 — Bloqueio de conta

## Objetivo

Dar ao desenvolvedor controle manual sobre quem consegue usar o app, sem depender de nenhuma integração de cobrança pronta (modelo de cobrança do SaaS ainda não definido — ver "Perguntas em aberto" no `CLAUDE.md`). Motivação direta: o app vai para as lojas com cadastro público aberto (qualquer pessoa pode baixar e criar conta), e o plano inicial é deixar 2-3 produtores testando de graça por um período e, depois, cobrar informalmente (plano anual combinado por fora). Hoje não existe nenhum jeito de suspender o acesso de alguém que não pagou, nem de reativar depois — essa spec cobre só isso, o mínimo necessário para isso ser possível.

Fica fora de escopo aqui qualquer automação de cobrança (Stripe, PIX, etc.) — bloqueio e desbloqueio são feitos manualmente pelo desenvolvedor, direto no banco, até que exista volume que justifique automatizar.

## Escopo

**Entra:**
- Campo de status no `Usuario` (ativo/bloqueado)
- Checagem desse status tanto no login quanto em toda rota autenticada (não só no login) — para que bloquear alguém já derrube o acesso de uma sessão em andamento, não só impeça logins futuros
- Usuário bloqueado que faz qualquer chamada autenticada recebe 401, o que já aciona o logout automático existente (web e mobile, ver commit "Desloga automaticamente em 401") — ou seja, essa spec não precisa reimplementar nada no frontend/mobile, só apoia no que já existe

**Fica de fora:**
- Painel administrativo (web ou mobile) para listar usuários e bloquear/desbloquear pela interface — por enquanto, feito direto no banco (Prisma Studio ou console do Neon)
- Qualquer notificação automática ao usuário quando é bloqueado (ele só descobre ao tentar usar o app e ver a mensagem de erro)
- Automação de cobrança/pagamento
- Bloqueio parcial ou por funcionalidade (é tudo ou nada: bloqueado não usa o app de jeito nenhum)

## Regras de negócio

- Todo usuário novo (`POST /auth/register`) nasce com status **ativo** — sem isso, ninguém conseguiria se cadastrar e testar o app gratuitamente, quebrando o modelo atual de teste livre
- A checagem de status acontece em dois pontos:
  1. No login (`POST /auth/login`): usuário bloqueado não recebe token, mesmo com telefone/senha corretos
  2. No `authMiddleware` (aplicado a toda rota autenticada): usuário bloqueado que ainda tenha um token válido (emitido antes do bloqueio) passa a receber 401 na próxima chamada — isso exige uma consulta ao banco a cada requisição autenticada (hoje o middleware só decodifica o JWT, sem tocar o banco), uma pequena perda de performance aceita em troca de suspensão quase imediata, sem precisar de blacklist de tokens
- Mensagem de erro deve ser clara o suficiente para o usuário entender que não é um bug (ex: "Conta suspensa. Entre em contato para reativar."), diferente da mensagem genérica de credencial inválida
- Desbloquear reativa o acesso imediatamente — não exige o usuário fazer nada além de logar de novo (ou continuar usando, se a sessão não tiver caído em 401 nesse meio-tempo)

## Contrato de API

Nenhum endpoint novo. Mudança de comportamento em rotas existentes:

```
POST /auth/login
  200: { token, usuario } — usuário ativo, comportamento atual inalterado
  401: { error: "Telefone ou senha inválidos" } — credenciais erradas (atual)
  401: { error: "Conta suspensa. Entre em contato para reativar." } — usuário bloqueado

Qualquer rota autenticada (via authMiddleware)
  401: { error: "Token inválido" } — token ausente/expirado/inválido (atual, inalterado)
  401: { error: "Conta suspensa. Entre em contato para reativar." } — usuário bloqueado
```

Bloquear/desbloquear um usuário: update direto no campo de status via Prisma Studio ou SQL no console do Neon. Sem endpoint.

## Critérios de aceite

1. Dado um usuário com status bloqueado, quando tenta logar com telefone/senha corretos, então recebe 401 com mensagem clara e não recebe token
2. Dado um usuário com status ativo, login funciona exatamente como hoje
3. Dado um usuário logado (token válido) que é bloqueado no banco enquanto usa o app, quando faz qualquer chamada autenticada seguinte, então recebe 401 e web/mobile deslogam automaticamente (reaproveitando o interceptor de 401/403 já existente)
4. Dado um usuário bloqueado que é reativado, quando faz login novamente, então funciona normalmente
5. `POST /auth/register` continua criando o usuário sempre com status ativo, sem exigir nenhum campo novo no formulário de cadastro
6. Nenhuma tela nova é necessária no frontend ou mobile — a única mudança visível ao usuário é a mensagem de erro ao tentar logar ou usar o app estando bloqueado
