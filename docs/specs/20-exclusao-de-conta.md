# Spec 20 — Exclusão de conta

## Motivação

O app mobile foi enviado para a App Store e ainda não foi aprovado. É muito provável que a causa seja a **Diretriz 5.1.1(v) da App Store Review** ("Account Sign-In"): todo app que permite ao usuário **criar** uma conta dentro do app também precisa permitir **excluí-la** de dentro do app — não vale só oferecer suporte por e-mail/telefone. Essa exigência está em vigor desde 30/06/2022, não é novidade de 2026.

Hoje o HortiFlow Produtor tem cadastro (telefone + senha) e logout, mas nenhum fluxo de exclusão de conta — nem no backend, nem no web, nem no mobile. Esta spec cobre a funcionalidade que resolve isso.

A spec 17 (observabilidade e auditoria) já previu esse gap: existe um comentário no schema esperando o evento `EXCLUSAO_CONTA` em `EventoAuditoria` para quando esta funcionalidade fosse especificada.

## Escopo

**Entra:**
- Endpoint de backend para o próprio usuário excluir sua conta (autenticado, com reautenticação por senha)
- Tela/fluxo de exclusão no mobile (prioridade — é o app em análise na Apple)
- Mesma tela/fluxo no web, em Configurações → Conta (`ConfiguracoesContaPage.tsx`), por consistência e porque o Google Play tem exigência equivalente para apps na Play Store
- Regra de negócio de **o que acontece com os dados** quando a conta é excluída (o ponto central desta spec — ver abaixo)
- Emissão do evento `EXCLUSAO_CONTA` em `EventoAuditoria` antes da anonimização

**Fica de fora:**
- Exclusão de conta por um admin (painel administrativo) — só autoexclusão pelo próprio usuário nesta spec
- Exportação de dados pessoais (LGPD "direito à portabilidade") antes de excluir — pode virar uma spec futura se pedido
- Fluxo de "desativação temporária" (pausar conta sem excluir) — não faz parte do escopo

## Decisão de negócio (validada com o desenvolvedor em 2026-08-28)

Na prática, quem paga e usa o app de verdade é o **financiador/titular** da sociedade. O meeiro só entra pra visualizar despesas/vendas com transparência — raramente vai ser um usuário ativo de verdade, e a exclusão de conta pensada aqui é sobretudo para o titular. Por isso a regra muda de acordo com o papel de quem está excluindo:

- **Titular excluindo a própria conta** (`Sociedade.criado_por_usuario_id === eu`, para qualquer sociedade que ele tenha criado): **exclusão física completa** — a(s) sociedade(s) que ele criou são apagadas de verdade, com tudo que existe dentro delas (safras, despesas, vendas, acertos, regras recorrentes, sócios vinculados). Não é anonimização.
- **Sócio não-titular excluindo a própria conta** (ele é apenas `SocioSociedade` de uma sociedade criada por outra pessoa): esse caso raro ainda existe e precisa de um tratamento diferente — ver "Por que a exclusão física nem sempre é possível" abaixo.

## Por que a exclusão física nem sempre é possível pra todo mundo

O schema não tem `onDelete: Cascade` em nenhuma relação de `Usuario`. Isso é fácil de contornar dentro de uma sociedade que o próprio titular está apagando (a gente controla a ordem de exclusão, de baixo pra cima, dentro de uma transação). O problema aparece só quando **outra pessoa** (não o titular) tem dados lançados numa sociedade que **não é dela** — por exemplo, um meeiro que lançou despesas na sociedade de um financiador. Nesse caso, `Despesa.socio_id` e `AporteTrabalho.socio_id` são campos **obrigatórios** (não aceitam `null`) — não dá pra apagar a linha `Usuario` desse meeiro sem quebrar a integridade referencial de despesas que continuam existindo (porque a sociedade em si não foi apagada, só o meeiro saiu dela).

Então a regra final é:

