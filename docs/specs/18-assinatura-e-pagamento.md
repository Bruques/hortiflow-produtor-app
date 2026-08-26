# 18 — Assinatura e pagamento

## Objetivo

Substituir o bloqueio 100% manual descrito na [spec 16](./16-bloqueio-de-conta.md) por um modelo de cobrança real, agora que existe um fluxo de vendas definido: o desenvolvedor (ou o primo) visita o produtor pessoalmente, conhece a lavoura, define qual dos 3 planos comporta o tamanho dela, e só então libera o app pra teste — isso porque o app ainda está na fase de teste fechado da Google Play (só quem tem o e-mail cadastrado como testador consegue instalar), então hoje não existe cadastro público espontâneo, tudo passa por contato direto.

O modelo:
- **Trial gratuito de 14 dias** pra todo produtor, começando quando ele recebe o link de teste (já com um dos 3 planos atribuído manualmente na visita).
- **3 planos**, definidos pelo tamanho da lavoura (quantidade de pés de morango), com valor mensal e limite de safras ativas simultâneas diferentes (ver Regras de negócio).
- Depois do trial: se não houver pagamento, o app **bloqueia o acesso** com uma mensagem simples pedindo contato — sem checkout automático embutido na tela.
- A partir do contato, o **próprio desenvolvedor gera e envia manualmente** (WhatsApp/e-mail) um **link de checkout hospedado no Asaas** pro plano já atribuído àquele produtor.
- Cobrança **mensal recorrente** via esse checkout do Asaas — o produtor consegue **cancelar dentro do app** a qualquer momento, mesmo o checkout tendo acontecido fora do app, porque o backend guarda o ID da assinatura no Asaas e aciona a API deles.
- Continua existindo o caminho de **pagamento manual (PIX/dinheiro direto)**, liberado por você via painel admin, em paralelo ao caminho do gateway.

**Por que Asaas**: confirmado que ele oferece link de checkout hospedado com cobrança recorrente pronto (você não precisa construir nenhuma tela de pagamento) e uma API de cancelamento de assinatura — ambos os pontos que fecham essa spec. Continua sendo o mais barato em PIX e aceita conta pessoa física, sem exigir CNPJ.

**Por que não expor o checkout automaticamente na tela de bloqueio (por enquanto)**: o processo de vendas já é presencial e manual (visita → plano definido → contato pós-trial), então adicionar geração automática de link agora seria construir automação pra um fluxo que ainda depende de você pessoalmente de qualquer forma. Fica registrado como melhoria de Fase 2.

**Sobre criar a conta do produtor**: isso **já existe**, não é parte nova desta spec — é o fluxo descrito na [spec 09](./09-troca-de-senha.md): você cria a conta com uma senha provisória, cria a Sociedade, ensina o produtor a usar, e repassa o acesso; ele troca a senha (`PUT /auth/senha`) e a partir daí só ele sabe a senha. O que esta spec adiciona é o **próximo passo**, que hoje não existe: depois de criar a conta, você entra no painel admin (a mesma plataforma desta spec) e atribui o plano àquele titular — é isso que liga a criação da conta ao controle de safras ativas e cobrança.

**Relação com a spec 16**: o campo `status` (ATIVO/BLOQUEADO) do `Usuario` continua servindo pra banir alguém manualmente por qualquer motivo, independente de pagamento. Essa spec adiciona dois motivos de bloqueio **novos e independentes**: assinatura vencida (402) e limite de safras ativas do plano (403).

## Escopo

**Entra:**
- Catálogo de 3 `Plano` (seed inicial, mas valor mensal e limite de safras ativas **editáveis** pelo admin — sem precisar de deploy pra ajustar preço/limite)
- Override opcional de limite de safras ativas **por titular individual**, pra casos fora da régua dos 3 planos (ex.: negociação específica com um produtor)
- Model `Assinatura` (1:1 com `Usuario`), criado automaticamente no registro com trial de 14 dias e `plano` ainda **não** atribuído
- Model `Pagamento` (histórico), um registro por cobrança confirmada, via Asaas ou manual
- Novo campo `criado_por_usuario_id` em `Sociedade` — o titular cuja assinatura/plano governam o acesso de todos que participam dela
- Gate de **tempo**: rota escopada a uma Sociedade com assinatura do titular vencida → 402
- Gate de **quantidade**: criar/reabrir uma Safra além do limite de safras ativas do plano do titular → 403
- Painel admin (`admin: boolean` em `Usuario`, ligado manualmente no banco) com: listar titulares e status, atribuir/alterar o plano de um titular, gerar o link de checkout Asaas daquele plano (pra você copiar e mandar manualmente), registrar pagamento manual
- Botão "cancelar assinatura" no app, visível pro produtor quando ele tem uma assinatura ativa via gateway — chama a API de remoção de assinatura do Asaas
- Webhook do Asaas confirmando cobrança recorrente, estendendo o acesso e guardando o `asaasSubscriptionId` na primeira confirmação
- Tela de bloqueio simples pós-trial/pós-vencimento: mensagem fixa pedindo contato (telefone/e-mail), sem geração de link nela

