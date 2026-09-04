# Task 23 — Sócios independentes por safra

## Motivação

Hoje o percentual de lucro e a lista de sócios/meeiros pertencem à `Sociedade`, e toda `Safra` criada dentro dela herda automaticamente o mesmo conjunto — não existe hoje conceito de "sócios desta safra". Isso é um problema real relatado por usuários que têm mais de uma lavoura com parceiros diferentes (ex: lavoura A com o meeiro João a 60/40, lavoura B com a meeiro Maria a 70/30): ao criar a segunda safra, o app reaproveita os sócios/percentuais da anterior, sem opção de configurar do zero. Além de errar a divisão, isso vaza visibilidade — hoje qualquer sócio da sociedade enxerga todas as safras dela, então o meeiro da lavoura A acabaria vendo despesas/vendas da lavoura B.

Este incremento faz os sócios (quem participa e com qual percentual) e a visibilidade dos dados passarem a ser **por Safra**, não por Sociedade.

## Escopo

**Entra:**
- Tela "Nova safra" ganha uma pergunta "Esta safra vai ter sócios/meeiros, ou você vai trabalhar sozinho?" — se sozinho, a safra nasce com um único sócio (o criador, 100%); se não, mostra a lista de sócios com percentual, igual ao padrão já usado na tela de sócios da Sociedade
- Cada Safra passa a ter sua própria lista de sócios e percentuais, independente de qualquer outra Safra da mesma Sociedade
- Ao montar essa lista, o financiador pode reaproveitar um sócio já cadastrado na Sociedade (catálogo existente, ex: alguém que já é sócio em outra safra) ou cadastrar um sócio novo sem conta ali mesmo (nome + papel), igual ao fluxo já existente em Configurações
- **Visibilidade passa a ser por Safra**: um sócio só enxerga (despesas, vendas, painel de simulação, acertos) as safras em que está explicitamente na lista de sócios daquela safra — deixa de bastar ser sócio da Sociedade
- O titular da Sociedade (quem a criou — dono da assinatura) sempre tem acesso a todas as safras dela, mesmo que não conste na lista de sócios de alguma (rede de segurança administrativa, não precisa se auto-adicionar)
- Migração de dados: toda Safra já existente ganha a lista de sócios/percentuais copiada da Sociedade no momento da migração, preservando o comportamento e os cálculos já feitos (Acertos existentes continuam batendo)

**Fica de fora (registrar como pergunta em aberto):**
- Mudar o mecanismo de código de convite — continua sendo por Sociedade (entrar com código continua criando um `SocioSociedade`, ou seja, "cadastrado no catálogo da sociedade"); isso sozinho **não** dá acesso a nenhuma safra. O financiador precisa, além disso, adicionar essa pessoa na lista de sócios da(s) safra(s) específica(s). Avaliar depois se isso confunde o meeiro (ex: "entrei com o código mas não vejo nada ainda")
- Editar a lista de sócios de uma safra já em andamento (este incremento cobre só a criação) — se o desenvolvedor quiser mudar sócios/percentual no meio da safra, fica pra um próximo incremento, espelhando `PUT /sociedades/:id/socios/percentuais`
- Sociedades com múltiplas safras simultâneas ativas tendo sócios que se sobrepõem parcialmente — já é suportado pelo desenho (cada safra é independente), só não é um fluxo de UI dedicado além da tela de criação

## Regras de negócio

### Nova entidade: sócios da Safra
- Nova tabela `SocioSafra`, ligando `Safra` a `SocioSociedade` (o cadastro da pessoa continua vivendo em `SocioSociedade` — nome, papel, telefone se tiver conta — só o percentual e a participação passam a ser por safra)
- `percentual_lucro` fica em `SocioSafra`, não mais usado a partir de `SocioSociedade` para fins de cálculo (o campo em `SocioSociedade` permanece no schema só como valor herdado/histórico das safras já migradas — não é mais lido por `calcularDivisao`)

