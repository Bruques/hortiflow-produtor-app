# HortiFlow Produtor — CLAUDE.md

## Como trabalhar com o desenvolvedor

- Sempre que criar ou modificar um arquivo, explique em 1–2 linhas o que ele faz e por que é necessário
- Antes de instalar uma dependência nova, explique o que ela faz
- Nunca faça algo "por convenção" sem explicar o motivo
- Se houver mais de uma forma de resolver, mencione qual escolheu e por quê
- **Nunca faça git commit a menos que o desenvolvedor peça explicitamente**
- **Este projeto é construído com Spec-Driven Development (SDD)** — ver seção própria abaixo. O desenvolvedor ainda está aprendendo a prática, então explique o processo à medida que ele acontece, não assuma familiaridade.

---

## O que é esse projeto

**HortiFlow Produtor** é um SaaS para gerenciar **parcerias de meação** na produção de morango no Sul de Minas Gerais (Bom Repouso-MG). É um produto **separado** do HortiFlow original (`hortiflow-app`, que atende atravessadores) — público, domínio e modelo de dados diferentes. Não compartilha código, banco nem deploy com ele.

Meação é a parceria agrícola comum na região: um ou mais sócios financiam a produção (terra, insumos, venda) e um ou mais sócios meeiros entram com mão de obra. No fim da safra, o lucro é dividido por um percentual acordado entre as partes. Hoje isso é feito de forma manual e opaca — a queixa recorrente (relatada por uma contadora da região, que identificou forte demanda por essa ferramenta) é que o meeiro "recebe por caixa, mas descontada", sem enxergar como o valor final foi calculado.

**Proposta de valor**: um app onde cada sócio registra despesas e vendas da safra e acompanha, em tempo real, um extrato transparente e auditável de quanto cada um vai receber. Além disso, funciona como assessor de gestão financeira pessoal: cada sócio também controla, no mesmo lugar, gastos que não entram na conta da sociedade — privados, cada um vê só os próprios.

**Caso real que motivou o modelo de dados**: um financiador bancou 100% dos custos e vendeu a produção, mas ficou com **60%** do lucro — não 100%. O sócio que entrou só com mão de obra ficou com **40%**. Ou seja: **o percentual de divisão do lucro é desacoplado de quanto cada um gastou.** Esse é o ponto central do domínio.

---

## Stack

- **Backend**: Node.js + Express + TypeScript, Prisma, PostgreSQL (Neon, projeto próprio, separado do HortiFlow)
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui, **responsivo mobile-first** (público é produtor rural, uso majoritário via celular — poucos campos por tela, botões grandes, favorecer seletores a texto livre, foto direto da câmera para comprovantes)
- **Auth**: JWT, por **telefone + senha** (não e-mail — público pode não checar e-mail no dia a dia)
- **Estrutura**: monorepo com pastas `backend/` e `frontend/`, camadas `routes/controllers/services/middlewares`

### API precisa continuar agnóstica de cliente

O app hoje é só web responsivo, mas o backend é uma **API REST stateless**: nenhuma lógica de negócio acoplada a sessão de navegador, HTML ou cookies — só JWT no header. Isso mantém a porta aberta para um cliente nativo (iOS/Android) no futuro consumir a mesma API sem mudança no backend.

```
hortiflow-produtor-app/
├── backend/src/{routes,controllers,services,middlewares,lib}
├── backend/prisma/schema.prisma
├── frontend/src/{pages,components,services,types,lib}
└── docs/specs/     ← uma spec por funcionalidade, escrita antes do código (ver seção SDD)
```

---

## Ambientes e fluxo de deploy

Existem dois ambientes, cada um com seu próprio frontend (Vercel), backend (Railway) e banco (Neon) — nenhum recurso é compartilhado entre eles:

| | Branch | Frontend | Backend | Banco |
|---|---|---|---|---|
| **Produção** | `main` | `hortiflow-produtor-frontend.vercel.app` (projeto `hortiflow-produtor`) | ambiente `production` no Railway | branch `main`/produção do Neon |
| **Staging** | `develop` | `hortiflow-produtor-develop.vercel.app` (projeto `hortiflow-produtor-develop`) | ambiente `develop` no Railway | branch `develop` do Neon (isolada, criada a partir da produção) |

**Fluxo de trabalho, sempre nessa ordem:**

