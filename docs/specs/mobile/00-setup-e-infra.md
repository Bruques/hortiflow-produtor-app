# Mobile 00 — Setup e infraestrutura

## Objetivo

Colocar de pé o esqueleto do app mobile nativo (Expo/React Native + TypeScript) dentro do monorepo existente, consumindo a API REST já em produção/staging — sem duplicar nenhuma lógica de negócio, só a infraestrutura mínima pra próximas specs (auth, sociedade, despesas, etc.) terem uma base sólida pra construir em cima.

Um dos motivadores centrais do app mobile é funcionar **offline** (produtor na roça, sem internet — ver seção própria no `CLAUDE.md`), então esta spec também estabelece a camada de persistência local e a fila de sincronização que toda spec de escrita (despesas, vendas, despesa pessoal) vai depender.

## Escopo

**Entra:**
- Nova pasta `mobile/` na raiz do monorepo, ao lado de `backend/` e `frontend/`
- Scaffold Expo + TypeScript, estrutura de pastas espelhando o padrão do `frontend/` (`screens/components/services/types/lib`), adaptando `pages` → `screens` (convenção React Native)
- Navegação básica com **React Navigation** (stack + bottom tabs), só com uma tela de login e uma tela "home" vazia (placeholder) — sem telas de negócio ainda
- Cliente de API (`services/apiClient.ts`), mesma responsabilidade do equivalente web: `axios` com `baseURL` configurável por variável de ambiente e interceptor que injeta `Authorization: Bearer <token>`
- Armazenamento do token com `expo-secure-store` (ver "Regras de negócio" — por que não `AsyncStorage`)
- Tela de login mínima, consumindo `POST /auth/login` já existente no backend (sem tela de cadastro nesta spec — cadastro de sócio pelo app fica pra uma spec de negócio futura)
- Variáveis de ambiente (`.env.example` em `mobile/`, usando prefixo `EXPO_PUBLIC_*` exigido pelo Expo)
- Configuração de testes: Jest + `@testing-library/react-native`, com um teste de exemplo cobrindo o interceptor do cliente de API (garante que o padrão de teste já existe pra specs seguintes seguirem)
- `eas.json` mínimo (perfis `development`/`preview`/`production`), só configuração — sem rodar build de verdade
- CI: workflow de teste/lint do mobile com gatilho **por pasta** (`paths: mobile/**`), pra mudanças em `frontend/`/`backend/` não dispararem nada do mobile e vice-versa (ver conversa sobre isolamento de deploy)
- **Banco local no dispositivo** (`expo-sqlite`) pra guardar os dados já buscados da API (nesta spec, só a estrutura genérica de cache — as tabelas de negócio, tipo despesas/vendas, são criadas em cada spec que introduz aquela entidade)
- **Fila de sincronização genérica**: mecanismo reaproveitável de "salvar localmente + marcar como pendente + tentar enviar quando houver conexão", sem nenhuma fila de negócio concreta ainda (a fila de despesas/vendas é implementada na spec de cada uma, usando esse mecanismo)
- **Detecção de conectividade** (`@react-native-community/netinfo`) e um componente simples de aviso ("sem conexão — mostrando últimos dados salvos"), reaproveitável por qualquer tela

**Fica de fora (não implementar nesta spec):**
- Qualquer tela de negócio: Sociedade, Safra, Despesas, Vendas, Painel de simulação, Acerto, Despesa Pessoal — cada uma é uma spec própria (01 a 05)
- Cadastro de usuário pelo app (tela de registro) — entra na spec de Auth (01) se fizer sentido, ou fica fora do MVP mobile por decisão de produto
- Build real via EAS Build / submissão nas lojas (TestFlight, Google Play Internal Testing) — infraestrutura de deploy fica pra uma spec própria, depois que houver telas suficientes pra valer a pena instalar
- OTA update (`EAS Update`) configurado — só faz sentido depois de existir pelo menos um build nativo publicado
- Ícone, splash screen e nome final do app — usa placeholder do Expo por enquanto
- Push notifications, câmera, qualquer permissão nativa — entram quando a tela que precisar delas for especificada (ex: spec de Despesas, que precisa de foto de comprovante)
- Upload de foto de comprovante — mesmo caso do item acima
- Fila de sincronização **de negócio** (despesas/vendas pendentes de envio) — nesta spec só existe o mecanismo genérico; a fila concreta de cada entidade é escopo da spec que introduz aquela entidade
- Resolução de conflito de sincronização (dois lançamentos offline concorrentes) — a spec de Despesas/Vendas decide se isso é sequer possível dado o modelo de dados (cada sócio só lança o que ele mesmo fez) antes de desenhar qualquer resolução

