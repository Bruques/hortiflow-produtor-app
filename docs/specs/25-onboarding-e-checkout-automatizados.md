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
- Troca de plano na própria tela de checkout: o produtor pode selecionar qualquer um dos 3 planos (não só o que já estava atribuído a ele) antes de pagar — reaproveita o cartão de plano da tela de onboarding. Ao confirmar com um plano diferente do atual, o backend registra a troca (`PATCH /assinatura/plano`) antes de iniciar o checkout propriamente dito
- Webhook do Mercado Pago confirmando pagamento, ativando a assinatura
- Persistência das respostas do formulário vinculadas ao usuário, pra uso futuro (BI, segmentação) — sem uso funcional além da recomendação de plano nesta spec

**Fica de fora (Fase 2, não desta spec):**
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
| Essencial | 1 a 3 | 3 | R$ 49,90/mês | R$ 39,92/mês | R$ 479,04/ano | 40 | — | — | Só se anual |
| Profissional | 4 a 10 | 10 | R$ 89,90/mês | R$ 71,92/mês | R$ 863,04/ano | 100 | ✓ | ✓ | Sempre (mensal ou anual) |
| Gestão | 10+ | ilimitado | R$ 129,90/mês | R$ 103,92/mês | R$ 1.247,04/ano | 150 | ✓ | ✓ | Sempre (mensal ou anual) |

- Valor anual = 12x o valor mensal com **20% de desconto** (era ~17%/10x → 10%/12x em 2026-09-15 → 20%/12x em 2026-09-16, sempre a pedido do desenvolvedor)
- Na tela de plano, o ciclo anual **nunca mostra o total (R$ 479,04) como número principal** — mostra o valor equivalente por mês (R$ 39,92) em destaque, com o total anual abaixo, em fonte menor, como complemento
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
- **Cartão (mensal ou anual)**: o app **redireciona pro checkout hospedado do Mercado Pago** (abre em navegador/WebView, via Checkout Pro / API de Preferências) — o produtor sai do app nesse momento, paga na página do Mercado Pago, e volta depois. **Os dois ciclos são cobrança única, à vista** — sem débito automático nem no mensal: o produtor precisa voltar no app e pagar de novo a cada ciclo, mesma dinâmica do Pix mensal. O parcelamento em até 12x, se o banco do produtor oferecer, acontece do lado da operadora do cartão dele, não é uma assinatura recorrente nossa. Débito automático no cartão mensal foi tentado **duas vezes** (2026-09-15 e 2026-09-16, abordagens diferentes) e as duas falharam — ver "Perguntas em aberto" pro histórico completo e por que não vale insistir uma terceira vez sem falar com o suporte do Mercado Pago primeiro
- **Cancelamento**: exigência legal (Decreto 11.034/2022, art. 14, que regulamenta o CDC pro comércio eletrônico) — cancelamento tem que poder ser feito pelo mesmo canal da contratação, com efeito imediato. Já existe: tela "Minha assinatura" (spec 18, sem mudança) com botão de cancelar de um clique — hoje só tem efeito prático pra quem tem `mp_preapproval_id` (nenhuma assinatura ativa no momento, já que o cartão mensal não é mais recorrente)
- **Pix (mensal ou anual) — não redireciona**: mostra um **QR Code + código copia-e-cola direto na tela**, sem sair do app e sem exigir conta/login no Mercado Pago do pagador. Jornada até chegar nessa solução (2026-09-15): Checkout Pro funciona pra cartão sem exigir login, mas **exige** login pra Pix especificamente; a API de Pagamentos legada (`POST /v1/payments`) bateu em erro de autorização ("Unauthorized use of live credentials") em toda tentativa, sem causa identificada; a solução que funcionou foi a **API de Orders** (`POST /v1/orders`, a mais nova, recomendada pelo próprio Mercado Pago) — gera o Pix sem pedir login, testado com sucesso. Tem um botão **"Já paguei — verificar"** como rede de segurança, já que o formato exato do webhook de pedidos (diferente do webhook de pagamento usado pro cartão) ainda não foi validado contra um evento real (ver "Perguntas em aberto")
- Webhook do Mercado Pago confirmando pagamento/pedido: estende `dataFimAcesso` (30 dias pra mensal, 365 dias pra anual), muda `status` pra `ATIVA`, grava o identificador da cobrança do Mercado Pago. Idempotente — reprocessar a mesma confirmação (reenvio do Mercado Pago, ou o botão "Já paguei — verificar" chegando depois do webhook) não duplica o registro de `Pagamento` nem estende o acesso duas vezes

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
    // `retornoUrl` é pra onde o Mercado Pago volta depois do pagamento (só usado por
    // cartão, que redireciona) — cada cliente manda a sua (deep link do app mobile, URL do
    // próprio site no web), pra manter a API agnóstica de cliente (ver CLAUDE.md); sem o
    // campo, cai no deep link do app mobile por compatibilidade.
  200 (Pix, mensal ou anual): { tipo: "PIX", mpOrderId, qrCode, qrCodeBase64, dataExpiracao }
    // qrCode = código copia-e-cola; qrCodeBase64 = imagem do QR Code em base64, pra mostrar
    // direto na tela (sem redirecionar o pagador pra lugar nenhum)
  200 (cartão, mensal ou anual, cobrança única): { tipo: "COBRANCA_UNICA", mpPaymentId, initPoint }
  400: { error: "Plano ou ciclo inválido" }
  — `initPoint` é a URL do checkout hospedado do Mercado Pago; o app abre em navegador/WebView