1. Commits e pushes do dia a dia vão para a branch `develop` — nunca direto para `main`
2. Cada push em `develop` builda automaticamente o staging (frontend + backend), sem afetar produção — é onde se testa no navegador, no celular (inclusive iPhone) e onde se manda o link para terceiros validarem (ex: primo, cliente), já que essa URL não exige login
3. Só depois de validado em staging, faz-se merge (ou PR) de `develop` → `main`, o que dispara o deploy real de produção

O projeto de staging na Vercel foi criado com a proteção de SSO desativada (`ssoProtection: null` via API) porque o plano Hobby não permite desligar isso pela tela de "Deployment Protection" — só assim a URL fica acessível sem exigir login na conta Vercel.

---

## Diferenças importantes em relação ao HortiFlow original

- **Nada de NF-e/Focus NFe** — é divisão de lucro interna entre sócios, não venda entre partes
- O "tenant" aqui é a **Sociedade** (a parceria), não uma Empresa fixa — um usuário pode participar de várias sociedades ao mesmo tempo
- Onboarding do meeiro por **código simples** (6 dígitos), não convite por e-mail/link
- Trilha de auditoria simples desde o MVP (quem lançou cada despesa/venda e quando) — existe potencial de desconfiança entre sócios, então "quem fez o quê" precisa ser rastreável

---

## Spec-Driven Development (SDD) — como cada funcionalidade nova é construída

Antes de escrever qualquer código de uma funcionalidade nova, escrevemos uma **spec** (documento curto descrevendo o que vai ser construído, como vai se comportar e como saber que está pronto) e só implementamos depois que a spec estiver clara e aprovada. A spec — não o código, não a memória da conversa — é a fonte da verdade sobre o que cada funcionalidade deve fazer.

**Onde ficam**: `docs/specs/`, um arquivo por funcionalidade (ex: `docs/specs/02-sociedade-e-socios.md`).

**Fluxo, sempre nesta ordem:**

1. **Spec primeiro** — antes de codar, escrever `docs/specs/0X-nome.md` com: Objetivo, Escopo (o que entra e o que fica de fora), Regras de negócio, Contrato de API (quando aplicável), Critérios de aceite ("dado X, quando Y, então Z")
2. **Revisão da spec** — o desenvolvedor lê e aprova (ou pede ajuste) antes de qualquer linha de código
3. **Implementação a partir da spec aprovada** — se surgir uma decisão não coberta pela spec durante a implementação, ela é registrada na própria spec, não decidida silenciosamente
4. **Verificação contra os critérios de aceite** — rodando o app, não só type-check

As specs já escritas (`docs/specs/01` a `07`) cobrem o MVP e continuam sendo a fonte de verdade sobre regras de negócio já implementadas — consulte-as antes de mexer em telas/rotas existentes.

---

## Regra crítica de arquitetura: cálculo de divisão isolado

A fórmula de divisão do lucro **ainda não foi validada com a contadora** e é a parte mais provável de mudar depois de conversar com produtores reais (ver "Perguntas em aberto"). Por isso:

**Todo o cálculo de divisão vive em um único service puro**, algo como:

```ts
calcularDivisao(despesas, vendas, socios, periodo) → DivisaoSocio[]
```

Controllers e telas apenas chamam esse service e exibem o resultado — nenhuma lógica de divisão espalhada em rotas, controllers ou frontend. Trocar a fórmula deve ser uma mudança em um arquivo só, sem tocar em auth, cadastro de sociedade, despesas ou vendas.

Fórmula base atual (a confirmar):
```
Lucro Líquido (do período) = Receita (Vendas do período) − Despesas (do período, de todos os sócios)
Valor do Sócio X (no período) = Lucro Líquido (do período) × percentual_lucro(X)
```

Existe uma variação comum em meação onde quem bancou é reembolsado integralmente primeiro, e só o restante é dividido pelo percentual — o modelo de dados já guarda despesas bancadas e lucro recebido separadamente por sócio no acerto, exatamente para suportar essa mudança sem redesenho de schema.

O cálculo é por **período flexível** (dia, semana, mês ou safra inteira) — o service recebe um intervalo de datas como parâmetro, não está preso à noção de "só calcula quando a safra fecha". Isso é o que sustenta o conceito de **Acerto**: um registro de que os sócios se acertaram financeiramente para um período específico (parcial, no meio da safra, ou final, encerrando a safra). Múltiplos acertos parciais podem acontecer ao longo de uma safra.

---

## Modelo de dados

O schema completo está em `backend/prisma/schema.prisma` — é a fonte de verdade sobre campos e relações. Pontos de negócio que **não** ficam óbvios só de ler o schema:

