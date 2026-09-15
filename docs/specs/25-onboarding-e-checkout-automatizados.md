# 25 — Onboarding e checkout automatizados

## Objetivo

Substituir a atribuição manual de plano da [spec 18](./18-assinatura-e-pagamento.md) — hoje sempre feita pelo desenvolvedor numa visita presencial — por um **fluxo de autocadastro** em que o próprio produtor: cria a conta, responde um formulário rápido, recebe um plano recomendado automaticamente, escolhe entre mensal ou anual, começa o trial de 14 dias sem cartão, e — se quiser continuar depois do trial — paga direto dentro do app via **Mercado Pago** (Pix ou cartão).

Esta spec implementa o **Fluxo A** já validado em wireframe com o desenvolvedor (canvas de exploração publicado durante o planejamento): Cadastro → Formulário → Plano → Home com banner de trial → bloqueio pós-trial → checkout in-app.

**Web e mobile, os dois**: o fluxo completo foi implementado tanto no app mobile quanto no frontend web — mesma API, mesmas regras, só a forma de abrir o checkout hospedado muda (WebView/navegador externo no mobile via `expo-web-browser`, redirecionamento de página no web).

**Relação com a spec 18 — o que muda e o que fica:**

| Tópico | Spec 18 (hoje) | Esta spec (25) |
|---|---|---|
| Quem atribui o plano | Você, na visita presencial | Automático, pelo formulário — mas o **painel admin continua existindo** pra você atribuir/trocar manualmente quando quiser (coexistência, não substituição) |
| Critério do plano | Quantidade de pés de morango | Quantidade de sócios meeiros |
| Ciclo de cobrança | Só mensal | Mensal **e** anual |
| Forma de pagamento | Só cartão recorrente, via link Asaas enviado por fora do app | Cartão e Pix, **dentro do app** |
| Gateway | Asaas | Mercado Pago |
| Tela pós-trial vencido | Mensagem fixa pedindo contato | CTA "Assinar agora" que leva direto ao checkout in-app — o caminho de contato manual continua existindo como alternativa secundária |
| Trial, gate 402 (tempo), cancelamento, pagamento manual, painel admin | — | **Sem mudança de mecanismo** — só mudam os nomes de campo ligados ao gateway (Asaas → Mercado Pago) |
| Gate 403 (limite de safras ativas) | 1 / 3 / ilimitado, ligado aos planos por pés de morango | Mecanismo igual, mas o número agora é o teto da faixa de meeiros de cada plano: 3 / 10 / ilimitado |

**Por que coexistir com o caminho manual**: o admin continua sendo útil pra suporte, negociação pontual e correção de erro — não faz sentido remover.

**Sobre a Google Play**: o app segue em teste fechado (só e-mails cadastrados como testador instalam), então esse fluxo de autocadastro fica pronto no código mas só alcança produtores reais quando a Play liberar publicação aberta — não é um bloqueio pra construir e testar agora.

## Escopo

**Entra:**
- Formulário de qualificação pós-cadastro (quantidade de meeiros, quantidade de pés de morango, localização da produção)
- Recomendação automática de plano a partir da quantidade de meeiros
- Tela de plano com toggle Mensal/Anual e detalhamento expansível de cada plano
- Renomeação dos 3 planos e ajuste dos limites/recursos conforme a nova tabela (ver Regras de negócio)
- Campo de ciclo escolhido (`MENSAL`/`ANUAL`) na `Assinatura`, além do `planoId` que já existia
- Banner de trial na Home (14 dias, sem pedir cartão)
- Tela de bloqueio pós-trial com CTA de checkout in-app (substitui a mensagem estática da spec 18 como caminho **principal**; o contato manual continua disponível como alternativa)
- Checkout in-app via Mercado Pago, redirecionando pro checkout hospedado do Mercado Pago (navegador/WebView) — cartão (mensal recorrente ou anual à vista) e Pix (mensal ou anual, à vista em ambos os casos)
- Webhook do Mercado Pago confirmando pagamento, ativando a assinatura
- Persistência das respostas do formulário vinculadas ao usuário, pra uso futuro (BI, segmentação) — sem uso funcional além da recomendação de plano nesta spec