GET /assinatura/checkout/pix/:orderId/status
  200: { pedidoStatus, vencida, dataFimAcesso }
  — botão "Já paguei — verificar": consulta o status do pedido direto no Mercado Pago e, se
    já `processed` (pago), confirma na hora (mesma lógica do webhook, idempotente — chamar
    duas vezes pro mesmo pedido não duplica nem estende o acesso de novo)

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
4. Dado um usuário na tela de plano, quando alterna pra "Anual", então vê o valor mensal equivalente em destaque (ex: R$ 39,92) e o total anual (R$ 479,04) como texto secundário abaixo — nunca o total como número principal
5. Dado um usuário que confirma um plano diferente do recomendado, quando consulta `GET /assinatura/status`, então vê o plano que ele escolheu, não o sugerido
6. Dado um usuário que confirma um plano, quando consulta seu status logo em seguida, então `status` continua `TRIAL` e nenhum `Pagamento` foi criado — confirmar plano não cobra
7. Dado um usuário com trial vencido, quando abre o app, então vê a tela de bloqueio com "Assinar agora" como ação principal e uma opção secundária de contato manual
8. Dado um usuário que escolhe plano mensal + cartão no checkout, quando confirma, então recebe o link do checkout hospedado do Mercado Pago (`initPoint`) de uma cobrança única no valor mensal — sem débito automático, mesma dinâmica do Pix mensal
9. Dado um usuário que escolhe plano anual + Pix, quando confirma, então recebe um QR Code + código copia-e-cola (`tipo: "PIX"`) no valor total anual, sem ser redirecionado nem precisar de conta Mercado Pago
9b. Dado um usuário que já pagou o Pix mas o webhook ainda não chegou, quando toca em "Já paguei — verificar", então o backend consulta o pedido direto no Mercado Pago, confirma o pagamento e libera o acesso, sem esperar o webhook
9c. Dado uma confirmação (webhook ou botão verificar) processada mais de uma vez pro mesmo pagamento/pedido, então não cria um segundo registro de `Pagamento` nem estende `data_fim_acesso` uma segunda vez (idempotência)
10. Dado um webhook do Mercado Pago confirmando uma cobrança, quando processado, então `dataFimAcesso` é estendido (30 dias se mensal, 365 dias se anual) e `status` vira `ATIVA`
11. Dado um usuário no plano Essencial mensal, quando consulta os recursos do seu plano, então não vê acesso a despesas pessoais, suporte prioritário nem implantação assistida
12. Dado esse mesmo usuário, quando muda pra Essencial **anual**, então passa a ter direito a implantação assistida (mas despesas pessoais e suporte prioritário continuam fora, exclusivos de Profissional/Gestão)
13. Dado um usuário que já respondeu o formulário de onboarding, quando tenta acessar a tela de formulário de novo, então é redirecionado direto pra Home (ou tela de plano, se ainda não confirmou plano) — o formulário não é respondido duas vezes
14. Dado um admin visualizando `GET /admin/assinaturas`, quando um titular já respondeu o formulário, então vê a faixa de meeiros, quantidade de pés e localização daquele titular na listagem
15. Dado um titular no plano Essencial (limite 3 safras ativas) já com 3 safras `EM_ANDAMENTO`, quando tenta colocar uma quarta em andamento, então recebe 403
16. Dado um usuário no ciclo mensal + Pix cujo pagamento não foi confirmado até a data de vencimento, quando ele ou um meeiro da sociedade dele acessa qualquer rota da sociedade, então recebe 402 com a mesma mensagem e o mesmo caminho de "assinar agora" já usados pro trial vencido — sem tela nem aviso diferenciado
17. Dado um usuário com o plano Profissional já atribuído, quando chega na tela de checkout, então vê os 3 planos disponíveis pra seleção (não só o Profissional) com o Profissional pré-selecionado
18. Dado esse mesmo usuário, quando seleciona o plano Gestão e confirma o pagamento, então `GET /assinatura/status` passa a mostrar o plano Gestão mesmo antes do pagamento confirmar (a troca de plano é imediata; só a ativação/extensão de acesso depende do pagamento)
19. Dado um usuário que responde o formulário de qualificação, quando consulta `GET /assinatura/status` **antes** de confirmar um plano na tela seguinte, então já vê o plano recomendado atribuído (não nulo) e o limite de safras ativas correspondente já valendo, mesmo ainda em `TRIAL`

