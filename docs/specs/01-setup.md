# Task 1 — Setup

## Objetivo

Colocar de pé o esqueleto do monorepo (backend + frontend), o schema completo do banco de dados e a autenticação por telefone+senha. É a base sobre a qual todas as outras tasks do roadmap serão construídas — nenhuma delas depende de decisões de negócio ainda em aberto (ver "Perguntas em aberto" no CLAUDE.md), só de infraestrutura e modelagem.

## Escopo

**Entra:**
- Scaffold do backend: Node.js + Express + TypeScript, estrutura de pastas `routes/controllers/services/middlewares/lib`
- Scaffold do frontend: React + TypeScript + Tailwind + shadcn/ui, estrutura `pages/components/services/types/lib`
- Schema Prisma completo com **todas** as entidades do modelo de dados conceitual (Usuario, Sociedade, SocioSociedade, Safra, Despesa, AporteTrabalho, Venda, Acerto, AcertoSocio) — schema completo desde já, mesmo que as tasks seguintes só usem parte dele aos poucos
- Migração inicial aplicada em um projeto Neon novo, separado do HortiFlow original (banco já na nuvem, mas backend rodando local apontando pra ele)
- Auth por telefone + senha: cadastro, login, JWT, middleware de autenticação
- Variáveis de ambiente (`.env.example` em backend e frontend)
- Endpoint de health-check (`GET /health`) para validar que o backend local está de pé

**Fica de fora (não implementar nesta task):**
- Deploy no Railway — nesta task tudo roda local (backend local + Neon na nuvem); o projeto Railway novo fica pra quando fizer sentido colocar o app no ar
- Qualquer rota ou tela de Sociedade, Safra, Despesa, Venda ou Acerto (isso é das tasks 2 a 6 — o schema existe, mas os endpoints de CRUD dessas entidades não)
- Tela de login/cadastro no frontend com design final (só o suficiente pra provar que a API responde — pode ser uma tela mínima)
- Lógica de `calcularDivisao`
- Upload de foto de comprovante (schema já tem o campo, mas o fluxo de upload é da task 3)
- Qualquer decisão sobre fórmula de divisão (não é escopo desta task)

## Regras de negócio

### Autenticação
- Identificador de login: **telefone** (não e-mail), formato a definir na implementação (provavelmente string normalizada, ex: só dígitos com DDD)
- Senha: hash com bcrypt, nunca armazenada em texto plano
- Cadastro (`POST /auth/register`): nome, telefone, senha → cria Usuario
- Login (`POST /auth/login`): telefone + senha → retorna JWT
- JWT no header `Authorization: Bearer <token>` em todas as rotas autenticadas daqui em diante (nenhuma sessão de cookie/browser — API stateless, agnóstica de cliente, conforme CLAUDE.md)
- Telefone é único por Usuario

### Schema Prisma
- Todas as entidades do modelo conceitual do CLAUDE.md viram tabelas, com as relações descritas lá (Usuario N:N Sociedade via SocioSociedade; Safra pertence a Sociedade; Despesa/Venda pertencem a Safra; Despesa tem sócio obrigatório; Acerto pertence a Safra; AcertoSocio pertence a Acerto e a um sócio)
- `SocioSociedade.percentual_lucro` é decimal (não float, pra evitar erro de arredondamento)
- Nenhuma constraint de "soma 100%" a nível de banco nesta task — isso é validação de aplicação da task 2, quando a rota de criar sócios existir
- Enums onde o modelo já especifica valores fechados (ex: `tipo` de Despesa, `status` de Safra, `tipo` de Acerto, papel do sócio)

### Infraestrutura
- Projeto Neon novo, com seu próprio connection string (não reutiliza o banco do HortiFlow original)
- Backend e frontend rodando localmente nesta task; deploy (Railway) fica para uma etapa futura, fora do escopo desta task

## Contrato de API

```
GET  /health
  → 200 { status: "ok" }

POST /auth/register
  body: { nome: string, telefone: string, senha: string }
  → 201 { usuario: { id, nome, telefone }, token: string }
  → 409 se telefone já cadastrado

POST /auth/login
  body: { telefone: string, senha: string }
  → 200 { usuario: { id, nome, telefone }, token: string }
  → 401 se credenciais inválidas
```

Middleware de auth (`middlewares/auth.ts`): valida `Authorization: Bearer <token>`, popula `req.usuario` com o usuário autenticado; retorna 401 se token ausente/inválido. Será reaproveitado por todas as rotas das tasks seguintes.

## Critérios de aceite

1. Dado o repositório clonado, `npm install` (ou equivalente) roda sem erro em `backend/` e `frontend/`
2. Dado o schema Prisma aplicado (`prisma migrate dev`), todas as 9 entidades do modelo conceitual existem como tabelas no Neon
3. Dado `POST /auth/register` com telefone novo, então retorna 201 com token JWT válido e o usuário aparece no banco com senha hasheada (não em texto plano)
4. Dado `POST /auth/register` com telefone já existente, então retorna 409
5. Dado `POST /auth/login` com telefone e senha corretos, então retorna 200 com token JWT
6. Dado `POST /auth/login` com senha errada, então retorna 401
7. Dado um token JWT válido no header, uma rota protegida de teste retorna 200; sem token ou com token inválido, retorna 401
8. Dado o backend rodando localmente, `GET /health` responde 200
9. Frontend sobe localmente (`npm run dev` ou equivalente) e consegue chamar `/health` do backend local com sucesso (prova de que CORS e a URL da API estão configurados corretamente)

## Decisões registradas durante a implementação

- **Banco local via Docker Compose, não Neon**: como esta task roda tudo local, foi criado `docker-compose.yml` na raiz com Postgres 16 (mesmo padrão do HortiFlow original), na porta `5433` (não `5432`, que já está em uso pelo container do HortiFlow original) — evita depender de internet/Neon para desenvolver localmente. O projeto Neon novo fica reservado para quando o deploy for feito.
- Dependências de UI mais amplas do HortiFlow original (dialog, dropdown-menu, select, toast, lucide-react) não foram trazidas nesta task — só o essencial para a tela de login/cadastro (button, input, label, card). Serão adicionadas conforme as próximas tasks precisarem.