**Fica de fora (Fase 2, não desta spec):**
- Upgrade/downgrade automático de plano pelo próprio produtor depois de já assinar
- Reembolso, proração, cobrança pró-rata
- Notificação automática (push/e-mail) avisando que o trial está acabando ou que uma cobrança falhou (inclusive a renovação Pix mensal) — fica pra depois, junto com o resto de notificação automática já adiado desde a spec 18
- Tela dedicada de "renovar pagamento" pra quem tem assinatura ativa e uma cobrança falhou — por enquanto esse cenário cai no mesmo gate 402 e na mesma tela de bloqueio de trial vencido
- Checkout Transparente/Bricks (formulário de cartão dentro do próprio app, sem sair dele) — fica pro checkout hospedado nesta primeira versão, por ser mais simples de integrar; migrar pra dentro do app é uma melhoria futura
- Nota fiscal/recibo formal
- Boleto
- Landing page pública fora do app (formulário só existe dentro do fluxo de cadastro do app)
- Migração de assinaturas já ativas no Asaas (spec 18) para o Mercado Pago — não existe nenhuma assinatura ativa hoje, então esse item não se aplica

## Regras de negócio

### Planos (substituem a tabela da spec 18)

| Plano | Meeiros | Limite de safras ativas | Preço mensal | Preço anual (exibido) | Preço anual (cobrado) | Importação por IA/mês | Despesas pessoais | Suporte prioritário | Implantação assistida |
|---|---|---|---|---|---|---|---|---|---|
| Essencial | 1 a 3 | 3 | R$ 49,90/mês | R$ 44,91/mês | R$ 538,92/ano | 40 | — | — | Só se anual |
| Profissional | 4 a 10 | 10 | R$ 89,90/mês | R$ 80,91/mês | R$ 970,92/ano | 100 | ✓ | ✓ | Sempre (mensal ou anual) |
| Gestão | 10+ | ilimitado | R$ 129,90/mês | R$ 116,91/mês | R$ 1.402,92/ano | 150 | ✓ | ✓ | Sempre (mensal ou anual) |

- Valor anual = 12x o valor mensal com **10% de desconto** (reduzido de ~17%/10x a pedido do desenvolvedor, 2026-09-15)
- Na tela de plano, o ciclo anual **nunca mostra o total (R$ 538,92) como número principal** — mostra o valor equivalente por mês (R$ 44,91) em destaque, com o total anual abaixo, em fonte menor, como complemento
- **Implantação assistida**: quem paga anual ganha em qualquer plano (inclusive Essencial); quem paga mensal só tem no Profissional e no Gestão — nunca no Essencial mensal
- Recursos que já eram de todos os planos na spec 18 (foto de despesas/vendas/anotações antigas, importação de PDF/print/planilha, painel de despesas e vendas, resultado da safra) continuam valendo pra todos os planos, sem mudança
- **Limite de safras ativas = teto da faixa de meeiros do plano** (decisão do desenvolvedor, substitui os números antigos da spec 18): Essencial permite até 3 safras ativas simultâneas (mesmo teto da faixa "1 a 3" meeiros), Profissional até 10, Gestão ilimitado. A régua visível pro produtor na tabela de recursos é "quantidade de meeiros", mas o gate técnico (403) passa a usar esse novo número, não mais o 1/3/ilimitado herdado da spec 18

### Formulário de qualificação

- Aparece **uma vez**, logo após `POST /auth/register`, antes da Home — não é possível pular (sem opção "pular" na versão desta spec)
- **Só aparece pra conta nova de verdade**: sem nenhuma safra ainda **e** sem plano já atribuído. Sem essa dupla condição, qualquer conta criada antes desta spec (nunca respondeu o formulário, `faixa_meeiros` sempre `null`) ficaria presa no formulário pra sempre mesmo já usando o app normalmente — bug encontrado em teste manual (2026-09-14), corrigido antes de ir pra produção. Também garante que o caminho manual do admin (spec 18, que atribui plano direto) não seja interrompido pelo formulário automático
- Três perguntas:
  1. **Quantidade de sócios meeiros**: seleção única entre "1 a 3", "4 a 10", "10 ou mais" — define o plano recomendado (ver tabela acima)
  2. **Número de pés de morango**: campo numérico livre, com máscara de milhar (ex: "5.000") pra não ficar tudo junto — **não influencia o plano**, é só armazenado vinculado ao usuário para uso futuro (o desenvolvedor pretende usar esse dado depois, ainda sem funcionalidade definida)
  3. **Onde fica a produção**: seleção única entre "Bom Repouso" e "Outra cidade" — mesmo padrão já usado nos wireframes, sem uso funcional além de registro. Selecionando "Outra cidade", abre um campo de texto livre obrigatório pro nome da cidade (`localizacaoProducaoOutra`)
