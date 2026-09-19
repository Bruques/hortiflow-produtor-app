# 28 — Painel do dono (`/admin/dashboard`)

## Objetivo

Dar ao desenvolvedor (único usuário do painel admin) uma tela para acompanhar o negócio e agir sobre cada produtor sem mexer no banco: ver receita, assinantes, quem pagou, quando pagou e até quando vai o plano; gerar cobranças (Pix ou cartão, mensal ou anual, com desconto); liberar acesso, cancelar assinatura e bloquear conta.

Motivação: o primeiro pagamento real entrou em 2026-09-19. Hoje o painel `/admin/assinaturas` (spec 18) só lista titulares e atribui plano; não há visão de receita, nem histórico de pagamentos, nem como cobrar com desconto.

Esboço visual aprovado pelo desenvolvedor: artifact "Central HortiFlow" (https://claude.ai/artifact/Hu5kLgnRYJRkSeCkJx5Sra). Segue a paleta de `docs/design/notas-de-design.md`.

## Escopo

**Entra:**
- Rota web `/admin/dashboard`, protegida pelo login admin que já existe (`AdminUsuario`, spec 18). Login por **e-mail + senha**, em `/admin/login`; depois de entrar, cai em `/admin/dashboard`
- Cartões de resumo: receita do mês (com comparação ao mês anterior fechado), receita acumulada, recorrência mensal, assinantes ativos, em trial, cadastrados
- Gráficos: receita por mês (últimos 5 meses) e cadastrados/pagantes acumulados por semana
- Funil: cadastraram → responderam onboarding → escolheram plano → pagaram
- Lista "precisa de atenção": trial acabando, plano manual vencendo, acesso vencido, onboarding parado
- Últimos pagamentos e tabela de produtores (busca, filtro por situação) com detalhe por produtor e histórico de pagamentos
- **Gerar cobrança** para um produtor: plano, ciclo (mensal/anual), forma (Pix ou cartão de crédito) e desconto (% ou R$)
- **Liberar acesso** (registrar pagamento manual, agora também como cortesia de valor 0)
- **Cancelar assinatura** e **bloquear/desbloquear conta**
- Script para criar o login do dono (senha nunca vai no repositório)

**Fica de fora:**
- Saldo de crédito na conta do produtor (decidido: "crédito" = cartão de crédito)
- Guardar o desconto como campo próprio: o `Pagamento` grava só o valor efetivamente pago. O desconto fica implícito (preço de tabela − valor pago)
- Cartão mensal com débito automático (segue como cobrança única, ver spec 25); Pix e cartão mensais são renovados a cada ciclo por uma nova cobrança
- Envio automático de WhatsApp: o botão só abre a conversa (`wa.me`) com o produtor
- Edição de preço/limite dos planos no painel novo (continua em `/admin/assinaturas`)
- Dados de uso (despesas lançadas por produtor etc.)
- Recuperação de senha do admin

## Regras de negócio

**Cobrança com desconto**
- Preço base = `valor_mensal` ou `valor_anual` do plano escolhido
- Desconto percentual: maior que 0 e menor que 100. Desconto em R$: maior que 0 e menor que o preço base. O valor final é arredondado a 2 casas e nunca fica abaixo de R$ 1,00
- Gerar a cobrança grava `plano_id` e `ciclo` na `Assinatura` (mesmo comportamento de `iniciarCheckout`), porque a confirmação do pagamento usa o `ciclo` para saber quantos dias liberar (30 ou 365)
- **Pix:** cria um pedido na API de Orders com o valor final e devolve copia-e-cola, QR e expiração, para o dono mandar por WhatsApp. **A confirmação é automática**: o webhook de pedidos já está configurado e foi validado em produção com um Pix real de R$ 1 (spec 25, 2026-09-15). O botão "verificar pagamento" fica só como rede de segurança (atraso ou falha do webhook) e reaproveita `confirmarPedidoPixWebhookMercadoPago` (idempotente)
- **Cartão de crédito:** cria uma preferência do Checkout Pro com o valor final e devolve o link. **A confirmação é automática**, pelo webhook de pagamento que já existe (validado em produção na spec 25, depois da correção do id numérico)
- **Uma cobrança em aberto por vez**: o `external_reference` do Mercado Pago é o id da `Assinatura`, e os dias liberados (30 ou 365) vêm do `ciclo` gravado nela. Se o dono gerar uma cobrança mensal e depois uma anual para a mesma pessoa, a última define o ciclo, e pagar a mais antiga liberaria os dias errados. A tela avisa quando já existe cobrança gerada e ainda não paga
- O pagamento confirmado grava o valor realmente cobrado (`Pagamento.valor`), então receita e histórico refletem o desconto

**Liberar, cancelar, bloquear**
- **Liberar acesso** usa o pagamento manual da spec 18 (Pix direto, dinheiro) e acrescenta **cortesia**: valor 0 permitido, novo método `MANUAL_CORTESIA`. Cortesia não soma na receita. A regra de "estender a partir do vencimento se ativo" não muda
- **Cancelar assinatura** marca `status = CANCELADA` e cancela a recorrência no gateway se houver (`asaas_subscription_id` ou `mp_preapproval_id`). **Não altera `data_fim_acesso`**: o produtor usa até o fim do que já pagou. Para cortar na hora, usa-se bloquear
- **Bloquear/desbloquear** altera `Usuario.status` (spec 16): derruba o acesso na próxima chamada. Não mexe na assinatura

**Métricas** (meses e semanas no fuso de Brasília)
- Receita de um mês = soma de `Pagamento.valor` cujo `criado_em` cai no mês, com valor > 0. Plano anual conta inteiro no mês em que foi pago (caixa)
- **Assinante ativo** = `status ATIVA`, `data_fim_acesso` no futuro e usuário não bloqueado nem excluído. **Em trial** = `status TRIAL` e `data_fim_acesso` no futuro
- **Recorrência mensal** = soma, sobre os ativos, do valor do último pagamento dividido pelos meses que ele cobre (30 dias = 1, 365 dias = 12). Usa o período de fato coberto, não o ciclo gravado, porque o pagamento manual aceita qualquer quantidade de dias
- **Cadastrados** = usuários que não estão `EXCLUIDO` e que não são apenas sócios convidados (quem entrou por código de convite, não criou sociedade e nunca pagou também ganha um trial no cadastro, mas não é cliente). Pagamentos de contas excluídas (assinatura com `usuario_id` nulo) continuam na receita histórica, mas não aparecem como produtor
- **Situação exibida** de um produtor, em ordem de prioridade: Bloqueada → Cancelada → Trial expirado / Vencida (acesso no passado) → Em trial → Ativa

## Contrato de API

Todas exigem token admin (`adminAuthMiddleware`); 401 sem token, e um token de produtor nunca é aceito aqui.

```
GET /admin/dashboard
  200: {
    resumo: { receitaMes, receitaMesAnterior, receitaTotal, recorrenciaMensal, ativos, emTrial, cadastrados, cadastradosUltimos7Dias },
    receitaPorMes: [{ mes: "2026-09", valor, pagamentos }],            // últimos 5 meses
    crescimentoSemanal: [{ semana: "2026-05-04", cadastrados, pagantes }],  // acumulado
    funil: { cadastraram, responderamOnboarding, escolheramPlano, pagaram },
    atencao: [{ usuarioId, tipo, titulo, detalhe }],
    ultimosPagamentos: [{ usuarioId, nome, plano, metodo, valor, data, periodoFim }],   // 7 mais recentes
    produtores: [{ usuarioId, nome, telefone, situacao, plano, ciclo, dataFimAcesso, totalPago, safrasAtivas, limiteSafras, criadoEm,
                   bloqueado, respondeuOnboarding, perfil, pagamentos: [{ valor, metodo, periodoInicio, periodoFim, data }] }]
  }

POST /admin/assinaturas/:usuarioId/cobranca
  body: { planoId, ciclo: "MENSAL"|"ANUAL", metodo: "PIX"|"CARTAO",
          desconto?: { tipo: "PERCENTUAL"|"VALOR", valor: number } }
  200 (PIX):    { tipo: "PIX", valorBase, valorFinal, mpOrderId, qrCode, qrCodeBase64, dataExpiracao }
  200 (CARTAO): { tipo: "CARTAO", valorBase, valorFinal, linkPagamento }
  400: desconto inválido / valor final abaixo de R$ 1,00
  404: assinatura ou plano não encontrado

POST /admin/assinaturas/:usuarioId/pix/:orderId/verificar
  200: { pedidoStatus, dataFimAcesso, pago: boolean }

POST /admin/assinaturas/:usuarioId/pagamento-manual        (existente, ajustada)
  body: { valor: number >= 0, metodo: "MANUAL_PIX"|"MANUAL_DINHEIRO"|"MANUAL_CORTESIA", dias }
  400: valor 0 com método diferente de MANUAL_CORTESIA

POST /admin/assinaturas/:usuarioId/cancelar
  200: { status: "CANCELADA", dataFimAcesso }

POST /admin/usuarios/:usuarioId/bloqueio
  body: { bloqueado: boolean }
  200: { status: "ATIVO"|"BLOQUEADO" }
```

Mudança de schema: adicionar `MANUAL_CORTESIA` ao enum `MetodoPagamento` (migration).

## Criação do login do dono

`AdminUsuario` já existe, sem tela de cadastro por desenho (spec 18). O login do dono é criado por um script em `backend/scripts/` que lê **e-mail e senha de variáveis de ambiente** (`ADMIN_EMAIL`, `ADMIN_SENHA`), grava o hash `bcrypt` e é idempotente (se o e-mail já existe, atualiza a senha). A senha não é escrita em nenhum arquivo versionado. Roda em local e staging primeiro; produção só sob pedido explícito.

## Critérios de aceite

1. Dado um visitante sem login, quando abre `/admin/dashboard`, então é levado para `/admin/login`
2. Dado o e-mail e a senha do dono, quando faz login, então cai em `/admin/dashboard`; com senha errada recebe "Credenciais inválidas"
3. Dado um token de produtor, quando chama qualquer rota `/admin/*`, então recebe 401
4. Dado pagamentos confirmados no mês corrente e no anterior, quando abre o painel, então "Receita" mostra a soma do mês e a variação percentual contra o mês anterior fechado
5. Dado um plano anual pago em julho, quando vê receita por mês, então o valor inteiro aparece em julho, e a recorrência mensal usa esse valor ÷ 12
6. Dado uma conta excluída (spec 20) com pagamentos, quando abre o painel, então ela não aparece na tabela nem em "cadastrados", mas seus pagamentos seguem na receita histórica
7. Dado um produtor com plano de R$ 89,90, quando o dono gera cobrança Pix com 10% de desconto, então recebe copia-e-cola com valor final R$ 80,91 e a `Assinatura` passa a ter o plano e o ciclo escolhidos
8. Dado uma cobrança por cartão gerada, quando o produtor paga pelo link, então o webhook registra um `Pagamento` com o valor com desconto e estende o acesso em 30 ou 365 dias conforme o ciclo
9. Dado um Pix já pago, quando o dono clica "verificar pagamento" duas vezes, então só um `Pagamento` é criado
10. Dado um desconto igual ou maior que o preço base, ou valor final abaixo de R$ 1,00, quando o dono tenta gerar a cobrança, então recebe 400 e nada é criado no Mercado Pago
11. Dado um produtor em trial, quando o dono libera 30 dias como cortesia, então ele fica com status ATIVA por 30 dias, o histórico mostra "Cortesia" e a receita do mês não muda
12. Dado um produtor com plano pago até 30/10, quando o dono cancela a assinatura, então o status vira Cancelada e ele ainda acessa o app até 30/10
13. Dado um produtor com sessão aberta, quando o dono bloqueia a conta, então a próxima chamada dele recebe 401; ao desbloquear, volta a entrar normalmente
14. Dado que o script de criação do login roda duas vezes com o mesmo e-mail, então existe um único `AdminUsuario` e a senha vale a da última execução

## Decisões registradas durante a spec

- "Crédito" foi interpretado como **cartão de crédito** (confirmado pelo desenvolvedor em 2026-09-19); saldo de crédito ficou fora
- Desconto aceita **porcentagem ou valor em R$** (confirmado)
- "Cancelar" **não corta o acesso**; "bloquear" é o botão para cortar na hora (confirmado)
- Login criado primeiro em local e staging (confirmado)
- O cartão continua cobrança única mesmo no ciclo mensal, porque o débito automático não funcionou nos testes da spec 25. A cada mês o dono gera uma nova cobrança (ou o produtor paga pelo próprio app)
- Decisões da implementação (2026-09-19), não previstas no texto original:
  - **Renovação manual** é qualquer plano ativo sem recorrência no gateway (`asaas_subscription_id` ou `mp_preapproval_id`). Como cartão e Pix do Checkout Pro são cobranças únicas, isso vale para praticamente todos, e é o que alimenta o alerta "plano vence em N dias"
  - **Cortesia** exige valor 0 (e valor 0 só é aceito na cortesia). `POST /admin/assinaturas/:usuarioId/pagamento-manual` responde 400 nos dois casos contrários
  - O aviso de "cobrança anterior ainda em aberto" é da tela, guardado na sessão do navegador (`sessionStorage`), não do backend. Só aparece quando a nova cobrança troca o ciclo da anterior. Sem tabela de cobranças, o backend não sabe o que está em aberto
  - Com o Pix aberto na tela, o painel confere o pagamento a cada 10 segundos (idempotente), além do botão "verificar". O acesso em si é liberado pelo webhook
  - `GET /admin/planos` passou a devolver também `valorAnual`, para a tela mostrar o valor final com desconto antes de gerar
  - O e-mail do login admin é normalizado (`trim` + minúsculas) na entrada, e o script grava em minúsculas
  - As rotas novas foram classificadas como isentas no manifesto do gate de assinatura (spec 27), como as demais rotas `/admin/*`
