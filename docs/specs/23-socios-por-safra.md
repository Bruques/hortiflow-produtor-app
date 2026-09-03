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
2. Editar a lista de sócios/percentuais de uma safra já em andamento fica fora deste incremento — avaliar se é uma necessidade imediata ou pode esperar