**Fica de fora (por enquanto, Fase 2):**
- Geração automática do link de checkout dentro da própria tela de bloqueio (produtor clica e já vai pro checkout sozinho, sem você precisar mandar manualmente)
- Landing page pública com os 3 planos pra autosserviço (hoje a venda é sempre presencial, plano é atribuído por você, não escolhido pelo produtor)
- Criar/remover planos novos (continuam sendo sempre 3 — o que é editável é valor e limite de cada um, não a quantidade de planos)
- Upgrade/downgrade automático de plano pelo próprio produtor
- Reembolso, proration, cobrança pró-rata
- Notificação automática (e-mail/WhatsApp/push) avisando que o trial está acabando ou que uma cobrança falhou
- Nota fiscal/recibo formal
- Boleto e PIX recorrente via Asaas (só cartão recorrente no checkout do gateway nesta primeira versão; PIX/dinheiro continuam existindo, mas só pelo caminho manual)

## Regras de negócio

### Planos

| Plano | Tamanho da lavoura | Valor mensal | Limite de safras ativas |
|---|---|---|---|
| Plano 1 | até 30.000 pés | R$ 47,98 | 1 |
| Plano 2 | até 60.000 pés | R$ 87,98 | 3 |
| Plano 3 | acima de 60.000 pés | R$ 156,98 | ilimitado |

- O enquadramento em qual plano (baseado na quantidade de pés) é decidido **por você, na visita presencial** — o app não pergunta nem calcula isso sozinho
- "Safra ativa", pra efeito do limite, é toda `Safra` com `status = EM_ANDAMENTO` (confirmado pelo desenvolvedor). `PLANEJADA` não conta — o produtor pode deixar quantas safras planejadas quiser, o limite só trava quando ele tenta colocar uma em andamento além do que o plano permite. Encerrar (`ENCERRADA`) libera a vaga imediatamente
- O limite é somado em **todas as Sociedades cujo titular é aquele usuário** (não por Sociedade individual) — cobre o caso raro de um financiador administrar mais de uma sociedade
- **Flexibilidade por titular**: além do valor/limite editável no `Plano` (vale pra todo mundo naquele plano), o admin pode gravar um `limiteSafrasAtivasOverride` num titular específico — quando presente, esse número vale no lugar do limite do plano só pra ele, sem afetar os demais titulares daquele mesmo plano. Serve pra negociações pontuais fora da régua padrão dos 3 planos

### Trial e atribuição de plano

- Todo `Usuario` novo (`POST /auth/register`) ganha uma `Assinatura` com `status = TRIAL`, `dataFimAcesso = agora + 14 dias`, e `planoId = null`
- Você atribui o `planoId` pelo painel admin, tipicamente na visita, antes ou logo depois do produtor se cadastrar — enquanto `planoId` for `null`, o limite de safras ativas **não é aplicado** (mas isso deve durar pouco, é um estado transitório do processo comercial, não uma opção suportada de uso indefinido)
- O limite de safras ativas do plano vale **desde que o plano seja atribuído**, mesmo ainda em trial — assim o produtor já testa dentro da realidade do plano que vai comprar, sem surpresa depois de pagar

### Checagem de acesso (tempo)

- Toda rota que opera sobre uma Sociedade específica verifica `Sociedade.criado_por_usuario_id` → a `Assinatura` desse titular → compara `dataFimAcesso` com agora:
  - `dataFimAcesso >= agora` → libera (trial ou pago, não importa pro gate)
  - `dataFimAcesso < agora` → 402 pra qualquer usuário que acesse aquela sociedade (titular ou meeiro dela)
- Rotas nunca bloqueadas por 402: login/registro, `/assinatura/status`, `/assinatura/cancelar`, leitura do próprio perfil — mesmo vencido, o produtor precisa conseguir ver seu status e cancelar se quiser
- `status` da `Assinatura` (`TRIAL`/`ATIVA`/`CANCELADA`) é informativo pro admin — quem decide o acesso de fato é sempre `dataFimAcesso`, comparado a cada requisição, sem job em background

