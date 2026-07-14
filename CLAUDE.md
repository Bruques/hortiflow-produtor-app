# HortiFlow Produtor — CLAUDE.md

## Como trabalhar com o desenvolvedor

- Sempre que criar ou modificar um arquivo, explique em 1–2 linhas o que ele faz e por que é necessário
- Antes de instalar uma dependência nova, explique o que ela faz
- Nunca faça algo "por convenção" sem explicar o motivo
- Se houver mais de uma forma de resolver, mencione qual escolheu e por quê
- **Nunca faça git commit a menos que o desenvolvedor peça explicitamente**
- Peça as tasks do roadmap abaixo uma de cada vez (ex: "vamos fazer a task 2"). Não implemente o app inteiro de uma vez — cada task é uma fatia vertical (backend + frontend) demonstrável sozinha.
- **Este projeto é construído com Spec-Driven Development (SDD)** — ver seção própria abaixo. O desenvolvedor ainda está aprendendo a prática, então explique o processo à medida que ele acontece, não assuma familiaridade.

---

## O que é esse projeto

**HortiFlow Produtor** é um SaaS para gerenciar **parcerias de meação** na produção de morango no Sul de Minas Gerais (Bom Repouso-MG). É um produto **separado** do HortiFlow original (`hortiflow-app`, que atende atravessadores) — público, domínio e modelo de dados diferentes. Não compartilha código, banco nem deploy com ele.

### O problema

Meação é a parceria agrícola comum na região: um ou mais sócios financiam a produção (terra, insumos, venda) e um ou mais sócios meeiros entram com mão de obra. No fim da safra, o lucro é dividido por um percentual acordado entre as partes. Hoje isso é feito de forma manual e opaca — a queixa recorrente (relatada por uma contadora da região, que identificou forte demanda por essa ferramenta) é que o meeiro "recebe por caixa, mas descontada", sem enxergar como o valor final foi calculado.

### Proposta de valor

Um app onde cada sócio de uma parceria registra despesas e vendas da safra e acompanha, em tempo real, um extrato transparente e auditável de quanto cada um vai receber — substituindo a prestação de contas manual por um cálculo que todos os lados enxergam e conferem.

Além disso, o app funciona como um **assessor de gestão financeira pessoal** para cada sócio: cada um também controla, no mesmo lugar, gastos que não entram na conta da sociedade (ex: gastos pessoais do financiador ou do meeiro), com o mesmo tipo de visão por dia/semana/mês/safra que já existe para a sociedade — só que privada, cada um vê apenas a própria.

### Caso real que motivou o modelo de dados

Um financiador bancou 100% dos custos (terra, insumos) e vendeu a produção, mas ficou com **60%** do lucro — não 100%. O sócio que entrou só com mão de obra ficou com **40%**. Ou seja: **o percentual de divisão do lucro é desacoplado de quanto cada um gastou.** Esse é o ponto central do domínio — ver seção de modelo de dados.

---

## Stack (mesmo padrão do HortiFlow original, reaproveitado como template — não como código)

- **Backend**: Node.js + Express + TypeScript, Prisma, PostgreSQL (Neon, projeto próprio, separado do HortiFlow)
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui, **responsivo mobile-first** (público é produtor rural, uso majoritário via celular — poucos campos por tela, botões grandes, favorecer seletores a texto livre, foto direto da câmera para comprovantes)
- **Auth**: JWT, mas por **telefone + senha** (não e-mail — público pode não checar e-mail no dia a dia)
- **Estrutura**: monorepo com pastas `backend/` e `frontend/`, mesmo padrão de camadas do HortiFlow original (`routes/controllers/services/middlewares`)

### MVP é web, mas a API precisa ficar pronta para um app nativo depois

O MVP é **só um app web responsivo** (sem app nativo agora — nativo vem depois de validar o MVP com a contadora e os produtores). Mas o backend precisa ser desenhado como uma **API REST stateless, agnóstica de cliente**, desde o início: nenhuma lógica de negócio acoplada a sessão de navegador, HTML ou cookies — só JWT no header. Isso já é natural com o padrão JWT herdado do HortiFlow, mas é importante manter disciplina: quando o app nativo (iOS/Android) for construído na Fase 2, ele deve conseguir consumir a mesma API sem precisar de nenhuma mudança no backend, só um novo client.