### Criar Safra com sócios
- `POST /safras` (rota existente) ganha um campo novo opcional: `socios: [{ socio_sociedade_id?: string, nome?: string, papel?: PapelSocio, percentual_lucro: number }]`
- Se **ausente ou vazio**: a safra nasce com um único `SocioSafra` — o usuário autenticado (criando/reaproveitando o `SocioSociedade` dele na sociedade), 100%, papel `MISTO`
- Se **presente**: precisa cobrir a soma de 100% (±0.01, mesma tolerância já usada em `PUT /sociedades/:id/socios/percentuais`) — 422 se não fechar
  - Cada item com `socio_sociedade_id` reaproveita um sócio já cadastrado na sociedade (precisa pertencer à mesma sociedade da safra — 404 se não pertencer)
  - Cada item sem `socio_sociedade_id` (mas com `nome`+`papel`) cria um `SocioSociedade` novo sem conta na sociedade (igual ao `POST /sociedades/:id/socios` de hoje) e o `SocioSafra` correspondente
- O usuário que está criando a safra não precisa aparecer na lista automaticamente quando `socios` é enviado — ele decide o próprio percentual como qualquer outro sócio (evita forçar 100%/N quando ele é só quem está cadastrando, mas não necessariamente sócio financeiro daquela safra específica — caso raro, mas o desenho não deveria impedir)

### Autorização passa a ser por Safra
- `ehSocioDaSafra(usuarioId, safraId)` (`backend/src/services/safras.service.ts`) deixa de checar `ehSocio` na Sociedade e passa a checar se existe `SocioSafra` cujo `SocioSociedade.usuario_id` é o usuário autenticado **para aquela Safra específica**, OU se o usuário é `Sociedade.criado_por_usuario_id` (titular, sempre autorizado)
- Isso já cobre, sem mudança adicional, todos os controllers que dependem dessa função: despesas, despesas pessoais, aportes de trabalho, vendas, simulação, relatório, relatório completo e acertos
- Rotas que continuam checando `ehSocio` no nível da Sociedade (não mudam): configurações de sócios da sociedade, `UnidadeVenda`, `RegraDespesaRecorrente` — são configuração da parceria como um todo, não de uma safra específica

### Cálculo de divisão
- `calcularDivisao` (`backend/src/services/divisao.service.ts`) não muda — já é agnóstico de onde vêm os sócios
- Os controllers que hoje chamam `sociedadesService.listarSocios(safra.sociedade_id)` passam a chamar uma nova função `listarSociosDaSafra(safraId)`, que junta `SocioSafra` + `SocioSociedade` (nome vem de `Usuario.nome` quando há conta, senão do campo `nome` do `SocioSociedade`)
- `RateioDespesa`, `RateioRegra` e `AcertoSocio` **não mudam de schema** — já referenciam `SocioSociedade.id` genericamente (spec 02, incremento sócio sem conta), que continua sendo o identificador da pessoa

## Contrato de API

```
POST /safras   (contrato muda)
  auth obrigatório, requer ser sócio da sociedade :sociedadeId (continua — criar safra é ação de nível sociedade)
  body: {
    nome: string,
    observacoes?: string,
    socios?: [{ socio_sociedade_id?: string, nome?: string, papel?: "FINANCIADOR"|"MEEIRO"|"MISTO", percentual_lucro: number }]
  }
  → 201 { safra: {...}, socios: [{ id, nome, percentual_lucro, papel }] }
  → 422 se `socios` enviado e a soma dos percentuais != 100 (±0.01)
  → 404 se algum socio_sociedade_id não pertence à sociedade da safra

GET /sociedades/:id/socios/catalogo   (novo)
  auth obrigatório, requer ser sócio da sociedade :id
  → 200 { socios: [{ id, nome, papel }] }  (lista enxuta pra popular o "reaproveitar sócio existente" na tela Nova Safra — sem percentual, que agora é por safra)

GET /safras/:id/socios   (novo)
  auth obrigatório, requer ser sócio DAQUELA safra (ou titular da sociedade)
  → 200 { socios: [{ id, nome, telefone: string|null, percentual_lucro, papel }] }
```

## Decisões de schema

```prisma
model SocioSafra {
  id                 String  @id @default(uuid())
  safra_id           String
  socio_sociedade_id String
  percentual_lucro   Decimal @db.Decimal(5, 2)
  criado_em          DateTime @default(now())

  safra          Safra          @relation(fields: [safra_id], references: [id])
  socioSociedade SocioSociedade @relation(fields: [socio_sociedade_id], references: [id])

  @@unique([safra_id, socio_sociedade_id])
  @@map("socios_safra")
}
```

