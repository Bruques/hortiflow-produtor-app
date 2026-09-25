# Spec 31 — Excluir regra de despesa recorrente

## Motivação

Hoje uma regra só pode ser desativada, nunca excluída. Em produção isso faz a lista só crescer (um usuário tem 14 regras, 7 desativadas, várias quase idênticas) — ele "edita" criando outra e desativando a antiga.

## Escopo

**Entra:** excluir de verdade qualquer regra (global ou de lavoura), tenha ela gerado despesa ou não.

**Fica de fora:** preservar o rastro de "esta despesa veio da regra X" depois da exclusão (ver decisão abaixo); "arquivar"/esconder desativadas da lista.

## Decisão (2026-09-25): aceitar a perda do rastro

Alternativas consideradas:
- Excluir só regra que nunca gerou despesa (mantém o rastro, mas não resolve o acúmulo de regras já usadas)
- Guardar na própria despesa uma cópia de "veio de regra recorrente" (mantém o rastro; custa migration + backfill de produção + ajustes em vendas web/mobile)

Escolhido: **excluir sempre, perdendo o rastro**, por ser simples e resolver o acúmulo. Consequências aceitas:
- As despesas já geradas **continuam existindo**, com o mesmo valor e o mesmo rateio (guardam cópia própria), então lucro, painel e acertos não mudam
- Elas só perdem a ligação com a regra (`Despesa.regra_origem_id` vira null)
- Na listagem de vendas, o selo "gerou despesa recorrente" de vendas cuja regra foi excluída **some**, porque o selo é calculado a partir desse vínculo (e do valor da regra, que também deixa de existir)
- Ao editar uma venda antiga, o toggle daquela regra não aparece mais

## Regras de negócio

- Só FINANCIADOR/MISTO da sociedade (mesma regra de editar/desativar)
- Na transação: despesas geradas têm `regra_origem_id` zerado, o rateio da regra (`RateioRegra`) é apagado, e a regra é apagada
- No web e no mobile a lixeira ocupa o lugar do interruptor de ativar/desativar no card da regra, com confirmação antes (ação irreversível)

## Contrato de API

- `DELETE /regras-recorrentes/:id` → 204; 404 se não existe; 403 se não pode configurar

## Critérios de aceite

1. Regra sem despesas: lixeira no card; confirmar remove da lista
2. Regra com despesas geradas: exclui igual; as despesas permanecem na lista de despesas com o mesmo valor e rateio, sem vínculo com a regra
3. Regra com rateio personalizado: exclui sem erro (rateio some junto)
4. Sócio não-financiador: 403 (e a lixeira não aparece na tela)
5. Excluir pede confirmação antes
6. Conhecido e aceito: o selo de "despesa recorrente" some nas vendas ligadas à regra excluída

## Perguntas em aberto

- O interruptor de ativar/desativar sumiu da tela (a lixeira ocupa o lugar). Se sentirem falta de "pausar" uma regra sem apagar, reavaliar
- O texto da confirmação poderia avisar que as despesas já geradas ficam sem ligação com a regra