```
hortiflow-produtor-app/
├── backend/src/{routes,controllers,services,middlewares,lib}
├── backend/prisma/schema.prisma
├── frontend/src/{pages,components,services,types,lib}
├── docs/specs/     ← uma spec por task do roadmap, escrita antes do código (ver seção SDD)
└── (docker-compose.yml, quando necessário)
```

---

## Diferenças importantes em relação ao HortiFlow original

- **Nada de NF-e/Focus NFe** — é divisão de lucro interna entre sócios, não venda entre partes
- O "tenant" aqui é a **Sociedade** (a parceria), não uma Empresa fixa — um usuário pode participar de várias sociedades ao mesmo tempo
- Onboarding do meeiro por **código simples** (6 dígitos), não convite por e-mail/link
- Trilha de auditoria simples desde o MVP (quem lançou cada despesa/venda e quando) — existe potencial de desconfiança entre sócios, então "quem fez o quê" precisa ser rastreável

---

## Spec-Driven Development (SDD) — como cada task do roadmap é construída

Este projeto é construído seguindo **SDD**: antes de escrever qualquer código de uma task, escrevemos uma **spec** (um documento curto e objetivo descrevendo o que vai ser construído, como vai se comportar e como saber que está pronto) e só implementamos depois que a spec estiver clara e aprovada. A ideia é que a spec — não o código, não a memória da conversa — seja a fonte da verdade sobre o que cada funcionalidade deve fazer. Isso ajuda bastante quando várias tasks são pedidas em sessões separadas (o que é exatamente o caso aqui, pelo roadmap): a spec já registrada evita ter que reexplicar decisões e reduz o risco da IA "inventar" comportamento não combinado.

**Onde ficam**: `docs/specs/`, um arquivo por task (ex: `docs/specs/02-sociedade-e-socios.md`), numerado igual ao roadmap.

**Fluxo por task, sempre nesta ordem:**

1. **Spec primeiro** — quando o desenvolvedor pedir uma task do roadmap (ex: "vamos fazer a task 3"), o primeiro passo NÃO é codar. É escrever `docs/specs/0X-nome-da-task.md` com:
   - **Objetivo**: o que essa task entrega e por quê
   - **Escopo**: o que entra e o que explicitamente fica de fora (evita a IA "aproveitar" pra fazer mais do que foi pedido)
   - **Regras de negócio**: comportamento esperado, casos de borda, validações
   - **Contrato de API** (quando aplicável): rotas, payloads de entrada/saída
   - **Critérios de aceite**: lista objetiva do tipo "dado X, quando Y, então Z" — é isso que define quando a task está pronta
2. **Revisão da spec** — o desenvolvedor lê a spec (é curta, pensada pra ser lida em 2-3 minutos) e aprova ou pede ajuste, antes de qualquer linha de código ser escrita. Esse é o momento mais barato pra corrigir rumo — muito mais barato do que corrigir depois de já ter código pronto.
3. **Implementação a partir da spec aprovada** — só depois da aprovação a IA implementa backend + frontend daquela task, seguindo exatamente o que está escrito na spec. Se durante a implementação surgir uma decisão não coberta pela spec, ela é registrada na própria spec (não decidida silenciosamente).
4. **Verificação contra os critérios de aceite** — ao final, cada critério de aceite da spec é conferido um a um (rodando o app, não só type-check) antes de considerar a task concluída.

Isso é o motivo de as tasks do roadmap serem fatias verticais pequenas e numeradas: cada uma vira uma spec pequena e um ciclo curto de spec → aprovação → código → verificação, em vez de uma spec gigante pro app inteiro (que ficaria difícil de revisar e mais cara de manter atualizada).

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

### O cálculo precisa ser por período flexível (dia, semana, mês ou safra inteira), não só no fechamento final

Vendas normalmente acontecem quase todo dia, mas os acertos financeiros entre os sócios costumam ser **semanais** — só que isso não é regra fixa, varia de sociedade para sociedade (pode ser diário, quinzenal, mensal, ou só no fim da safra). Por isso o service de cálculo (`calcularDivisao`) recebe um **intervalo de datas** como parâmetro, e não está preso à noção de "só calcula quando a safra fecha". Qualquer tela do app deve poder perguntar "quanto cada sócio tem a receber das vendas de hoje / desta semana / deste mês / da safra inteira até agora", usando o mesmo service, só variando o filtro de data nas despesas/vendas passadas pra ele.