- As três respostas ficam gravadas na `Assinatura` do usuário (1:1, já existe desde a spec 18) — não em `Sociedade`, porque neste ponto do fluxo a Sociedade ainda não foi criada

### Recomendação e escolha de plano

- A resposta de meeiros mapeia direto pro plano (1 a 3 → Essencial, 4 a 10 → Profissional, 10+ → Gestão) — sem lógica adicional, sem IA
- Na tela de plano, o plano recomendado aparece **expandido por padrão**, mostrando a lista completa de recursos; os outros dois aparecem colapsados (nome + preço), expansíveis ao toque
- O produtor pode escolher **qualquer um dos 3 planos**, não só o recomendado, e qualquer ciclo (mensal/anual) — a recomendação é só uma sugestão inicial
- Confirmar aqui **não cobra nada** — só grava `planoId` e `cicloEscolhido` (`MENSAL`/`ANUAL`) na `Assinatura`, que segue em `status = TRIAL` normalmente. A cobrança de fato só acontece no checkout, depois do trial (ou se o produtor decidir assinar antes, ver spec 18 — botão "assinar agora" opcional continua existindo)

### Trial e Home

- Sem mudança no início do trial: `POST /auth/register` já cria `Assinatura` com `dataFimAcesso = agora + 14 dias` (spec 18) — o que muda é só que agora o próprio produtor passa por esse cadastro, em vez de você criar a conta por ele
- Banner fixo na Home mostrando dias restantes de trial, sem pedir cartão em nenhum momento antes do fim dos 14 dias

### Checkout pós-trial

- Quando `dataFimAcesso < agora` (gate 402 já existente, spec 18), a tela de bloqueio agora mostra, como ação principal, **"Assinar agora"**, levando ao checkout — o link/contato manual (WhatsApp/e-mail) continua disponível como ação secundária, pro caso de o produtor preferir ser atendido diretamente
- No checkout: plano e ciclo vêm pré-selecionados do que o produtor escolheu na tela de plano, mas podem ser trocados ali; depois escolhe a forma de pagamento (Pix ou cartão)
- **Cartão e Pix (mensal ou anual)**: o app **redireciona pro checkout hospedado do Mercado Pago** (abre em navegador/WebView) — o produtor sai do app nesse momento, paga na página do Mercado Pago, e volta depois. Cartão mensal cria assinatura recorrente (cobrança automática todo mês); as outras três combinações (cartão anual, Pix mensal, Pix anual) são cobrança única do valor correspondente, à vista — o parcelamento em até 12x no cartão, se o banco do produtor oferecer, acontece do lado da operadora do cartão dele, não é uma assinatura recorrente nossa
- **Tentamos um desenho melhor pro Pix e revertemos (2026-09-15)**: o ideal seria o Pix não precisar de redirecionamento nem de conta Mercado Pago — testamos gerar o QR Code direto via API de Pagamentos (`POST /v1/payments`), mostrando na própria tela, sem sair do app. Funcionou tecnicamente (payload, CPF opcional, tudo certo), mas a conta usada pra testar bate em erro de autorização do Mercado Pago ("Unauthorized use of live credentials") em **toda** tentativa de criar um pagamento por essa API, mesmo com credenciais de uma conta de vendedor de teste separada — não conseguimos identificar a causa raiz nem com várias combinações testadas. Registrado como pendência (ver "Perguntas em aberto"); por ora, Pix aceita o mesmo requisito de login numa conta Mercado Pago que o cartão
- Webhook do Mercado Pago confirmando pagamento: estende `dataFimAcesso` (30 dias pra mensal, 365 dias pra anual), muda `status` pra `ATIVA`, grava o identificador da assinatura/cobrança do Mercado Pago. Idempotente — reprocessar o mesmo pagamento (reenvio do Mercado Pago, por exemplo) não duplica o registro de `Pagamento` nem estende o acesso duas vezes

### Painel admin (mantido da spec 18, sem remoção)