### Checagem de limite (quantidade de safras ativas)

- Ao mudar uma Safra pra `status = EM_ANDAMENTO` (seja na criação já nesse status, ou ao sair de `PLANEJADA`), conta quantas Safras já estão `EM_ANDAMENTO` hoje nas Sociedades do titular; se o total já atingido é `>=` o limite (o `limiteSafrasAtivasOverride` do titular, se existir, senão o `limiteSafrasAtivas` do plano dele), bloqueia com 403
- Encerrar uma safra (`ENCERRADA`) libera uma vaga imediatamente pra próxima checagem

### Cobrança via Asaas (gateway)

- Você gera, pelo painel admin, um link de checkout hospedado no Asaas pro plano já atribuído ao titular — o link é copiado e enviado manualmente (WhatsApp/e-mail), fora do app
- Primeira cobrança confirmada (webhook) grava o `asaasSubscriptionId` na `Assinatura`, cria um `Pagamento` (`metodo = GATEWAY_ASAAS`), estende `dataFimAcesso` pra próxima data de vencimento informada pelo Asaas, e muda `status` pra `ATIVA`
- Cobranças seguintes (mês a mês) repetem: cada webhook confirmado gera um novo `Pagamento` e estende `dataFimAcesso`
- Falha de cobrança não reverte `dataFimAcesso` retroativamente — o acesso já pago continua até a data, só não é mais renovado, e quando a data passar o gate volta a bloquear naturalmente

### Cancelamento pelo produtor

- Rota autenticada `POST /assinatura/cancelar`, disponível só se a `Assinatura` tiver um `asaasSubscriptionId` ativo — aciona a API do Asaas pra remover a assinatura, o que interrompe cobranças futuras
- Não há reembolso do que já foi cobrado — o acesso continua liberado até o `dataFimAcesso` já pago, e depois disso o gate bloqueia normalmente (o produtor precisa contatar de novo pra reassinar)
- Pagamento manual (PIX/dinheiro) não tem "cancelamento" — é só um período com data de expiração, que naturalmente vence

### Pagamento manual (PIX/dinheiro)

- Só usuário com `admin = true` registra. Informa `usuarioId` alvo, valor, e quantos dias estende
- Cria um `Pagamento` (`metodo = MANUAL_PIX` ou `MANUAL_DINHEIRO`, `registrado_por_usuario_id` = o admin) e estende `dataFimAcesso` a partir do maior valor entre "agora" e o `dataFimAcesso` atual (não perde dias já pagos numa renovação antecipada)

## Contrato de API

```
Produtor (autenticado):

GET /assinatura/status
  200: {
    plano: { nome, valorMensal, limiteSafrasAtivas } | null,
    status: "TRIAL"|"ATIVA"|"CANCELADA",
    dataFimAcesso: string,
    vencida: boolean,
    safrasAtivas: number,
    podeCancelar: boolean   // true só se houver asaasSubscriptionId ativo
  }

POST /assinatura/cancelar
  200: { dataFimAcesso: string }  — confirma até quando o acesso ainda vale
  400: { error: "Nenhuma assinatura ativa pra cancelar" }


Admin (admin only, 403 se admin=false):

GET /admin/assinaturas
  200: [{ usuarioId, nome, telefone, plano, status, dataFimAcesso, vencida,
          safrasAtivas, limiteSafrasAtivas, metodoUltimoPagamento }]

PATCH /admin/assinaturas/:usuarioId/plano
  Body: { planoId }
  200: { plano }

PATCH /admin/assinaturas/:usuarioId/limite-safras
  Body: { limiteSafrasAtivasOverride: number | null }  // null remove o override, volta a valer o limite do plano
  200: { limiteEfetivo: number | null }

PATCH /admin/planos/:planoId
  Body: { valorMensal?: number, limiteSafrasAtivas?: number | null }
  200: { plano }

POST /admin/assinaturas/:usuarioId/checkout-link
  200: { checkoutUrl: string }   // gerado via API do Asaas, pro admin copiar e enviar manualmente

POST /admin/assinaturas/:usuarioId/pagamento-manual
  Body: { valor: number, metodo: "MANUAL_PIX"|"MANUAL_DINHEIRO", dias: number }
  200: { dataFimAcesso: string }


Webhook (público, validado por token do Asaas):

POST /webhooks/asaas
  200: {}  — sempre, mesmo em eventos ignorados


Rotas existentes, sem mudança de path:

Qualquer rota escopada a uma Sociedade
  402: { error: "Seu acesso ao HortiFlow expirou. Fale com a gente pelo WhatsApp {{whatsappContato}} ou e-mail {{emailContato}} para continuar." }

Mudança de Safra para EM_ANDAMENTO (criação ou reabertura)
  403: { error: "Você atingiu o limite de safras ativas do seu plano. Encerre uma safra em andamento ou fale com a gente sobre um plano com mais espaço." }
```