Isso implica na modelagem: em vez de um único "fechamento" só no fim da safra, existe o conceito de **Acerto** — um registro de que os sócios se acertaram financeiramente para um período específico (pode ser parcial, no meio da safra, ou final, encerrando a safra). Múltiplos acertos parciais podem acontecer ao longo de uma safra.

---

## Modelo de dados conceitual

- **Usuario** — pessoa física, pode participar de N sociedades
- **Sociedade** — a parceria em si (ex: "Sítio Boa Vista — safra dos Silva"). Unidade de isolamento de dados (papel equivalente ao `empresa_id` do HortiFlow original)
- **SocioSociedade** — associação Usuario↔Sociedade com `percentual_lucro` (deve somar 100% na sociedade) e papel informativo (financiador/meeiro/misto). **Suporta N sócios por natureza** — é uma tabela de associação, não uma FK binária. O caso "um financiador + dois meeiros dividindo a mão de obra" (ex: 60% / 20% / 20%) é só três linhas na mesma sociedade, sem mudança de modelo
- **Safra** — ciclo de produção (~1 ano no morango), com `status` (planejada/em andamento/encerrada). Todo lançamento pertence a uma safra
- **Despesa** — `safra_id`, `socio_id` (obrigatório — quem bancou), tipo (terra, mudas, adubo, defensivos, mão de obra, embalagem, transporte, outro), valor, data, foto de comprovante opcional
- **AporteTrabalho** (modelar desde já, mesmo se não entrar no MVP) — registro de dias/horas do meeiro que só contribui com mão de obra, para a tela dele não ficar vazia de contribuições
- **Venda** — safra_id, data, quantidade de caixas, preço por caixa, total, comprador (texto livre no MVP)
- **DespesaPessoal** — `usuario_id`, `safra_id` (vinculada à safra ativa, mesma filtragem por dia/semana/mês/safra do resto do app), tipo, valor, data, descrição opcional. **Não entra em nenhum cálculo da sociedade** (não é subtraída do lucro, não aparece em `calcularDivisao`, não aparece em Acerto) — é visível só para o próprio usuário que lançou, mesmo que ele seja financiador ou meeiro. Existe puramente para o sócio controlar o próprio financeiro dentro do app
- **RegraDespesaRecorrente** — define uma despesa da sociedade que se repete automaticamente, pra evitar lançamento manual repetitivo (ex: "R$1 por caixa vendida", "R$50/dia de diesel do frete"). Campos: `sociedade_id`, `socio_id` (a quem a despesa gerada será atribuída), `criado_por` (sempre o financiador — só ele configura regras recorrentes, mesmo quando a despesa é atribuída a outro sócio), `tipo_gatilho` (`por_venda` — valor por caixa, calculado automaticamente sobre a quantidade da Venda lançada; ou `por_periodo` — valor fixo recorrente, ex: diário), `valor`, `ativo`. No MVP a regra `por_periodo` **não gera a Despesa sozinha em background** — ela vira uma sugestão de 1 clique pro sócio confirmar no dia (evita lançamento de despesa "fantasma" sem o sócio revisar); esse comportamento é o mais provável de mudar depois (ex: virar 100% automático), por isso fica isolado nessa regra, sem se misturar à lógica de `calcularDivisao`
- **Acerto** — registro de que os sócios se acertaram financeiramente num período dentro da safra. Campos: `safra_id`, `data_inicio`, `data_fim`, `tipo` (parcial ou final — final também encerra a safra), `data_criacao`. Um Acerto é o snapshot congelado do cálculo daquele intervalo, pra que edições posteriores em despesas/vendas não alterem uma prestação de contas já feita. Pode haver vários Acertos parciais ao longo de uma safra (ex: semanais) e um Acerto final que fecha tudo — é o mesmo mecanismo, só muda o `tipo` e se o intervalo cobre a safra inteira
- **AcertoSocio** — detalhe por sócio dentro de um Acerto: despesas bancadas no período, percentual de lucro aplicado (snapshot, não referencia `SocioSociedade.percentual_lucro` ao vivo), valor de lucro recebido no período. É o "documento" que resolve a dor de transparência — pode virar PDF depois