- `SocioSociedade.percentual_lucro` permanece no schema (não é removido nesta task, pra não quebrar nenhuma leitura antiga) mas passa a ser ignorado por `calcularDivisao` — vira só o valor default sugerido na tela de sócios da Sociedade (configuração inicial), não fonte de verdade de nenhum cálculo
- **Migração de dados**: para cada `Safra` existente, criar um `SocioSafra` por `SocioSociedade` da sua `Sociedade`, copiando o `percentual_lucro` vigente na data da migração — preserva os Acertos já fechados e o painel de simulação de quem já usa o app hoje

## Critérios de aceite

1. Na tela "Nova safra", ao marcar "vou trabalhar sozinho", a safra é criada com um único sócio (o criador, 100%) e nenhuma tela extra de percentual aparece
2. Ao marcar "esta safra vai ter sócios", o usuário consegue adicionar um sócio novo (nome + papel + percentual) e/ou reaproveitar um sócio já cadastrado na sociedade, e só consegue confirmar a criação quando a soma fecha 100%
3. Dado uma Sociedade com Safra A (sócios X 60% / Y 40%) e Safra B (só o financiador, 100%, criada depois), o usuário Y consegue ver despesas/vendas/painel da Safra A mas recebe 403 ao tentar acessar a Safra B
4. O titular da sociedade (quem a criou) sempre consegue acessar a Safra B mesmo sem estar na lista de `SocioSafra` dela
5. Despesas, vendas, painel de simulação e Acerto da Safra A calculam a divisão usando os percentuais de `SocioSafra` da Safra A, e da Safra B usando os de `SocioSafra` da Safra B — mudar o percentual em uma não afeta a outra
6. Safras criadas antes desta mudança continuam com os mesmos sócios e os mesmos valores de Acertos já fechados, após a migração de dados
7. `POST /safras` com `socios` cuja soma seja diferente de 100% retorna 422 e não cria a safra
8. `POST /safras` com um `socio_sociedade_id` de outra sociedade retorna 404 e não cria a safra

## Perguntas em aberto

1. Entrar por código de convite continua só cadastrando a pessoa no catálogo da Sociedade, sem lhe dar acesso a nenhuma safra automaticamente — precisa validar com o desenvolvedor se isso gera confusão ("entrei e não vejo nada") e se merece uma mensagem explicativa na tela pós-entrada

---

## Incremento (2026-09-03): correção de vazamento entre sócios de safras diferentes

### Motivação

Relatado pelo desenvolvedor logo após o lançamento: um sócio adicionado só na Safra 2 conseguia ver, na tela "Sócios e Sociedade", os sócios da Safra 1 da mesma sociedade — a divisão passou a ser isolada por safra, mas a listagem de sócios (e o catálogo usado em "reaproveitar sócio existente") continuava checando só `ehSocio` (vínculo com a Sociedade), que qualquer sócio de qualquer safra da sociedade possui.

### Regra de negócio

- `GET /sociedades/:id/socios`, `GET /sociedades/:id/socios/catalogo`, `PATCH /sociedades/:id/socios/:socioId` e `DELETE /sociedades/:id/socios/:socioId` passam a restringir a visibilidade: o titular da sociedade continua vendo/editando o catálogo inteiro; qualquer outro sócio só vê/edita sócios com quem compartilha ao menos uma Safra (`SocioSafra` em comum)
- Tratado como "não encontrado" (não "não autorizado") quando o alvo de uma edição/remoção não é visível pro solicitante — evita confirmar pra quem pergunta se um determinado id existe na sociedade
- `POST /sociedades/:id/socios` e `PUT /sociedades/:id/socios/percentuais` não mudam (continuam abertos a qualquer sócio da sociedade, sem leitura de outros nomes envolvida)

### Critérios de aceite

1. Dado Financiador + Meeiro A na Safra 1, e Financiador + Meeiro B na Safra 2 (mesma sociedade), o Meeiro A não vê o Meeiro B em `GET /sociedades/:id/socios` nem no catálogo, e vice-versa
2. O titular da sociedade continua vendo os dois em ambas as consultas
3. Meeiro A tentando editar nome ou remover o Meeiro B recebe 404 (tratado como se não existisse)

---

## Incremento (2026-09-04): editar sócios de uma safra já em andamento

### Motivação

Levantado pelo desenvolvedor ao testar como titular: a tela de sócios continuava presa à Sociedade inteira (não à safra selecionada), mesmo depois da correção de vazamento acima — o titular via todos os sócios de todas as lavouras ao entrar por qualquer safra, quando o esperado era ver só quem participa daquela safra. Resolve a pergunta em aberto registrada na versão original desta spec ("editar sócios de uma safra já em andamento fica fora deste incremento").