## Perguntas em aberto

- **Cartão mensal como assinatura recorrente de verdade — abandonado DUAS VEZES (2026-09-15 e 2026-09-16), nas duas por erro do lado do Mercado Pago**: primeira tentativa usava `/preapproval` sem cartão tokenizado, com um `init_point` redirecionando pra uma página hospedada (`/subscriptions/checkout?preapproval_id=...`) que sempre retornava "Esta página não existe" nessa conta, causa nunca identificada. Segunda tentativa (2026-09-16, a pedido do dev) seguiu a abordagem que a própria documentação do Mercado Pago recomenda pra evitar esse redirecionamento: tokenizar o cartão no checkout (Secure Fields) e criar a assinatura direto com `card_token_id` + `status: authorized`, sem navegar pra lugar nenhum. Implementado (web: formulário embutido; mobile: WebView numa página própria) e testado com **dois cartões de teste diferentes** do Mercado Pago — o primeiro deu `Unsupported_credit_card_for_recurring_payment`, o segundo (o cartão de teste "oficial" da documentação deles) deu um erro diferente, `CC_VAL_433 Credit card validation has failed` (código `cc_rejected_high_risk`, antifraude). Pesquisando esse erro, achamos relatos de outros desenvolvedores tendo o mesmo problema com **múltiplos cartões**, não é específico de um cartão — e a própria documentação atual do Mercado Pago descreve a API de Assinaturas (Preapproval) como "em processo de migração pra uma arquitetura melhor... ainda funcional, mas sem suporte". Decisão do dev: reverter pra cobrança única (mesma solução das duas tentativas). Todo o código da tentativa (`criarAssinaturaRecorrente` em `mercadopago.service.ts`) continua existindo, não deletado, caso o Mercado Pago resolva o problema no futuro — mas não vale tentar uma terceira vez sem abrir um chamado de suporte com eles primeiro, perguntando especificamente sobre esse erro de antifraude em `/preapproval`
- **Nota técnica preservada pra quando/se reativar**: o acesso deveria liberar já na criação da assinatura (`status: authorized`), sem esperar o webhook da primeira cobrança — a documentação do Mercado Pago avisa que ela só acontece ~1h depois de autorizada, e cada cobrança (a primeira e as seguintes) gera um webhook de pagamento normal (`type=payment`), reaproveitando `confirmarPagamentoWebhookMercadoPago` sem mudança nenhuma
- **Fluxo Pix validado de ponta a ponta em staging (2026-09-15), webhook incluído**: gerar QR Code → aprovação automática de teste (`payer.first_name: "APRO"`, só em sandbox) → webhook automático confirma sozinho, sem precisar do botão "Já paguei — verificar" → `Assinatura.status` vira `ATIVA`, `data_fim_acesso` estendido corretamente, `Pagamento` gravado. Confirmado direto no banco de staging, não só na tela
- **Formato real do webhook de pedidos Pix — RESOLVIDO**: confirmado contra um evento real (`type=order`, com `data.id` = id do pedido e `data.external_reference` = id da Assinatura, igual ao formato de pagamento) — bate com um dos dois palpites já aceitos pelo código (`extrairNotificacaoWebhook` em `mercadopago.service.ts`), nenhum ajuste necessário. Bônus: o Mercado Pago mandou a mesma notificação duas vezes nesse teste, confirmando que a proteção de idempotência (checar `mp_payment_id` já processado antes de criar um novo `Pagamento`) é necessária de verdade, não só teórica. Webhook configurado no painel do Mercado Pago (Notificações → Webhooks → Modo de teste) assinando os tópicos "Pagamentos (legacy)" e "Order (Mercado Pago)"; falta replicar a mesma configuração em "Modo de produção" antes de ir ao ar
- **E-mail do pagador em produção — RESOLVIDO**: em modo sandbox, a API de Orders exige que o e-mail do pagador termine em `@testuser.com` — contornado com `MP_SANDBOX_PAYER_EMAIL`, uma env só de ambiente de teste, ausente em produção. Confirmado com um Pix real de R$1 em produção (2026-09-15, ver abaixo): o e-mail sintético normal (`usuarioId@usuarios.hortiflow-produtor.com.br`) funcionou sem exigir nada parecido — a restrição é mesmo exclusiva do sandbox
- **Teste real em produção (2026-09-15)**: Pix de R$1 (plano Essencial mensal com o preço temporariamente alterado pro teste, revertido logo depois) confirmado de ponta a ponta — webhook real chegou, `Pagamento` gravado, `Assinatura` ativada, sem precisar do botão "Já paguei — verificar". Cartão de R$1 no mesmo plano teve dois problemas, os dois encontrados só nesse teste real (nenhum dos dois aparecia em sandbox): (1) o botão "Pagar" ficava desabilitado sem erro visível quando o navegador estava logado numa conta pessoal do Mercado Pago — resolvido testando em aba anônima, mesma causa-raiz do bug já catalogado da "Linha de Crédito"; (2) **bug real de código** — corrigido nesta sessão, ver linha abaixo
- **Bug: trial ficava sem limite de safras se o produtor não confirmasse um plano (RESOLVIDO, 2026-09-15)**: `plano_id` só era gravado na `Assinatura` quando o produtor confirmava um plano na tela seguinte ao formulário (`escolherPlano`) — a resposta do formulário em si (`responderOnboarding`) só devolvia a recomendação, sem persistir nada além das respostas de qualificação. Quem respondia o formulário mas saía do app antes de chegar (ou confirmar) na tela de plano ficava com `plano_id` nulo indefinidamente, e `limiteEfetivo` trata plano nulo como **sem limite** de safras ativas — então esse produtor podia criar quantas safras quisesse durante o trial inteiro e só descobrir o limite real (ex: 3, se acabasse escolhendo Essencial) depois de pagar. Discutido com o dev: em vez de travar todo mundo no limite do plano mais básico durante o trial, `responderOnboarding` agora já grava o **plano recomendado** direto, antes mesmo da tela de confirmação — quem foi recomendado Gestão testa com o limite de Gestão, quem foi recomendado Essencial já fica em 3 desde a primeira resposta. A tela de plano continua podendo sobrescrever se o produtor trocar. Se o produtor acabar confirmando um plano mais barato do que usou no trial, as safras já criadas continuam existindo — só não é possível criar novas além do novo limite, mesmo comportamento de qualquer downgrade
- **Bug: confirmação de pagamento por cartão sempre falhava (RESOLVIDO, 2026-09-15)**: a API de Pagamentos do Mercado Pago (`GET /v1/payments/:id`, usada só pra cartão) devolve o campo `id` como **número** no JSON — diferente da API de Orders (Pix), cujo id já é uma string alfanumérica de verdade. O tipo `MpPayment.id: string` no código era só uma promessa do TypeScript, sem conversão em runtime; o Prisma rejeitava `mp_payment_id: pagamento.id` (campo `String?`) com "Expected StringNullableFilter... provided Int", derrubando a confirmação do webhook silenciosamente — o produtor pagava de verdade, o checkout voltava sem erro nenhum, mas nenhum `Pagamento` era criado nem a assinatura ativada. Corrigido convertendo pra string em `buscarPagamento` (`mercadopago.service.ts`), na borda onde o dado entra no sistema. Bug relacionado corrigido junto: notificações do tópico legado `merchant_order` (específico do Checkout Pro) eram tratadas como se fossem da API de Orders, tentando buscar `/v1/orders/{id do merchant_order}` — sempre falhava (`invalid_path_param`), gerando retentativa infinita do Mercado Pago; `merchant_order` agora é ignorado (a confirmação de cartão já acontece pelo tópico `payment`)