- **SocioSociedade** — `percentual_lucro` deve somar 100% na sociedade; suporta N sócios por natureza (ex: 1 financiador + 2 meeiros em 60/20/20 é só três linhas, sem mudança de modelo)
- **DespesaPessoal** — vinculada à safra ativa, mas **não entra em nenhum cálculo da sociedade** (não é subtraída do lucro, não aparece em `calcularDivisao` nem em Acerto) — visível só pra quem lançou
- **RegraDespesaRecorrente** — só o financiador cria/edita. Gatilho `por_venda` calcula automático ao lançar Venda; gatilho `por_periodo` **não gera despesa sozinho em background** — vira sugestão de 1 clique pro sócio confirmar (evita despesa "fantasma" sem revisão). Esse comportamento é o mais provável de mudar (ex: virar 100% automático), por isso fica isolado, sem se misturar à lógica de `calcularDivisao`
- **Acerto / AcertoSocio** — snapshot congelado do cálculo daquele intervalo (percentual e valores gravados, não referenciam `SocioSociedade` ao vivo), pra que edições posteriores em despesas/vendas não alterem uma prestação de contas já feita

---

## Jornadas principais

**Sócio financiador**: cria a sociedade → convida sócio(s) por código → define percentual de lucro → abre a safra → lança despesas e vendas → configura regras de despesa recorrente → acompanha painel de simulação em tempo real (dia/semana/mês/safra) → registra um Acerto quando os sócios se acertam de fato. Em paralelo, mantém suas próprias despesas pessoais numa aba separada.

**Meeiro**: entra via código → vê a mesma safra ativa com visão **não restrita** (todas as despesas e vendas de todos os sócios — transparência total é o ponto central do produto) → filtra o mesmo painel por período → acompanha histórico de Acertos. Também tem sua própria aba de despesas pessoais, privada.

---

## Estado atual do projeto

O MVP (auth, sociedade/sócios, safra, despesas/despesa pessoal, vendas/despesa recorrente, cálculo/painel de simulação, Acerto) está **implementado e concluído** — specs em `docs/specs/01` a `07`.

Depois do MVP, o projeto passou por um **redesign visual** das telas existentes a partir de wireframes (não é funcionalidade nova, é reestilização reaproveitando a lógica já implementada):

- **Onde está**: `docs/design/` — `wireframes.html`, `notas-de-design.md` (decisões visuais) e `checklist-telas.md` (progresso por tela)
- **Falta apenas**: tela de **Splash/Carregando** (`frontend/src/assets/Logo hortiflow.png`, sem depender de spec funcional) — a implementar quando o desenvolvedor pedir
- A tela "Cadastrar meeiro" do wireframe **não será implementada** (decisão do dev, 2026-07-16) — o convite por código continua resolvido pela tela Configurações
- **Se o desenvolvedor pedir "vamos implementar a tela de X"**: confira `docs/design/checklist-telas.md` e siga a spec funcional + notas de design indicadas ali. Antes de reescrever, olhe o componente atual (já existe e funciona) para não perder lógica validada

**Fase 2 (não implementar sem pedido explícito)**: `AporteTrabalho` formal, fórmula de divisão configurável, PDF do extrato, notificações WhatsApp/SMS, lançamento de despesa via WhatsApp com IA, gatilho `por_periodo` virando 100% automático, múltiplas safras/histórico comparativo, app nativo/PWA, permissões granulares, cadastro de comprador como entidade, modelo de cobrança do SaaS.

---

## Perguntas em aberto (validar com a contadora/produtores antes de fechar a fórmula de divisão)

1. A divisão aplica o % direto sobre o lucro líquido, ou reembolsa quem bancou despesas antes de dividir o restante?
2. O percentual de lucro é fixo por toda a parceria ou pode mudar a cada safra?
3. A mão de obra do meeiro entra em algum cálculo monetário ou é puramente informativa?
4. Existem sociedades com mais de 2 sócios na prática da região, ou é quase sempre binário?
5. Quem "fecha" a safra — precisa de confirmação dos dois lados, ou uma parte fecha e a outra só visualiza?
6. Há demanda por fluxo de contestação de despesa lançada pelo outro sócio?
7. Existe documento legal de parceria rural que devesse ser gerado/anexado no sistema?
8. Modelo de cobrança do SaaS ainda não definido — quem paga (financiador, por sociedade, por safra, add-on do HortiFlow original)?
9. Volume real de parcerias na região, para dimensionar a necessidade de multi-tenancy robusto desde o dia 1.