- Continua existindo do jeito que está: listar titulares, atribuir/trocar plano manualmente, registrar pagamento manual, gerar cobrança fora do fluxo automático
- Passa a também exibir as respostas do formulário de qualificação (meeiros, pés, localização) de cada titular, quando existirem — útil pra você validar se a recomendação automática fez sentido

## Contrato de API

```
Produtor (autenticado):

GET /assinatura/planos
  200: [{ id, nome, valorMensal, valorAnualExibidoPorMes, valorAnualTotal, limiteSafrasAtivas,
          limiteImportacaoIAMes, despesasPessoais, suportePrioritario, implantacaoAssistidaMensal }]
  — catálogo dos 3 planos completos, pra tela de plano mostrar as 3 opções (não só a recomendada).
    Endpoint identificado como necessário durante a implementação, não estava no desenho inicial.

POST /assinatura/onboarding
  Body: {
    faixaMeeiros: "UM_A_TRES"|"QUATRO_A_DEZ"|"DEZ_OU_MAIS", quantidadePes: number,
    localizacaoProducao: "BOM_REPOUSO"|"OUTRA_CIDADE",
    localizacaoProducaoOutra?: string  // obrigatório só quando localizacaoProducao é OUTRA_CIDADE
  }
  200: { planoRecomendado: { id, nome, valorMensal, valorAnualExibidoPorMes, valorAnualTotal } }
  400: { error: "Formulário de onboarding já respondido" }  — não permite responder duas vezes

PATCH /assinatura/plano
  Body: { planoId, ciclo: "MENSAL"|"ANUAL" }
  200: { plano, ciclo }
  — grava a escolha sem cobrar; disponível em qualquer momento do trial, não só uma vez

POST /assinatura/checkout
  Body: { planoId, ciclo: "MENSAL"|"ANUAL", metodo: "CARTAO"|"PIX", retornoUrl?: string }
    // `retornoUrl` é pra onde o Mercado Pago volta depois do pagamento — cada cliente manda
    // a sua (deep link do app mobile, URL do próprio site no web), pra manter a API
    // agnóstica de cliente (ver CLAUDE.md); sem o campo, cai no deep link do app mobile
    // por compatibilidade.
  200 (mensal + cartão, assinatura recorrente): { tipo: "ASSINATURA", mpSubscriptionId, initPoint }
  200 (demais combinações — cartão anual, Pix mensal, Pix anual — cobrança única): { tipo: "COBRANCA_UNICA", mpPaymentId, initPoint }
  400: { error: "Plano ou ciclo inválido" }
  — `initPoint` é a URL do checkout hospedado do Mercado Pago; o app abre em navegador/WebView

GET /assinatura/status  (já existe na spec 18, ganha campos novos)
  200: {
    plano: {
      id, nome, valorMensal, valorAnualTotal, limiteSafrasAtivas,
      despesasPessoais, suportePrioritario, implantacaoAssistida
    } | null,
      // `id` necessário pra tela de checkout montar a cobrança. `despesasPessoais`/
      // `suportePrioritario`/`implantacaoAssistida` adicionados porque o Menu (web e mobile)
      // precisa saber se libera o card de Despesas Pessoais — sem isso a spec ficaria só
      // com a tabela de preços dizendo a regra, sem nada aplicando de fato (gap achado na
      // implementação: o card já existia antes desta spec, sempre liberado pra todo mundo)
    ciclo: "MENSAL"|"ANUAL"|null,
    status: "TRIAL"|"ATIVA"|"CANCELADA",
    dataFimAcesso: string,
    vencida: boolean,
    safrasAtivas: number,
    podeCancelar: boolean,
    onboardingRespondido: boolean
  }


Admin (sem mudança de path, campos novos na resposta):

GET /admin/assinaturas
  200: [{ ..., faixaMeeiros, quantidadePes, localizacaoProducao }]  — campos adicionados ao que já existia


Webhook (público, validado por token do Mercado Pago):

POST /webhooks/mercadopago
  200: {}  — sempre, mesmo em eventos ignorados
```

Rotas e gates já existentes na spec 18 (402 por tempo vencido, 403 por limite de safras ativas, `POST /assinatura/cancelar`) continuam funcionando sem mudança de contrato — só passam a operar sobre assinaturas Mercado Pago quando a `Assinatura` tiver sido criada por este fluxo.

## Critérios de aceite

