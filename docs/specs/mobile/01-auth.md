# Mobile 01 — Autenticação

## Objetivo

Fechar o fluxo de autenticação do app mobile: cadastro, login, sessão persistente entre aberturas do app, logout e troca de senha — reaproveitando os endpoints já existentes no backend (`/auth/register`, `/auth/login`, `/auth/me`, `/auth/senha`), sem nenhuma mudança de contrato de API. Também define a regra de **bootstrap de sessão offline**, já que "abrir o app sem internet e continuar logado" é parte do requisito central de offline-first (ver `CLAUDE.md`).

## Escopo

**Entra:**
- Tela de cadastro completa (nome, telefone, senha), consumindo `POST /auth/register`
- Tela de login completa (a versão mínima já existe da spec `00`; aqui ganha validação de formulário, formatação de telefone e paridade com o comportamento do app web)
- **Bootstrap de sessão**: ao abrir o app, se há token salvo no `expo-secure-store`, valida contra `GET /auth/me` e popula o usuário logado; se não há token, vai direto pra tela de login
- Guarda de navegação equivalente ao `PrivateRoute` do frontend web — decide entre stack autenticado e stack de login com base na sessão
- `AuthContext` (React Context) expondo usuário logado, função de logout e estado de carregamento da sessão, pro resto do app consumir sem re-buscar
- Logout: remove o token do `expo-secure-store` e volta pra tela de login
- Tela de troca de senha (equivalente à spec `09-troca-de-senha.md` do web), consumindo `PUT /auth/senha`

**Fica de fora:**
- Recuperação de "esqueci minha senha" sem estar logado — mesma decisão já registrada na spec `09` do web (não é necessário no modelo de venda atual)
- Onboarding de sociedade (criar sociedade / entrar por código de 6 dígitos) — é a spec `02`, mesmo o usuário precisando disso logo após o cadastro
- Login biométrico (Face ID/Touch ID) — ideia futura, não é MVP mobile
- Qualquer mudança no backend — todos os endpoints usados aqui já existem

## Regras de negócio

### Bootstrap de sessão offline (a parte específica de mobile)
- Se existe token salvo, o app **entra direto na tela principal com os dados em cache**, sem esperar resposta de `/auth/me` — a chamada a `/auth/me` roda em paralelo/background só pra confirmar que o token ainda é válido, não como bloqueio de entrada
- **Só um `401` explícito de `/auth/me` desloga o usuário** (token expirado ou inválido de verdade). Uma falha de rede (timeout, sem conexão, erro genérico do Axios sem `response`) é tratada como "estamos offline", não como sessão inválida — o app continua logado normalmente
- Essa distinção (`401` vs. erro de rede) é o ponto mais fácil de implementar errado (bibliotecas de HTTP costumam tratar timeout e 401 de forma parecida se não for checado explicitamente), por isso é coberta por teste unitário dedicado (ver "Critérios de aceite")

### Cadastro e login
- Mesmas regras já validadas no backend, sem duplicar lógica nova: telefone único, senha mínima de 6 caracteres, hash bcrypt (tudo já implementado no backend da spec `01-setup.md` original)
- Formatação/normalização de telefone (máscara visual + envio só de dígitos) replica a lógica já existente em `frontend/src/lib/telefone.ts` — reescrita em `mobile/`, não importada (ver decisão de não compartilhar código entre `mobile/` e `frontend/`, spec `00`)
- Mensagens de erro de login genéricas ("Telefone ou senha incorretos"), mesma escolha de segurança do app web — não revela se o motivo foi telefone inexistente ou senha errada

### Logout
- Remove o token do `expo-secure-store` e limpa o `AuthContext`; não faz chamada ao backend (JWT é stateless, mesmo modelo do web — não há endpoint de invalidação de sessão)
- Dados já sincronizados no banco local (`expo-sqlite`, spec `00`) **não são apagados no logout** nesta spec — decisão a confirmar quando existir dado de negócio de fato armazenado localmente (specs seguintes); registrar aqui só a lacuna, não a resposta

