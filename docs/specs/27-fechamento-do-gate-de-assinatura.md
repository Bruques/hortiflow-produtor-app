# 27 — Fechamento do gate de assinatura (fail-closed)

## Objetivo

A [spec 18](./18-assinatura-e-pagamento.md) definiu **quem** deve ser bloqueado por assinatura vencida (o titular/financiador, nunca o meeiro pela própria assinatura) e **quais rotas são isentas** (login, `/assinatura/status`, `/assinatura/cancelar`, webhooks). Essa regra continua 100% válida e não muda nesta spec.

O que mudou é como descobrimos, testando o app mobile, que a **implementação** dessa regra tem uma lacuna: o gate (`criarGateAssinatura`) só é aplicado em rotas escopadas por `:id` de Sociedade/Safra. Rotas escritas depois, sem `:id` mas que devolvem dado financeiro real — `GET /safras` e `GET /safras/resumo` — nunca foram conectadas ao gate. Resultado: um financiador com assinatura vencida abre o app, cai na tela de bloqueio, mas ao sair dela (mesmo sem pagar) a tela Início carrega normalmente com dado financeiro real, porque as chamadas que ela faz não são checadas.

A causa de fundo não é essas duas rotas em si — é o **modelo de proteção**: cada rota precisa "lembrar" de se conectar ao gate (opt-in). Isso funciona até a próxima rota nova esquecer de novo. Esta spec troca o modelo pra **opt-out explícito**: toda rota autenticada é classificada numa de três categorias conhecidas, e um teste automatizado garante que nenhuma rota fica sem classificação — se alguém (dev ou IA) criar uma rota nova e esquecer de classificá-la, o CI falha, em vez de vazar dado em produção silenciosamente.

## Escopo

**Entra:**
- Um **manifesto central** (`backend/src/middlewares/assinaturaGate.manifest.ts`) listando toda rota autenticada em uma de três categorias — ver "Regras de negócio"
- Um **teste de cobertura** que compara o manifesto contra as rotas de fato registradas no Express e falha se houver rota autenticada fora do manifesto
- Fix funcional: `GET /safras` e `GET /safras/resumo` passam a **filtrar por safra**, com base no titular de cada uma (`acessoLiberadoParaTitular`, já existente), em vez de devolver tudo sem checagem
- Busca em lote do status de assinatura dos titulares envolvidos numa resposta agregada (1 query, não N) — só pra não introduzir N+1 ao adicionar a checagem numa lista
- Ajuste em `InicioScreen` (mobile): hoje ela já lê `dados.vencida` de `GET /assinatura/status` e ignora; passa a usar esse sinal pra levar o usuário direto pro `AssinaturaBloqueio` quando a lista de safras vier vazia **por causa de vencimento**, em vez de mostrar uma tela genérica de "nenhuma safra"

**Fica de fora (não mexe nesta spec):**
- Qualquer mudança em quem é bloqueado ou por quê — regra de negócio já fechada na spec 18
- Cache de assinatura (Redis, claim no JWT) — não há volume que justifique agora; a busca em lote já resolve o N+1 no nosso tamanho atual de base de usuários. Fica registrado como próximo passo se algum dia o número de titulares por request crescer a ponto de pesar
- Rotas do frontend web (Vite) — o mesmo tipo de lacuna pode existir lá, mas o bug relatado foi só no mobile; auditar o web fica como item separado, fora desta spec
- Reestruturar `criarGateAssinatura` para rotas `:id` — essas já funcionam corretamente hoje e não são tocadas

## Regras de negócio

### As três categorias do manifesto

Toda rota autenticada (depois de `authMiddleware`) se encaixa em exatamente uma:

1. **Isenta** — nunca bloqueada, independente de assinatura. Ex.: `GET /assinatura/status`, `POST /assinatura/cancelar`, rotas `/admin/*`, webhooks, `GET /auth/perfil`. Esta lista é a mesma já descrita na spec 18, só formalizada num arquivo em vez de implícita.
2. **Escopada por recurso** — já tem `:id` de Sociedade ou Safra e já passa por `criarGateAssinatura`. Continua exatamente como está.
3. **Agregada** — devolve dado que combina recursos de titulares potencialmente diferentes (ex.: lista de safras do usuário, que pode incluir sociedades de mais de um financiador se o usuário for meeiro em várias). Não pode ser bloqueada em bloco (bloquear a resposta inteira quebraria o acesso a sociedades cujo titular está em dia) — precisa filtrar item por item.

Uma rota que não aparece em nenhuma das três é um erro de configuração, pego pelo teste de cobertura, nunca por comportamento em produção.

