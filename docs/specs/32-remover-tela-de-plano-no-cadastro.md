# 32 — Remover a tela de escolha de plano do cadastro

> **Status: aprovada pelo dev em 2026-09-25 (pedido direto). Web e mobile.**

## Objetivo

Feedback da feira agrotech (Bom Repouso, 26–27/09/2026): produtores se assustam ao ver os preços dos planos logo depois do cadastro e acham que vão ter que pagar já, mesmo com o aviso de "14 dias grátis, sem cartão".

Solução: o produtor **não vê mais preço nem plano no início**. Depois de responder o formulário "Conte sobre sua produção", ele vai direto para a Home e começa o teste. A escolha de plano e o pagamento acontecem **só quando o teste acaba** (ou quando a assinatura vence), pela tela de bloqueio e pelo checkout, que já existem e não mudam.

## Escopo

**Entra:**
- Web e mobile: o formulário de qualificação, ao ser enviado, leva direto para a Home/Início
- Web e mobile: `HomePage`/`InicioScreen` deixam de redirecionar para a tela de plano
- Web e mobile: remoção da tela de plano do onboarding (página/screen e rota)

**Fica de fora:**
- Backend: **nenhuma mudança**. `responderOnboarding` já grava o plano recomendado (spec 25, bug de 2026-09-15), então o limite de lavouras do teste continua valendo. `PATCH /assinatura/plano` continua existindo (o checkout usa)
- Tela de bloqueio pós-vencimento e checkout: não mudam
- Assinar durante o teste (spec 29): continua rascunho, independente desta
- Formulário de qualificação: continua obrigatório e igual (é ele que define o plano recomendado)

## Regras de negócio

- Ao terminar o formulário, a assinatura fica em `TRIAL` com o plano recomendado gravado e `ciclo = null`. `ciclo = null` passa a ser o estado normal de quem está no teste; deixa de significar "ainda não passou pela tela de plano"
- `ciclo` só é gravado quando o produtor inicia um checkout (`iniciarCheckout`), como já era
- O checkout já lida com `ciclo = null`: pré-seleciona o plano recomendado e o ciclo anual, e o produtor pode trocar ambos antes de pagar
- Quem já tinha se cadastrado e estava "preso" na tela de plano (formulário respondido, sem `ciclo`) passa a cair direto na Home
- Nenhum preço aparece antes do fim do teste, exceto se o produtor abrir "Minha assinatura" por conta própria

## Critérios de aceite

1. Dado um usuário novo, quando envia o formulário de qualificação, então vai direto para a Home/Início (web e mobile), sem ver planos ou preços
2. Dado um usuário no teste com `ciclo = null` e nenhuma lavoura, quando abre a Home/Início, então vê o formulário de criar propriedade/lavoura, sem redirecionamento para plano
3. Dado um usuário no teste, quando cria lavouras até o limite do plano recomendado, então o limite é respeitado (o plano já foi gravado no formulário)
4. Dado um usuário cujo teste venceu e que tem plano atribuído, quando abre o app, então cai na tela de bloqueio, escolhe plano/ciclo no checkout e paga normalmente
5. Dado um usuário que ainda não respondeu o formulário, quando abre a Home/Início, então continua sendo levado ao formulário
6. A rota `/onboarding/plano` (web) e a screen `OnboardingPlano` (mobile) não existem mais; nenhum outro ponto do app leva a elas
7. `tsc` do frontend e do mobile passam sem erro

## Decisões e riscos

- **Apagar a tela em vez de só desligar os redirecionamentos**: como a decisão é permanente (dev, 2026-09-25), manter código morto só confunde. O checkout tem seus próprios cartões de plano, então a spec mobile 13 (Apple IAP), que cita `OnboardingPlanoScreen` como fonte de cartões, pode reaproveitar `CheckoutScreen`
- **Limite do teste**: sem tela de plano, ninguém "troca" o plano antes de pagar; o teste sempre roda com o limite do plano recomendado. Já era o comportamento padrão de quem não trocava