### Troca de senha
- Mesmo contrato e mesmas regras da spec `09` do web: exige senha atual correta, nova senha mínima de 6 caracteres, nova senha diferente da atual
- Sem tratamento especial de offline: troca de senha exige conexão (não faz sentido enfileirar essa operação — ver spec `00`, a fila de sincronização é para lançamentos de despesa/venda, não para operações de conta)

## Contrato de API

Nenhum endpoint novo — reaproveita integralmente o que já existe:

```
POST /auth/register   { nome, telefone, senha } → 201 { usuario, token } | 409
POST /auth/login      { telefone, senha }        → 200 { usuario, token } | 401
GET  /auth/me         (autenticado)              → 200 { usuario }        | 401
PUT  /auth/senha      (autenticado)               { senha_atual, senha_nova } → 200 { ok: true } | 400 | 401
```

## Critérios de aceite

1. Dado um telefone novo, cadastro com nome/telefone/senha válidos retorna sucesso, salva o token e navega pra tela principal
2. Dado um telefone já cadastrado, a tela de cadastro mostra erro (409 tratado), sem crash
3. Dado telefone/senha corretos, login salva o token e navega pra tela principal
4. Dado telefone/senha incorretos, a tela de login mostra a mensagem genérica de erro
5. Dado um token salvo e internet disponível, reabrir o app valida a sessão via `/auth/me` e entra direto na tela principal, sem passar pela tela de login
6. Dado um token salvo e **sem internet**, reabrir o app entra direto na tela principal (usando dados em cache), sem forçar logout e sem travar esperando resposta de rede
7. Dado um token expirado/inválido (`401` real de `/auth/me`), o app desloga automaticamente e volta pra tela de login
8. Dado o usuário autenticado, tocar em "Sair" remove o token do `expo-secure-store` e volta pra tela de login
9. Dado a senha atual correta, trocar a senha retorna sucesso
10. Dado a senha atual incorreta, trocar a senha mostra erro genérico, sem revelar detalhes
11. Existe teste unitário da lógica de bootstrap de sessão cobrindo os três casos: `401` (desloga), erro de rede (mantém sessão), sucesso (atualiza dados do usuário)

## Decisões registradas durante a implementação

- **Usuário também fica salvo no `expo-secure-store` (`hortiflow_usuario`), não só o token**: a spec pede "entrar direto na tela principal com os dados em cache", mas o app ainda não tem uma tabela de negócio para o usuário no `expo-sqlite`. Guardar o objeto `Usuario` (pequeno: `id`/`nome`/`telefone`) na mesma camada segura do token resolve isso sem esperar uma spec de dados de sociedade. `AuthContext` atualiza esse cache sempre que `/auth/me` responde com sucesso.
- **Troca de stack de navegação por estado (`logado`), não `navigation.replace`**: `RootNavigator` agora registra um conjunto de telas quando `logado` é `true` e outro quando é `false`, no lugar de cada tela chamar `navigation.replace(...)` manualmente. Login, cadastro e logout só mudam o estado do `AuthContext` (`entrar`/`sair`); a troca de tela é consequência automática, e a lógica não fica espalhada em cada tela que autentica ou desloga.
- **Mensagem de erro do cadastro usa o texto do backend quando disponível** (ex: "Telefone já cadastrado" no 409), diferente do login que sempre usa a mensagem genérica por decisão de segurança já registrada na spec. Cadastro não tem esse risco (não existe "senha errada" nesse fluxo), então mostrar o motivo real é só uma UX melhor.
- **Lógica de bootstrap extraída para `src/lib/bootstrapSessao.ts`** (`deveDeslogarPorErro`), função pura testável sem montar o `AuthContext` inteiro — cobre diretamente o critério de aceite 11 (401 desloga, erro de rede mantém sessão, sucesso não desloga).