## Regras de negócio

### Estrutura de pastas e dependência entre `mobile/` e `frontend/`
- `mobile/` é um pacote independente, com seu próprio `package.json` — **não** usar npm workspaces/monorepo tooling (Turborepo, Nx) nesta spec. Motivo: o time é de 1 dev, o ganho de compartilhar código automaticamente não compensa ainda a complexidade de configurar workspaces; se a duplicação de tipos entre `frontend/` e `mobile/` doer na prática (specs seguintes vão revelar isso rápido, já que cada uma tem um contrato de API), revisitamos essa decisão numa spec futura
- Tipos TypeScript (`types/despesa.ts`, `types/venda.ts`, etc.) são **copiados manualmente** de `frontend/src/types/` conforme cada spec de negócio precisar — não há import cruzado entre as pastas `mobile/` e `frontend/`
- Componentes de UI **não são reaproveitados** do frontend (Tailwind/shadcn são web-only) — cada tela mobile é construída do zero com componentes React Native, seguindo a mesma lógica de negócio já validada nas specs `01` a `13` da web

### Autenticação e armazenamento de token
- Login consome o mesmo endpoint já existente: `POST /auth/login` (`{ telefone, senha }` → `{ usuario, token }`), sem mudança no backend
- Token JWT é salvo com **`expo-secure-store`**, não `AsyncStorage`: `AsyncStorage` grava em texto plano no armazenamento do app, enquanto `expo-secure-store` usa Keychain (iOS) / Keystore (Android) — como o token dá acesso a dados financeiros da sociedade, o padrão mais seguro é o ponto de partida, não uma otimização posterior
- Nenhuma tela além de login nesta spec verifica o token — a tela "home" placeholder só existe pra provar que a navegação pós-login funciona

### Variáveis de ambiente
- `EXPO_PUBLIC_API_URL` aponta pro backend de staging por padrão em desenvolvimento (`hortiflow-produtor-develop` no Railway), never hardcoded pra produção
- Expo exige o prefixo `EXPO_PUBLIC_` pra expor a variável ao JS bundlado (diferente do `VITE_` usado no frontend) — mesma ideia, convenção diferente por ser outro bundler

### Offline-first (persistência local e fila de sincronização)
- **`expo-sqlite`**, não `AsyncStorage`, é o banco local: dados de negócio (despesas, vendas, etc., a partir das specs seguintes) têm estrutura relacional simples e crescem em volume ao longo da safra — SQLite consulta por período/safra sem carregar tudo em memória, o que `AsyncStorage` (chave-valor) não oferece de graça
- Toda tela que lista dados vindos da API segue o mesmo padrão: mostra o que está salvo localmente primeiro (mesmo offline), busca atualização em background quando há conexão, e atualiza a tela quando a resposta chega — nunca uma tela em branco só porque não há internet no momento
- A fila de sincronização desta spec é só o mecanismo (tabela `sync_queue` genérica: operação, payload, tentativas, status), sem nenhuma regra de quando/o que sincronizar — isso é decidido por cada spec de escrita
- Indicador de conectividade fica visível de forma discreta (ex: banner no topo), não como modal bloqueante — o produtor precisa conseguir continuar usando o app com ele visível

### Testes
- Jest é o test runner (padrão do ecossistema Expo/React Native), com `@testing-library/react-native` pra testes de componente
- Nesta spec, o único teste obrigatório é o do interceptor do `apiClient` (garante que o header `Authorization` é injetado quando há token salvo, e omitido quando não há) — serve de exemplo de padrão pras specs seguintes escreverem teste de cada critério de aceite
- CI roda `npm test` no mobile a cada push que toca `mobile/**`, mesmo gatilho por pasta usado pro build/lint

## Critérios de aceite