### Filtragem em rotas agregadas

- `GET /safras`: busca as safras do usuário (como já faz hoje), resolve o titular de cada uma, busca o status de assinatura de todos os titulares envolvidos **em uma única query**, e remove da lista as safras cujo titular está com assinatura vencida
- `GET /safras/resumo`: mesma lógica — safras de titular vencido são excluídas do cálculo consolidado, como se não existissem para aquele request
- Nenhuma das duas rotas devolve 402 — elas sempre respondem 200, só que com a lista/soma já filtrada. Quem decide se isso significa "bloqueado" é o app, comparando com `GET /assinatura/status` (ver próximo item)

### Sinal para a tela Início (mobile)

- `InicioScreen` já chama `GET /assinatura/status` e lê `dados.vencida` — hoje só usado pro banner de trial
- Passa a valer: se `GET /safras` voltar vazio **e** `dados.vencida === true`, navega para `AssinaturaBloqueio` em vez de mostrar a tela de "nenhuma safra ainda". Se vier vazio e `vencida === false`, mostra normalmente o estado de "crie sua primeira safra" (produtor novo, ainda não criou nada — não é bloqueio)

### Teste de cobertura

- Mantém uma lista de todas as rotas registradas nos routers do Express (`backend/src/routes/*.ts`) e verifica que cada uma está presente em exatamente uma das três listas do manifesto
- Roda no CI, junto dos demais testes de backend — falha o build, não passa despercebido

## Contrato de API

Nenhuma rota muda de path, método ou formato de payload de sucesso. A única mudança de comportamento observável:

```
GET /safras
  200: { safras: [...] }  — como já era, mas safras de titular com assinatura vencida
                             deixam de aparecer na lista (antes apareciam)

GET /safras/resumo
  200: { ... }  — como já era, mas o cálculo ignora safras de titular vencido
                   (antes elas entravam na soma)
```

Nenhum novo 402 nessas duas rotas — o comportamento de bloqueio continua sendo "a lista vem sem aquele dado", não um erro.

## Critérios de aceite

1. Dado um financiador com trial ativo (dentro dos 14 dias), quando chama `GET /safras` ou `GET /safras/resumo`, então vê todas as suas safras normalmente
2. Dado um financiador com assinatura vencida e uma única safra (a dele), quando chama `GET /safras`, então recebe lista vazia; quando chama `GET /safras/resumo`, então recebe o resumo zerado/vazio
3. Dado esse mesmo financiador vencido, quando abre o app mobile e cai na tela Início, então é redirecionado para `AssinaturaBloqueio` (não vê números reais de vendas/despesas)
4. Dado um meeiro de uma sociedade cujo titular está com assinatura em dia, quando chama `GET /safras`, então vê a safra dessa sociedade normalmente, mesmo que a assinatura pessoal do próprio meeiro (se existir) esteja vencida
5. Dado esse mesmo meeiro, mas agora numa sociedade cujo titular está vencido, quando chama `GET /safras`, então a safra dessa sociedade específica não aparece — mas safras de outras sociedades (de titulares em dia) continuam aparecendo
6. Dado um produtor recém-cadastrado sem nenhuma safra criada (não vencido, ainda em trial), quando abre a tela Início e a lista vem vazia, então vê a tela de "criar primeira safra", não a tela de bloqueio
7. Dado um usuário qualquer, quando chama rotas isentas (`GET /assinatura/status`, `POST /assinatura/cancelar`, login), então funciona normalmente independente de estar vencido
8. Dado um desenvolvedor (ou agente de IA) que adiciona uma rota autenticada nova sem incluí-la no manifesto, quando os testes de backend rodam, então o teste de cobertura falha, apontando a rota faltante
9. Dado um usuário com safras em sociedades de 3 titulares diferentes, quando chama `GET /safras/resumo`, então o backend faz no máximo 1 query adicional pra resolver o status de assinatura dos 3 titulares (não 3 queries separadas)

## Perguntas em aberto (assumidas nesta spec)

- Reproduzir o cenário exato do bug relatado (abrir checkout Pix, clicar "voltar pro início" sem pagar) deve navegar pra Início normalmente — o `navigation.replace('Inicio')` do `CheckoutScreen` não muda, só o que a Início faz ao carregar é que muda. Assumido que não é necessário alterar esse botão.
- Auditoria do frontend web (Vite) pra confirmar se tem a mesma lacuna fica registrada aqui como pendência, mas fora do escopo de implementação desta spec — a decidir se vira uma spec própria depois.