### Escopo

**Entra:**
- A tela antes chamada "Sócios e Sociedade" (`ConfiguracoesSociosPage` no web, `SociosScreen` no mobile) passa a mostrar e editar só os sócios da **Safra selecionada**, não mais o catálogo inteiro da Sociedade — renomeada para "Sócios da safra"
- Adicionar sócio a uma safra já criada: reaproveitando um sócio já cadastrado na sociedade (catálogo) ou cadastrando um novo sem conta, igual ao fluxo de criação de safra
- Ajustar percentuais dos sócios de uma safra já criada, com a mesma validação de soma 100%
- Remover um sócio de uma safra já criada, com o percentual redistribuído entre os demais (mesma lógica de `removerSocio` da Sociedade), bloqueado se já tiver lançamentos **nessa safra** (despesas, aportes, rateios ou Acertos)

**Fica de fora:**
- Editar o nome de um sócio sem conta continua sendo uma ação de nível Sociedade (`PATCH /sociedades/:id/socios/:socioId`, já reaproveitável aqui porque a correção de vazamento acima já restringe isso a quem compartilha a safra) — não duplica em rota nova

### Regras de negócio

- `POST /safras/:id/socios` — adiciona um `SocioSafra` a uma safra existente. Com `socio_sociedade_id`: precisa pertencer à mesma sociedade da safra (404 se não) e ainda não estar na safra (409 se já estiver). Sem `socio_sociedade_id`: cria um `SocioSociedade` sem conta novo. Em ambos os casos, entra com 0% — ajuste é o passo seguinte
- `PUT /safras/:id/socios/percentuais` — mesma validação de `PUT /sociedades/:id/socios/percentuais` (precisa cobrir todos os `SocioSafra` atuais da safra, soma 100% ±0.01), mas escrevendo em `SocioSafra`, não em `SocioSociedade`
- `DELETE /safras/:id/socios/:socioId` — mesma lógica de `removerSocio` da Sociedade (bloqueia único sócio, auto-remoção e sócio com lançamentos), mas os lançamentos considerados são só os **dessa safra** (`Despesa`, `AporteTrabalho`, `RateioDespesa` e `AcertoSocio` filtrados por `safra_id`) — um sócio pode ser removido de uma safra mesmo tendo lançamentos em outra
- Todas as três rotas usam `ehSocioDaSafra` (não `ehSocio`) — consistente com o resto das rotas de safra

### Contrato de API

```
POST /safras/:id/socios
  auth obrigatório, requer ser sócio DESSA safra
  body: { socio_sociedade_id?: string, nome?: string, papel?: "FINANCIADOR"|"MEEIRO"|"MISTO" }
  → 201 { socios: [...] }
  → 400 se nem socio_sociedade_id nem nome informados
  → 404 se socio_sociedade_id não pertence à sociedade da safra
  → 409 se o sócio já participa dessa safra

PUT /safras/:id/socios/percentuais
  auth obrigatório, requer ser sócio DESSA safra
  body: { socios: [{ socio_sociedade_id: string, percentual_lucro: number }] }
  → 200 { socios: [...] }
  → 422 se a lista não cobre todos os sócios atuais da safra, ou soma != 100% (±0.01)

DELETE /safras/:id/socios/:socioId
  auth obrigatório, requer ser sócio DESSA safra
  → 200 { socios: [...] } (percentuais redistribuídos)
  → 404 se socioId não participa dessa safra
  → 409 se for o único sócio da safra, autor tentando remover a si mesmo, ou sócio com lançamentos nessa safra
```

### Critérios de aceite

1. Dada uma safra com só o financiador (100%), adicionar um sócio novo faz ele entrar com 0%; ajustar os percentuais pra 60/40 e salvar funciona
2. A mesma ação não afeta o percentual de nenhuma outra safra da mesma sociedade
3. Tentar salvar percentuais que não somam 100% retorna 422 e não altera nada
4. Remover um sócio sem lançamentos nessa safra funciona e redistribui o percentual dele; remover o único sócio, ou a si mesmo, retorna 409
5. Um sócio com despesas lançadas em outra safra da mesma sociedade (mas não nesta) pode ser removido normalmente desta
6. Frontend/mobile: tela "Sócios da safra" (chegada via Menu de uma safra) mostra e edita só os sócios dessa safra, com opção de reaproveitar sócio do catálogo ou cadastrar um novo
