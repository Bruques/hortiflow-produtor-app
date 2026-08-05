# Mobile 06 — Vendas, unidades de venda e despesa recorrente

## Objetivo

Levar pro app mobile o lançamento de Vendas — a outra operação de alto volume em campo, ao lado de Despesas (spec `04`) — junto com o que ela depende: unidades de venda configuráveis (spec `08` do web) e `RegraDespesaRecorrente` (spec `04` do web + rateio da spec `13`). Reaproveita 100% do contrato já em produção.

## Escopo

**Entra:**
- Cadastro de **unidades de venda** em Configurações (nome livre, ativa/inativa) — só sócio `FINANCIADOR`/`MISTO`
- Lançar Venda: `data`, `quantidade`, `preco`, `comprador?`, `unidade_id` (obrigatório), `pago` (toggle "Já foi pago?"), e os toggles opt-in de regras `POR_VENDA` aplicáveis (`regras_por_venda_aplicadas`)
- Listar vendas da safra, com indicação de status de pagamento e das regras que geraram despesa
- Editar e excluir Venda — bloqueado (`409`) se a data já estiver coberta por um Acerto; editar recalcula despesas `POR_VENDA` conforme os toggles atuais
- Configurar `RegraDespesaRecorrente`: criar (com `tipo_gatilho`, `tipo_despesa`, `valor`, `unidade_id` obrigatório quando `POR_VENDA`, e rateio opcional — mesmo seletor da spec `04`), listar, ativar/desativar, **editar** (`tipo_despesa`, `valor`, `unidade_id`, rateio — ver adendo 2026-08-04 da spec `04` web) — só `FINANCIADOR`/`MISTO` cria/edita
- **Sugestões do dia** (`POR_PERIODO`): lista de regras pendentes de confirmação hoje, com botão de confirmação de 1 clique
- Fila de sincronização offline pra Venda e pra confirmação de sugestão (ambas criam dado no servidor a partir de uma ação de campo)

**Fica de fora:**
- Fator de conversão entre unidades (mesma decisão do web: cada unidade é independente)
- Excluir uma regra recorrente já criada (avaliado e descartado por ora — mesma decisão do web, adendo 2026-08-04 da spec `04`; só ativar/desativar/editar)
- Despesa Pessoal — spec `07` mobile

## Regras de negócio

### Venda é operação offline (mesmo critério da spec `04`)
- Lançar Venda sem internet: salva localmente como `pendente`, aparece na lista imediatamente, sincroniza sozinha quando a conexão volta
- As Despesas geradas automaticamente por regra `POR_VENDA` **não são calculadas no cliente** — nascem no servidor no momento da sincronização (mesmo princípio da spec `05`: nenhum cálculo de negócio duplicado no app). Enquanto a Venda está `pendente`, a tela não promete nenhuma despesa gerada ainda; assim que sincroniza, a lista de despesas (spec `04`) reflete o que o servidor gerou
- Editar/excluir uma Venda já sincronizada também enfileira (mesmo padrão da spec `04`); uma Venda ainda pendente é editada/excluída só localmente

### Confirmar sugestão do dia também é offline
- "Confirmar" uma sugestão `POR_PERIODO` é, na prática, criar uma Despesa vinculada à regra — mesmo alto volume/uso em campo do critério da spec `02`, então enfileira do mesmo jeito que uma Despesa criada manualmente
- Duas confirmações da mesma regra no mesmo dia (uma offline, uma online, por exemplo) resolvem pelo `409` que o backend já retorna — o app trata como "já confirmado hoje", não como erro genérico

### Dependências de cache (mesmo princípio da spec `04`)
- Lançar Venda offline exige que **unidades de venda** e **regras `POR_VENDA` ativas da sociedade** já estejam em cache local (carregadas ao menos uma vez com internet) — sem isso, não há como montar o seletor de unidade nem os toggles de regra. Mesma mensagem de aviso da spec `04` quando não há cache: pede conexão antes do primeiro lançamento
- Como toda sociedade precisa ter ao menos uma unidade cadastrada antes de lançar a primeira Venda (regra já existente no backend), na prática essa dependência é resolvida naturalmente no onboarding (spec `02`/`03`), que já exige conexão

