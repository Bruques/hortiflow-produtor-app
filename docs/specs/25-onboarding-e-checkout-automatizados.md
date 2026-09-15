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
- **Cartão (mensal ou anual)**: o app **redireciona pro checkout hospedado do Mercado Pago** (abre em navegador/WebView, via Checkout Pro / API de Preferências) — o produtor sai do app nesse momento, paga na página do Mercado Pago, e volta depois. **Os dois ciclos são cobrança única, à vista** — sem débito automático nem no mensal (decisão do dev, 2026-09-15, ver "Perguntas em aberto" sobre o motivo): o produtor precisa voltar no app e pagar de novo a cada ciclo, mesma dinâmica do Pix mensal. O parcelamento em até 12x, se o banco do produtor oferecer, acontece do lado da operadora do cartão dele, não é uma assinatura recorrente nossa
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
4. Dado um usuário na tela de plano, quando alterna pra "Anual", então vê o valor mensal equivalente em destaque (ex: R$ 44,91) e o total anual (R$ 538,92) como texto secundário abaixo — nunca o total como número principal
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

## Perguntas em aberto

- **Cartão mensal como assinatura recorrente de verdade — abandonado por ora (2026-09-15)**: a spec original previa débito automático mensal via `/preapproval` (API de Preapproval do Mercado Pago). Na prática, o `init_point` gerado (`https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=...`) sempre retorna "Esta página não existe" nessa conta — testado depois de declarar "Assinaturas" como produto integrado na aplicação (não só "Checkout Pro"), sem mudança. Como cartão anual e Pix (mensal/anual) funcionam bem nas próprias APIs, a causa é provavelmente alguma verificação de conta específica pra esse produto, que só o suporte do Mercado Pago explicaria. Decisão do dev: cartão mensal passa a ser **cobrança única sem débito automático**, mesma dinâmica do Pix mensal — o produtor volta no app e paga de novo a cada ciclo. `criarAssinaturaRecorrente` continua existindo em `mercadopago.service.ts` (não deletada), pra reativar se o problema for resolvido no futuro
- **Fluxo Pix validado de ponta a ponta em staging (2026-09-15), webhook incluído**: gerar QR Code → aprovação automática de teste (`payer.first_name: "APRO"`, só em sandbox) → webhook automático confirma sozinho, sem precisar do botão "Já paguei — verificar" → `Assinatura.status` vira `ATIVA`, `data_fim_acesso` estendido corretamente, `Pagamento` gravado. Confirmado direto no banco de staging, não só na tela
- **Formato real do webhook de pedidos Pix — RESOLVIDO**: confirmado contra um evento real (`type=order`, com `data.id` = id do pedido e `data.external_reference` = id da Assinatura, igual ao formato de pagamento) — bate com um dos dois palpites já aceitos pelo código (`extrairNotificacaoWebhook` em `mercadopago.service.ts`), nenhum ajuste necessário. Bônus: o Mercado Pago mandou a mesma notificação duas vezes nesse teste, confirmando que a proteção de idempotência (checar `mp_payment_id` já processado antes de criar um novo `Pagamento`) é necessária de verdade, não só teórica. Webhook configurado no painel do Mercado Pago (Notificações → Webhooks → Modo de teste) assinando os tópicos "Pagamentos (legacy)" e "Order (Mercado Pago)"; falta replicar a mesma configuração em "Modo de produção" antes de ir ao ar
- **E-mail do pagador em produção**: em modo sandbox, a API de Orders exige que o e-mail do pagador termine em `@testuser.com` (erro `invalid_email_for_sandbox` se não for) — contornado com `MP_SANDBOX_PAYER_EMAIL`, uma env só de ambiente de teste. Assumimos que essa exigência não existe com credenciais de produção (o e-mail sintético normal `usuarioId@usuarios.hortiflow-produtor.com.br` funcionaria) — não dá pra confirmar sem uma conta de produção real
- **Checkout Transparente pra cartão via API de Orders**: como a API de Orders resolveu o Pix sem redirecionar, pode fazer sentido migrar o cartão pra ela também no futuro (formulário de cartão dentro do próprio app, em vez de redirecionar pro Checkout Pro) — não fizemos isso agora porque o Checkout Pro pro cartão já funciona bem e não tem a mesma urgência do problema do Pix
- **Troca de plano no checkout — adicionada durante o uso real (2026-09-15)**: a spec original escopava "upgrade/downgrade automático de plano" pra fora (Fase 2), assumindo que o produtor só pagaria o plano já recomendado/escolhido no onboarding. Na prática, um produtor testando o fluxo tentou pagar um plano diferente do que estava atribuído a ele e não conseguiu — a tela de checkout só oferecia o plano atual. Como o produto já é self-service (sem intervenção manual pra trocar de plano), isso contradizia o espírito da spec. Removido do "Fica de fora" e implementado: a tela de checkout agora lista os 3 planos (reaproveitando o cartão de plano do onboarding) e confirma a troca via `PATCH /assinatura/plano` antes de iniciar o checkout, se o produtor selecionar um plano diferente do atual