1. **Todas as sociedades das quais o usuário é titular** → excluídas fisicamente, em cascata, dentro de uma transação (ver ordem abaixo).
2. **Dados próprios do usuário, sempre excluídos de verdade**: `DespesaPessoal` (é privada, não afeta mais ninguém).
3. **A linha `Usuario` em si**:
   - Se, depois do passo 1, o usuário **não tiver mais nenhuma referência obrigatória pendente** em sociedades de outras pessoas (ou seja, nunca foi sócio não-titular em lugar nenhum, ou já saiu de todas) → **excluída fisicamente** também. É o caso comum (financiador que só usa a própria sociedade).
   - Se ainda restar alguma `Despesa`/`Venda`/`AporteTrabalho`/`SocioSociedade` dele como sócio não-titular em sociedade de outra pessoa → a linha `Usuario` é **anonimizada** em vez de apagada (nome/telefone/senha substituídos, `status = EXCLUIDO`), só pra não quebrar o extrato de quem continua na sociedade dele. Esse é o único caso em que a exclusão não é 100% física, e é uma consequência direta da constraint do banco, não uma escolha de design.
4. `Assinatura`: **não é excluída fisicamente** — fica com `status = CANCELADA`. O cancelamento da cobrança em si (Asaas ou combinado manual/PIX/dinheiro) é feito manualmente pelo desenvolvedor fora do app; o app só marca o registro interno como cancelado, preservando o histórico de `Pagamento` já feito.
5. `EventoAuditoria`: os eventos já registrados ficam (não são apagados, servem de trilha histórica); se a linha `Usuario` for excluída fisicamente, `EventoAuditoria.usuario_id` fica `null` (o campo já é opcional). Antes de qualquer exclusão, é gravado um novo evento `EXCLUSAO_CONTA` com o `usuario_id` ainda válido, pra registrar quem pediu a exclusão e quando.
6. Todos os tokens JWT em uso ficam inválidos na prática: se a linha some, qualquer chamada autenticada recebe 401 (usuário não encontrado); se for anonimizada, cai no mesmo tratamento de `status = EXCLUIDO` (ver item abaixo).

### Ordem de exclusão em cascata de uma Sociedade (dentro de uma transação Prisma)

De baixo pra cima, pra respeitar as FKs: `RateioDespesa`/`RateioRegra` → `AcertoSocio` → `Despesa`/`Venda`/`AporteTrabalho` → `RegraDespesaRecorrente` → `Acerto` → `Safra` → `SocioSociedade` → `Sociedade`.

**Efeito colateral a documentar na UI de confirmação**: se algum meeiro tiver `DespesaPessoal` lançada numa safra dessa sociedade, essas despesas pessoais dele também deixam de existir junto (porque `DespesaPessoal.safra_id` aponta pra uma safra que está sendo apagada). É um efeito colateral aceitável dado que o meeiro é um usuário secundário raro, mas precisa constar no aviso de confirmação ("todos os dados desta sociedade, incluindo despesas pessoais de outros sócios nela, serão apagados definitivamente").

## Regras de negócio

1. **Reautenticação obrigatória**: a exclusão exige a senha atual no corpo da requisição, mesmo com token válido — mesma cautela de uma troca de senha (spec 09), mas aqui o efeito é irreversível.
2. **Confirmação explícita na UI**: tela de confirmação avisando o que será perdido. Para o titular: "todas as sociedades que você criou, com todas as despesas, vendas e acertos, serão apagadas definitivamente — inclusive despesas pessoais de outros sócios lançadas nelas". Não basta um único toque acidental — exigir digitar uma palavra de confirmação ou um segundo passo.
3. **Titular de sociedade com outros sócios ativos**: exclusão liberada sem bloqueio nem etapa prévia de transferência de titularidade — a sociedade é apagada por completo junto com a conta do titular (decisão do dev, já que na prática só o titular usa o app de verdade).
4. **Efeito imediato**: a exclusão acontece na hora (sem "período de carência" escondendo a opção real) — a Apple rejeita fluxos que simulam exclusão mas na prática só desativam ou atrasam indefinidamente.
5. **Telefone liberado**: como o cadastro é feito por telefone, é importante que o número fique livre para uso em um novo cadastro depois da exclusão — vale tanto para exclusão física da linha `Usuario` quanto para o caso raro de anonimização (telefone substituído por um valor não reutilizável).

## Contrato de API

