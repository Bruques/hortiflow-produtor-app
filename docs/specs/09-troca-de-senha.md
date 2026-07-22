# 09 — Troca de senha

## Objetivo

Permitir que um usuário autenticado troque a própria senha. Motivação direta (não é só "boa prática"): o modelo de venda atual é o próprio desenvolvedor criar a conta da sociedade com dados pré-definidos e uma senha provisória, ensinar o dono da lavoura a usar o app, e só depois repassar o acesso — nesse momento o dono precisa conseguir trocar a senha para que o desenvolvedor deixe de ter acesso à conta. Hoje isso não existe: só há `POST /auth/register` (cadastro) e `POST /auth/login`.

Fica fora de escopo aqui o fluxo de "esqueci minha senha" (recuperação sem estar logado, via SMS/e-mail) — isso é mais complexo (precisa de canal de verificação) e não é necessário para o caso de uso atual, no qual o usuário sempre consegue logar com a senha provisória primeiro. Fica registrado como ideia futura, possivelmente junto do fluxo self-service com Stripe (ver "Estado atual do projeto" no `CLAUDE.md`).

## Escopo

**Entra:**
- Endpoint autenticado para trocar a própria senha, exigindo a senha atual como confirmação
- Campo "Trocar senha" na tela de Configurações (`ConfiguracoesPage.tsx`), com formulário de senha atual + nova senha + confirmação

**Fica de fora:**
- Recuperação de senha sem estar logado ("esqueci minha senha")
- Qualquer envio de SMS/e-mail/notificação
- Forçar troca de senha no primeiro login (não é o modelo hoje — o desenvolvedor decide manualmente quando repassar o acesso)

## Regras de negócio

- Exige a senha atual correta antes de aceitar a nova — evita que alguém com uma sessão/token roubado (JWT válido, mas sem saber a senha) troque a senha e tranque o dono de fora
- Nova senha segue a mesma regra de força já usada no cadastro: mínimo 6 caracteres (`registerSchema` em `auth.controller.ts`)
- Nova senha não pode ser igual à atual (evita confusão de "troquei mas não mudou nada")
- Ao trocar a senha com sucesso, o token JWT atual continua válido (JWT é stateless, sem lista de revogação) — o desenvolvedor perde acesso na prática porque não vai mais saber a senha nova para gerar um token novo depois que o atual expirar (7 dias) ou for invalidado por logout manual. Não há invalidação imediata de sessões ativas no MVP — se isso for um requisito de segurança mais forte no futuro, exigiria uma tabela de sessões/blacklist de tokens, fora de escopo agora
- Erros de senha atual incorreta devem soar genéricos o suficiente para não ajudar tentativa de força bruta (mesmo padrão do login: mensagem única, sem detalhar "senha errada" vs. outro motivo)

## Contrato de API

```
PUT /auth/senha (autenticado)
  body: { senha_atual: string, senha_nova: string }

  200: { ok: true }
  400: senha_nova com menos de 6 caracteres, ou senha_nova igual a senha_atual
  401: senha_atual incorreta, ou token ausente/inválido (mesmo middleware de auth de sempre)
```

## Critérios de aceite

1. Dado um usuário autenticado com senha atual correta e nova senha válida (≥6 caracteres, diferente da atual), quando chama `PUT /auth/senha`, então retorna 200, a senha é atualizada (hash bcrypt) e um novo login com a senha nova funciona
2. Dado um usuário autenticado que informa a senha atual errada, quando chama `PUT /auth/senha`, então retorna 401 e a senha no banco não muda
3. Dado um usuário autenticado que informa uma nova senha com menos de 6 caracteres, quando chama `PUT /auth/senha`, então retorna 400
4. Dado um usuário autenticado que informa a nova senha igual à atual, quando chama `PUT /auth/senha`, então retorna 400
5. Sem token ou com token inválido, `PUT /auth/senha` retorna 401 (mesmo comportamento do middleware já existente)
6. Na tela de Configurações, o usuário encontra um formulário "Trocar senha" com os três campos (senha atual, nova senha, confirmar nova senha); confirmação divergente da nova senha bloqueia o envio no frontend antes mesmo de chamar a API; sucesso mostra mensagem de confirmação e limpa os campos; erro do backend é exibido na tela