- **Bug: pagamento Pix gravado em duplicidade (RESOLVIDO, 2026-09-19)**: visto no painel do dono (spec 28) em produção: um único Pix de R$ 49,90 (Luis Miguel, 2026-09-18) apareceu como duas linhas de `Pagamento` com o **mesmo `mp_payment_id`** (`178776156509`) e o mesmo período, criadas com **1 ms de diferença**, inflando a receita em R$ 49,90 (o acesso do produtor estava certo). Causa: o Mercado Pago entregou o mesmo aviso duas vezes ao mesmo tempo, e "já processei esse pagamento?" e a gravação eram passos separados, sem trava, então as duas entregas passaram na checagem e as duas leram a mesma `data_fim_acesso`. Correção em `assinatura.service.ts`: função única `registrarPagamentoMercadoPago`, numa transação que trava a linha da assinatura (`FOR UPDATE`), reconfere o id e só então grava e estende o acesso. Reproduzido no banco local com avisos simultâneos: o código antigo gravou 2 a 4 linhas onde devia haver 1; o novo grava 1, e um pagamento diferente (renovação) continua somando. **Observação importante sobre os dois caminhos de aviso:** em produção o Pix de teste de 2026-09-15 foi confirmado pelo aviso de PEDIDO (`type=order`, id `ORD...`), mas o Pix do Luis Miguel de 2026-09-18 chegou pelo aviso de PAGAMENTO (`type=payment`, id numérico). Os dois caminhos estão em uso para Pix e ambos precisam continuar confirmando (uma versão intermediária desta correção ignorava Pix no aviso de pagamento e teria deixado esse Pix sem confirmar; foi descartada antes de ir para produção)
- **Checkout Transparente pra cartão via API de Orders**: como a API de Orders resolveu o Pix sem redirecionar, pode fazer sentido migrar o cartão pra ela também no futuro (formulário de cartão dentro do próprio app, em vez de redirecionar pro Checkout Pro) — não fizemos isso agora porque o Checkout Pro pro cartão já funciona bem e não tem a mesma urgência do problema do Pix
- **Troca de plano no checkout — adicionada durante o uso real (2026-09-15)**: a spec original escopava "upgrade/downgrade automático de plano" pra fora (Fase 2), assumindo que o produtor só pagaria o plano já recomendado/escolhido no onboarding. Na prática, um produtor testando o fluxo tentou pagar um plano diferente do que estava atribuído a ele e não conseguiu — a tela de checkout só oferecia o plano atual. Como o produto já é self-service (sem intervenção manual pra trocar de plano), isso contradizia o espírito da spec. Removido do "Fica de fora" e implementado: a tela de checkout agora lista os 3 planos (reaproveitando o cartão de plano do onboarding) e confirma a troca via `PATCH /assinatura/plano` antes de iniciar o checkout, se o produtor selecionar um plano diferente do atual
- **Bug: quem respondia o formulário mas não confirmava um plano pulava direto pra Home (RESOLVIDO, 2026-09-18)**: o critério de aceite 13 já previa "ou tela de plano, se ainda não confirmou plano", mas isso nunca foi implementado de fato — a Home/Início só redirecionava pro formulário de qualificação quando `plano === null`. Depois do fix de 2026-09-15 acima, `plano` deixa de ser `null` assim que o formulário é respondido (antes mesmo do produtor ver a tela de plano), então esse redirect nunca mais disparava — quem respondia o formulário e fechava o app antes de confirmar um plano caía direto na Home, vendo o formulário de "criar propriedade e safra" sem nunca ter passado pela tela de plano (relatado pelo dev em produção). Corrigido usando `ciclo` (só gravado quando o produtor de fato confirma em `escolherPlano`/checkout, nunca por `responderOnboarding`) como o sinal de "plano confirmado", em vez de `plano`: `HomePage.tsx`/`InicioScreen.tsx` agora redirecionam pra `/onboarding/plano` quando `onboardingRespondido && !ciclo && !vencida && safras.length === 0`

- **Tela de plano do onboarding removida (2026-09-25, spec 32)**: o feedback da feira mostrou que ver preços logo após o cadastro assustava os produtores. O formulário agora leva direto para a Home; o critério 13 ("ou tela de plano, se ainda não confirmou plano") e o redirecionamento por `ciclo` vazio do bug de 2026-09-18 deixam de valer. Plano e pagamento só na tela de bloqueio/checkout, depois do teste.