```
DELETE /auth/me
Headers: Authorization: Bearer <token>
Body: { "senha": string }

200 OK
  { "mensagem": "Conta excluída com sucesso." }

401 Unauthorized — senha incorreta ou token inválido
```

Reaproveita o padrão de rotas de `auth.ts`/`auth.controller.ts` (mesmo arquivo de `trocarSenha`).

## Telas

**Mobile** (prioridade — é o app pendente de aprovação): nova tela de Conta/Perfil em `mobile/src/screens/`, com opção "Excluir minha conta" — hoje não existe nenhuma tela equivalente no mobile. Precisa entrar no fluxo de navegação (`docs/specs/mobile/08-navegacao-resumo-e-menu.md`) como um novo item de menu.

**Web**: mesmo fluxo em `ConfiguracoesContaPage.tsx`, abaixo da troca de senha.

## Critérios de aceite

1. Dado um usuário titular logado, quando ele abre a tela de exclusão de conta e informa a senha correta com a confirmação explícita, então todas as sociedades que ele criou (com safras, despesas, vendas, acertos, regras e sócios vinculados) são apagadas fisicamente, sua conta é apagada (ou anonimizada, se ele também for sócio não-titular em outro lugar), o evento `EXCLUSAO_CONTA` é gravado antes da exclusão, e ele é deslogado imediatamente (mobile e web).
2. Dado um usuário que informa a senha errada, quando tenta excluir, então recebe erro e nada é alterado.
3. Dado um usuário excluído, quando tenta fazer login novamente com o telefone/senha antigos, então recebe erro (conta não existe mais / credenciais inválidas).
4. Dado um usuário titular excluído, quando um meeiro que estava na sociedade dele tenta acessar essa sociedade depois, então recebe erro (a sociedade não existe mais).
5. Dado um usuário não-titular (sócio de sociedade de outra pessoa) que exclui a própria conta, quando o titular dessa sociedade olha o extrato/histórico depois, então continua vendo todos os lançamentos anteriores normalmente, com autoria atribuída a "Usuário excluído" — a sociedade do titular não é afetada.
6. Dado qualquer usuário que exclui a conta, quando ele tinha `DespesaPessoal` cadastradas, então essas despesas pessoais deixam de existir.
7. Dado um telefone que pertencia a uma conta excluída (fisicamente ou anonimizada), quando alguém tenta se cadastrar com esse mesmo telefone depois, então o cadastro funciona normalmente (não há mais conflito de unicidade).
8. Dado um usuário titular excluído com `Assinatura` ativa/trial, quando a exclusão acontece, então a assinatura interna fica com status `CANCELADA` (o cancelamento externo da cobrança, se houver, é feito manualmente pelo desenvolvedor).

## Decisão técnica registrada durante a implementação

`Pagamento.assinatura_id` é obrigatório — excluir fisicamente uma `Assinatura` com pagamentos já registrados apagaria o histórico financeiro do desenvolvedor junto (não é dado pessoal do usuário, é registro de cobrança/contabilidade). Por isso, quando o titular é excluído fisicamente, a `Assinatura` **não** é apagada: fica com `status = CANCELADA` e `usuario_id = null` (campo tornado opcional no schema para viabilizar isso), preservando `Pagamento` como registro órfão de cobrança.

## Decisões já validadas com o desenvolvedor (2026-08-28)

1. **Titular excluindo a conta com sociedade ativa**: exclusão física completa e imediata da sociedade inteira, sem etapa de transferência de titularidade nem aviso prévio aos demais sócios — o titular é o único usuário real esperado na prática.
2. **Assinatura**: o app só marca `Assinatura.status = CANCELADA`; o cancelamento de qualquer cobrança externa (Asaas, PIX manual, dinheiro) é feito manualmente pelo desenvolvedor fora do fluxo do app — não é necessária integração automática com a Asaas para isso.
3. **`SocioSociedade.usuario_id` nulo (placeholder)**: não se aplica — resolvido junto com a decisão 1 (não existe transferência de titularidade nem preservação de sociedade "órfã" a considerar).
4. **Nome de exibição do usuário anonimizado**: mantido genérico, `"Usuário excluído"`, sem tentar preservar qualquer pista de identidade.