1. Dado um usuário recém-cadastrado que ainda não respondeu o formulário, quando abre o app, então vê a tela de formulário antes de chegar na Home
2. Dado um usuário que responde "1 a 3" meeiros, quando envia o formulário, então recebe o plano Essencial como recomendado
3. Dado um usuário que responde "10 ou mais" meeiros, quando envia o formulário, então recebe o plano Gestão como recomendado
4. Dado um usuário na tela de plano, quando alterna pra "Anual", então vê o valor mensal equivalente em destaque (ex: R$ 44,91) e o total anual (R$ 538,92) como texto secundário abaixo — nunca o total como número principal
5. Dado um usuário que confirma um plano diferente do recomendado, quando consulta `GET /assinatura/status`, então vê o plano que ele escolheu, não o sugerido
6. Dado um usuário que confirma um plano, quando consulta seu status logo em seguida, então `status` continua `TRIAL` e nenhum `Pagamento` foi criado — confirmar plano não cobra
7. Dado um usuário com trial vencido, quando abre o app, então vê a tela de bloqueio com "Assinar agora" como ação principal e uma opção secundária de contato manual
8. Dado um usuário que escolhe plano mensal + cartão no checkout, quando confirma, então uma assinatura recorrente é criada no Mercado Pago e `POST /assinatura/checkout` retorna `tipo: "ASSINATURA"`
9. Dado um usuário que escolhe plano anual + Pix, quando confirma, então recebe o link do checkout hospedado do Mercado Pago (`initPoint`) de uma cobrança única no valor total anual, sem opção de parcelamento
9b. Dado um webhook do Mercado Pago reenviando a confirmação do mesmo pagamento (retentativa deles, por exemplo), quando processado de novo, então não cria um segundo registro de `Pagamento` nem estende `data_fim_acesso` uma segunda vez (idempotência)
10. Dado um webhook do Mercado Pago confirmando uma cobrança, quando processado, então `dataFimAcesso` é estendido (30 dias se mensal, 365 dias se anual) e `status` vira `ATIVA`
11. Dado um usuário no plano Essencial mensal, quando consulta os recursos do seu plano, então não vê acesso a despesas pessoais, suporte prioritário nem implantação assistida
12. Dado esse mesmo usuário, quando muda pra Essencial **anual**, então passa a ter direito a implantação assistida (mas despesas pessoais e suporte prioritário continuam fora, exclusivos de Profissional/Gestão)
13. Dado um usuário que já respondeu o formulário de onboarding, quando tenta acessar a tela de formulário de novo, então é redirecionado direto pra Home (ou tela de plano, se ainda não confirmou plano) — o formulário não é respondido duas vezes
14. Dado um admin visualizando `GET /admin/assinaturas`, quando um titular já respondeu o formulário, então vê a faixa de meeiros, quantidade de pés e localização daquele titular na listagem
15. Dado um titular no plano Essencial (limite 3 safras ativas) já com 3 safras `EM_ANDAMENTO`, quando tenta colocar uma quarta em andamento, então recebe 403
16. Dado um usuário no ciclo mensal + Pix cujo pagamento não foi confirmado até a data de vencimento, quando ele ou um meeiro da sociedade dele acessa qualquer rota da sociedade, então recebe 402 com a mesma mensagem e o mesmo caminho de "assinar agora" já usados pro trial vencido — sem tela nem aviso diferenciado

## Perguntas em aberto

- **Pix sem redirecionar (QR Code direto no app)**: seria a experiência ideal — evita o requisito de login numa conta Mercado Pago que o Checkout Pro exige pra Pix. Tentamos implementar via API de Pagamentos (`POST /v1/payments`) em 2026-09-15, mas a conta de teste usada bate em "Unauthorized use of live credentials" em toda tentativa de criar um pagamento por essa API — testado com e-mail sintético, e-mail de usuário de teste comprador, e até credenciais de uma conta de vendedor de teste separada, todos com o mesmo erro. Como `/users/me` funciona normal com essas credenciais (só a criação de pagamento falha), a causa provável é alguma etapa de ativação de conta específica pra essa API que não identificamos — precisa de contato com o suporte do Mercado Pago pra esclarecer. Enquanto isso, Pix usa o mesmo Checkout Pro do cartão (código de `criarPagamentoPix` removido; se for retomado, `git log` tem a versão que chegou a gerar QR Code e status via botão "Já paguei — verificar" — só a chamada de criação de pagamento falhava)