---

## Jornadas principais

**Sócio financiador**: cria a sociedade → convida sócio(s) por código → define percentual de lucro de cada um → abre a safra → lança despesas e vendas → configura regras de despesa recorrente (ex: R$/caixa vendida, diesel/dia) → acompanha painel de simulação em tempo real, podendo filtrar por dia, semana, mês ou safra inteira ("quanto cada um tem a receber neste período?") → registra um Acerto quando os sócios se acertam de fato (parcial, ex: semanal, ou final, encerrando a safra). Em paralelo, mantém suas próprias despesas pessoais (fora da conta da sociedade) numa aba separada, pra controle financeiro próprio.

**Meeiro**: entra na sociedade via código → vê a mesma safra ativa com visão **não restrita** (todas as despesas e vendas de todos os sócios, não só as dele — transparência total é o ponto central do produto) → filtra o mesmo painel por período → acompanha o histórico de Acertos e o que tem a receber. Também tem sua própria aba de despesas pessoais, privada, sem relação com a conta da sociedade.

Na tela inicial, cada sócio (financiador ou meeiro) enxerga sempre duas frentes separadas: **despesas da sociedade** (o que entra na divisão) e **despesas pessoais** (o que é só dele, gestão própria).

---

## Escopo de MVP

- Auth por telefone + senha
- Sociedade (criar, convidar por código, definir % de lucro de N sócios somando 100%)
- Safra (abrir/fechar)
- Despesa da sociedade (CRUD com sócio obrigatório, tipo, valor, data, foto opcional)
- Despesa Pessoal (CRUD simples por usuário, vinculada à safra ativa, privada, fora do cálculo de divisão)
- RegraDespesaRecorrente (só o financiador cria/edita; gatilho `por_venda` calcula automático ao lançar Venda; gatilho `por_periodo` aparece como sugestão de 1 clique, não gera despesa sozinha em background)
- Venda (CRUD simples)
- Painel de acompanhamento com simulação em tempo real, filtrável por dia, semana, mês ou safra inteira
- Acerto (parcial ou final) com snapshot por período e extrato visível a qualquer sócio
- Mesma visão de dados para os dois perfis (sem permissões parciais no MVP)
- Responsivo mobile-first

**Fase 2** (não implementar sem pedido explícito): `AporteTrabalho` formal, fórmula de divisão configurável, PDF do extrato, notificações WhatsApp/SMS, lançamento de despesa via WhatsApp com IA (texto ou áudio), gatilho `por_periodo` de despesa recorrente virando 100% automático (sem confirmação de 1 clique), múltiplas safras/histórico comparativo, app nativo/PWA, permissões granulares, cadastro de comprador como entidade, modelo de cobrança do SaaS.

---

## Roadmap de tasks (peça uma por vez, cada uma passa por spec → aprovação → código → verificação)

1. **Setup** — scaffold do monorepo (backend Express+TS+Prisma, frontend React+TS+Tailwind), banco Neon novo, schema Prisma completo com todas as entidades acima, auth por telefone+senha
2. **Sociedade e sócios** — criar sociedade, adicionar N sócios com % de lucro (validando soma 100%), entrada via código simples
3. **Safra, despesas e despesa pessoal** — abrir safra, lançar/listar despesas da sociedade por sócio (com foto opcional), lançar/listar despesas pessoais privadas (não entram na divisão)
4. **Vendas e despesa recorrente** — lançar/listar vendas da safra; configurar `RegraDespesaRecorrente` (só financiador): gatilho `por_venda` gera despesa da sociedade automaticamente ao lançar venda, gatilho `por_periodo` aparece como sugestão de 1 clique
5. **Cálculo e painel de simulação** — service isolado de divisão (`calcularDivisao` com filtro de período) + tela com seletor de dia/semana/mês/safra mostrando lucro e divisão por sócio naquele intervalo
6. **Acerto** — registrar um Acerto (parcial ou final) para um período, gerar `Acerto`/`AcertoSocio`, tela de extrato auditável (boa candidata pra demo com a contadora); um Acerto do tipo final também encerra a safra
7. **Polimento mobile** — ajustes de UX pra celular (poucos campos por tela, câmera para comprovante, botões grandes)

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