1. Dado o repositório clonado, `npm install` roda sem erro dentro de `mobile/`
2. Dado `npx expo start` (ou `npm run start`) rodando localmente, o app abre no Expo Go (ou simulador) sem erro de build
3. Dado o backend de staging no ar, a tela de login consegue autenticar com telefone/senha válidos e navegar pra tela "home" placeholder
4. Dado um telefone/senha inválidos, a tela de login mostra mensagem de erro (sem crash, sem tela em branco)
5. Dado um token salvo com sucesso após login, fechar e reabrir o app mantém a sessão (não volta pra tela de login) — prova que `expo-secure-store` está persistindo entre execuções
6. Dado o teste unitário do `apiClient`, `npm test` passa localmente e no CI
7. Dado um push que só altera arquivos em `frontend/` ou `backend/`, o workflow de CI do mobile **não** é disparado
8. Dado um push que altera algo em `mobile/`, o workflow de CI do mobile roda lint + teste
9. Dado o app aberto sem conexão de internet, o banner de "sem conexão" aparece e o app não trava nem mostra tela em branco
10. Dado um registro genérico de teste inserido na fila de sincronização (`sync_queue`) enquanto offline, ao a conexão voltar o item é enviado automaticamente e marcado como sincronizado, sem ação manual do usuário
11. Dado o mecanismo de fila de sincronização, existe teste unitário cobrindo pelo menos: inserir item pendente, marcar como sincronizado com sucesso, e manter como pendente se o envio falhar (ex: erro de rede simulado)

## Decisões registradas durante a implementação

- **Imports relativos em vez de alias `@/`**: o alias exigiria configurar `tsconfig.json` paths + Metro + Jest de forma consistente entre si, com risco real de desalinhamento entre ferramentas (o próprio scaffold do Expo alerta, via `AGENTS.md` gerado, que a API/configuração muda bastante entre versões do SDK). Import relativo é mais verboso mas não depende de nenhuma configuração adicional funcionando certa nas três ferramentas ao mesmo tempo.
- **`expo-asset` precisou ser adicionado como dependência explícita**: `expo-sqlite` importa `expo-asset` internamente (`expo-sqlite/build/hooks.js`), mesmo sem usarmos os hooks — sem essa dependência, tanto o bundle real (Metro) quanto os testes (Jest) quebram ao importar `expo-sqlite`. Só apareceu quando algo do app de verdade (não só um teste com o módulo mockado) importou a cadeia `syncTrigger → syncQueue → database → expo-sqlite`.
- **Fila de sincronização ganhou retry automático de itens com status `erro`**: a spec original só previa `pendente`/`sincronizado`/`erro` sem detalhar se um item com erro é tentado de novo. Decisão: itens `erro` voltam a ser processados na próxima tentativa (junto dos `pendente`) — uma falha de rede é comum e não deveria exigir ação manual do produtor; uma falha permanente (dado inválido) só será tratada de forma diferenciada quando uma spec de negócio (`04`) precisar disso.
- **Mecanismo de registro (`registrarProcessador`/`sincronizarTudo`) adicionado além do `processarPendentes` genérico**: a spec previa "tentar enviar quando houver conexão" mas não detalhava quem dispara isso. Adicionado um registro simples (operação → função de envio) e um gatilho (`syncTrigger.ts`) que assina mudanças de conectividade e chama `sincronizarTudo()` só na transição offline→online — assim a sincronização automática não exige nenhuma ação do produtor, sem o mecanismo genérico precisar conhecer nenhuma regra de negócio concreta (despesa, venda etc. se registram nas specs seguintes).
- **`.gitignore` do mobile ajustado**: o template do Expo só ignorava `.env*.local`; adicionado `.env` explicitamente, já que é onde a URL real do backend fica.
- **`.env.example` não tem uma URL de staging real preenchida** — o desenvolvedor precisa substituir pelo endpoint real do backend `develop` no Railway ao criar seu `.env` local; não foi assumida/inventada uma URL.
- **`eas.json` criado só com os 3 perfis de build (`development`/`preview`/`production`)**, sem `projectId` — isso exige `eas login`/`eas init` numa conta Expo, passo manual que só o desenvolvedor pode fazer (credencial pessoal).
- **Validado sem simulador/dispositivo físico**: o ambiente de implementação não tem Xcode/Android Studio nem device conectado. A validação foi feita via `npx expo export --platform ios` (bundling completo, 883 módulos, sem erro) — confirma que toda a cadeia de imports resolve e o app buildaria, mas os critérios de aceite que dependem de interação real (login navegando pra Home, banner de conexão aparecendo, sessão sobrevivendo a fechar o app) ainda precisam ser conferidos rodando o app de verdade num dispositivo/simulador.