Os textos acima já são os finais (redigidos nesta spec, a pedido do desenvolvedor). Contato: `{{whatsappContato}}` = `(35) 99730-2015`, `{{emailContato}}` = `contato.hortiflow@gmail.com` — ambos vêm de variável de ambiente/config (não hardcoded no código), já que é dado que pode mudar.

## Critérios de aceite

1. Dado um usuário recém-registrado, quando consulta `GET /assinatura/status`, então recebe `status: "TRIAL"`, `plano: null`, e `dataFimAcesso` 14 dias à frente
2. Dado um admin que atribui um plano a um titular via `PATCH /admin/assinaturas/:usuarioId/plano`, quando o titular consulta seu status, então vê o plano correto (nome, valor, limite de safras)
3. Dado um titular no Plano 1 (limite 1 safra ativa) já com uma Safra `EM_ANDAMENTO`, quando tenta criar uma segunda Safra sem encerrar a primeira, então recebe 403 com mensagem clara
4. Dado esse mesmo titular, quando encerra a safra ativa e tenta criar uma nova, então consegue normalmente
5. Dado um titular sem plano atribuído (`planoId = null`), quando cria quantas safras quiser, então não é bloqueado por limite (só pelo gate de tempo, se vencido)
6. Dado um titular com `dataFimAcesso` no passado, quando ele ou um meeiro da sociedade dele acessa qualquer rota da sociedade, então recebe 402 com mensagem pedindo contato
7. Dado esse mesmo titular vencido, quando consulta `GET /assinatura/status` ou tenta `POST /assinatura/cancelar`, então a chamada funciona normalmente, sem 402
8. Dado um admin que gera um link de checkout pra um titular com plano atribuído, quando chama `POST /admin/assinaturas/:usuarioId/checkout-link`, então recebe uma URL válida do Asaas pro plano correto
9. Dado um titular que completa o pagamento nesse link e o webhook do Asaas confirma a cobrança, quando ele volta a acessar a sociedade, então o acesso está liberado, `status` vira `ATIVA`, e `asaasSubscriptionId` fica salvo
10. Dado um titular com assinatura ativa via gateway, quando chama `POST /assinatura/cancelar`, então a assinatura é removida no Asaas, nenhuma cobrança futura acontece, e o acesso continua liberado até o `dataFimAcesso` já pago
11. Dado um admin que registra um pagamento manual de 30 dias pra um titular vencido, quando o titular acessa a sociedade em seguida, então o acesso está liberado e o novo `dataFimAcesso` reflete os dias adicionados
12. Dado um usuário comum (`admin = false`), quando tenta acessar qualquer rota `/admin/assinaturas*`, então recebe 403
13. Dado um meeiro cuja própria `Assinatura` pessoal está vencida (nunca vai pagar nada), quando acessa uma sociedade cujo titular está em dia, então o acesso funciona normalmente — só a assinatura do titular é checada
14. Dado um admin que ajusta `valorMensal`/`limiteSafrasAtivas` de um Plano via `PATCH /admin/planos/:planoId`, quando qualquer titular daquele plano consulta seu status ou tenta ativar uma safra, então o novo valor/limite já vale, sem precisar de deploy
15. Dado um admin que grava um `limiteSafrasAtivasOverride` pra um titular específico do Plano 1 (limite padrão 1), quando esse titular tenta colocar uma segunda safra em `EM_ANDAMENTO` dentro do valor do override, então consegue — e os demais titulares do Plano 1 continuam limitados a 1
16. Dado esse mesmo override, quando o admin o remove (`limiteSafrasAtivasOverride: null`), então o titular volta a valer pelo limite padrão do plano dele

## Perguntas em aberto (assumidas nesta spec)

- O que fazer quando um titular já tem mais safras `EM_ANDAMENTO` do que o novo limite permite (ex.: você reduz o limite ou troca pra um plano menor depois que ele já tinha 3 em andamento) — a spec assume que **nada é fechado retroativamente**: as safras já em andamento continuam normalmente, só fica bloqueada a próxima tentativa de colocar uma nova em `EM_ANDAMENTO` até o número cair abaixo do limite de novo