### Unidades de venda e Regras recorrentes exigem conexão
- Mesmo critério das specs `02`/`03`/`05`: cadastrar/desativar unidade e criar/desativar/**editar** regra recorrente são ações raras, restritas a `FINANCIADOR`/`MISTO`, com validação de servidor (nome duplicado, `422` de unidade errada ou rateio inválido) — **não entram na fila offline**. Sem internet, o botão de editar fica desabilitado com o mesmo aviso já usado pra criar
- Editar uma regra não recalcula nem toca em nenhuma Despesa já sincronizada por ela — mesma garantia da spec `04` web (adendo 2026-08-04)

### Toggles de regra `POR_VENDA` (opt-in explícito)
- Ao abrir "Nova venda", os toggles das regras `POR_VENDA` ativas da unidade escolhida vêm **marcados por padrão**; o sócio pode desmarcar antes de salvar
- Trocar a unidade recalcula a lista de toggles e reseta pro padrão marcado
- Ao editar uma Venda existente, os toggles refletem `regras_aplicadas` (o que já gerou despesa), não voltam todos marcados
- Enviar a lista de toggles vazia/omitida não gera nenhuma despesa — sem fallback implícito, mesma regra do web

### Papel na autorização
- `MEEIRO` não vê opção de criar/editar unidade nem regra recorrente (visível só como leitura na listagem, transparência total); tentativa de escrita seria bloqueada pelo próprio backend (`403`) se forçada

## Contrato de API

Nenhuma mudança — reaproveita integralmente o que já está em produção:

```
POST  /sociedades/:id/unidades-venda        { nome } → 201 { unidade } | 409 (nome duplicado) | 403
GET   /sociedades/:id/unidades-venda        → 200 { unidades: [{ id, nome, ativo }] }
PATCH /unidades-venda/:id                   { ativo } → 200 { unidade } | 403

POST  /safras/:id/vendas
  body: { data, quantidade, preco, comprador?, unidade_id, pago?, regras_por_venda_aplicadas? }
  → 201 { venda: { ..., unidade_id, unidade_nome, pago, regras_aplicadas } }
  → 422 (unidade_id inválido) | 403

GET   /safras/:id/vendas                    → 200 { vendas: [...] } | 403
PUT   /safras/:id/vendas/:vendaId           (mesmos campos, regras_por_venda_aplicadas opcional) → 200 | 409 (Acerto)
DELETE /safras/:id/vendas/:vendaId          → 204 | 409 (Acerto)

POST  /sociedades/:id/regras-recorrentes
  body: { socio_id, tipo_gatilho, tipo_despesa, valor, unidade_id?, rateio? }
  → 201 { regra } | 422 (unidade ausente p/ POR_VENDA, ou inválida) | 403 (papel MEEIRO)

GET   /sociedades/:id/regras-recorrentes    → 200 { regras: [...] } | 403
PATCH /regras-recorrentes/:id               { ativo } → 200 { regra } | 403
PUT   /regras-recorrentes/:id               { tipo_despesa, valor, unidade_id?, rateio? } → 200 { regra } | 422 (unidade/rateio inválido) | 403

GET   /safras/:id/regras-recorrentes/sugestoes  → 200 { sugestoes: [...] } | 403
POST  /safras/:id/regras-recorrentes/:regraId/confirmar → 201 { despesa } | 403 | 409 (já confirmada hoje)
```

## Critérios de aceite

1. Dado uma sociedade sem unidades, o financiador consegue cadastrar uma (ex: "Caixa"); um sócio `MEEIRO` não vê opção de criar
2. Cadastrar unidade com nome duplicado (mesmo com capitalização diferente) mostra o erro `409` do backend
3. Dado internet disponível, lançar uma Venda com unidade, quantidade, preço e toggles marcados cria a Venda e as despesas `POR_VENDA` correspondentes aparecem na listagem de despesas
4. Dado o app sem internet, lançar uma Venda aparece imediatamente na lista como "pendente"; ao reconectar, sincroniza e as despesas geradas aparecem normalmente depois
5. Desmarcar um toggle de regra `POR_VENDA` antes de salvar impede que aquela despesa específica seja gerada
6. Trocar a unidade na tela de nova venda recalcula os toggles disponíveis e os reseta pro padrão marcado
7. Editar uma Venda existente mostra os toggles conforme `regras_aplicadas` daquela venda, não todos marcados
8. Marcar/desmarcar "Já foi pago?" não afeta o painel de simulação nem o Acerto (puramente informativo)
9. Tentar editar/excluir uma Venda cuja data já está coberta por um Acerto mostra o erro tratado (409)
10. O financiador consegue criar uma `RegraDespesaRecorrente` com rateio customizado; um `MEEIRO` recebe erro tratado (403) ao tentar
11. Uma regra `POR_PERIODO` ativa aparece na lista de "sugestões do dia" até ser confirmada; confirmar duas vezes no mesmo dia mostra "já confirmado hoje" (409), sem crash
12. Confirmar uma sugestão sem internet enfileira a criação da despesa correspondente, sincronizando quando a conexão voltar
13. Dado que unidades/regras nunca foram carregadas (nenhuma conexão desde a instalação), a tela de nova venda avisa que é preciso conectar antes do primeiro lançamento
14. Existe teste unitário garantindo que o item de Venda na fila de sincronização carrega tudo que o backend exige (`unidade_id`, `regras_por_venda_aplicadas`, `pago`) e não tenta calcular despesas geradas no cliente
15. O financiador consegue editar uma `RegraDespesaRecorrente` existente (valor, tipo de despesa, unidade se `POR_VENDA`, rateio); Despesas já geradas por ela antes da edição não mudam de valor
16. Editar uma regra sem internet mostra aviso de que é preciso conexão, mesmo comportamento já existente pra criar; nenhuma tentativa de enfileirar a edição offline
17. Um `MEEIRO` não vê a ação de editar regra na listagem

## Decisões registradas durante a implementação

- **Bug de contrato no backend, corrigido junto (2026-08-03)**: `POST /safras/:id/vendas` e `PUT .../vendas/:vendaId` não devolviam `regras_aplicadas`/`coberta_por_acerto` na resposta (só a listagem tinha o shape completo). O app web nunca sentiu porque busca a lista de novo após salvar; o app mobile confirma o registro otimista offline direto com a resposta do POST/PUT, e um `undefined` nesses campos quebrava a escrita no cache local — o item criado offline desaparecia da lista até a tela buscar a safra inteira de novo. Corrigido em `backend/src/services/vendas.service.ts` (e o mesmo defeito, já latente, em `despesas.service.ts`, que tinha corrigido um bug irmão de `socio_nome` faltando mas deixado `coberta_por_acerto` de fora).
- Adicionado o selo "gerou despesa automática de R$X" na listagem de Vendas (`VendasScreen.tsx`), que a spec original não detalhou explicitamente — mesmo cálculo do web (`VendasPage.tsx`): cruza `venda.regras_aplicadas` com o valor *daquele momento* das regras (não o valor atual), pra não mudar retroativamente o selo de vendas já lançadas se a regra for editada depois.
