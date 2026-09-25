# Spec 30 — Regra de despesa recorrente por lavoura

## Motivação

Hoje `RegraDespesaRecorrente` pertence à `Sociedade` (não tem `safra_id`). Com a spec 23 (sócios por safra), uma mesma sociedade pode ter lavouras com meeiros diferentes (ex: lavoura A com João, lavoura B com Maria). Uma regra criada na lavoura A ("só o João paga") aparece e é editável na lavoura B, e editar numa altera a outra.

Este incremento faz as regras **novas** pertencerem a uma lavoura específica. As regras **existentes não são tocadas**.

## Escopo

**Entra:**
- Coluna opcional `safra_id` em `RegraDespesaRecorrente`
- Regras criadas a partir de agora ficam presas à lavoura em que foram criadas
- Regras antigas (`safra_id = null`) continuam valendo em todas as lavouras da sociedade, exatamente como hoje — sem migração de dados, sem backfill
- Web e mobile passam a criar/listar regras informando a lavoura ativa

**Fica de fora:**
- Converter uma regra antiga (global) em regra de uma lavoura, ou duplicá-la por lavoura — pode virar incremento futuro se o dono quiser limpar as antigas (por enquanto ele desativa a antiga e cria a nova na lavoura)
- Copiar regras ao criar uma lavoura nova

## Regras de negócio

- `safra_id` nulo = regra **global** (legada): aparece e vale em qualquer lavoura da sociedade. Editar/ativar/desativar uma global continua afetando todas as lavouras (comportamento atual, mantido de propósito para não quebrar nada)
- `safra_id` preenchido = regra da lavoura: só aparece, só gera sugestão e só pode ser aplicada em venda **daquela** lavoura
- O `safra_id` é imutável (não editável depois de criada)
- Ao criar regra com `safra_id`:
  - a lavoura precisa pertencer à sociedade da URL
  - todos os sócios do `rateio` precisam estar na lista de sócios **daquela lavoura** (`SocioSafra`), não só na sociedade — é isso que resolve "só o João paga" na lavoura A sem contaminar a B
- Sem `safra_id` no body, a criação se comporta como hoje (cria regra global). Isso mantém compatível qualquer app mobile já instalado que ainda não envia o campo
- Quem pode configurar continua igual (FINANCIADOR/MISTO da sociedade)

## Contrato de API

Mesmos endpoints, campo novo opcional — nenhuma rota removida ou renomeada.

- `POST /sociedades/:id/regras-recorrentes` — body ganha `safra_id?: string`
  - 404 se a lavoura não existir ou não for da sociedade
  - 422 se algum sócio do `rateio` não estiver na lavoura
- `GET /sociedades/:id/regras-recorrentes?safra_id=X` — devolve regras com `safra_id = X` **ou** `safra_id = null`. Sem o parâmetro: devolve todas, como hoje. Cada regra na resposta ganha `safra_id` (`null` = vale em todas as lavouras)
- `GET /safras/:id/regras-recorrentes/sugestoes` — considera só regras `POR_PERIODO` ativas com `safra_id = :id` ou nulo
- `POST /safras/:id/regras-recorrentes/:regraId/confirmar` — 404 se a regra tiver `safra_id` de outra lavoura
- `regras_por_venda_aplicadas` (criar/editar Venda) — `todasRegrasPorVendaValidas` passa a receber a lavoura da venda e rejeita (422, mesma mensagem de hoje) regra com `safra_id` de outra lavoura
- `PATCH/PUT /regras-recorrentes/:id` — sem mudança de contrato (a regra já carrega seu escopo)

## Modelo de dados

```prisma
model RegraDespesaRecorrente {
  ...
  safra_id String?          // null = global (legada)
  safra    Safra? @relation(fields: [safra_id], references: [id])
  @@index([safra_id])
}
```

Migration só adiciona a coluna nullable + índice. Nenhuma linha existente é alterada.

## Critérios de aceite

1. **Dado** regras já existentes na sociedade, **quando** a migration roda, **então** todas continuam com `safra_id = null` e aparecem em todas as lavouras como antes
2. **Dado** lavoura A (João) e B (Maria), **quando** crio na A uma regra com `safra_id = A` e rateio só do João, **então** a lista da B **não** mostra essa regra e a lista da A mostra
3. **Dado** a regra da A, **quando** edito/desativo ela estando na A, **então** nada muda na B
4. **Dado** regra `POR_PERIODO` da A, **quando** abro as sugestões da B, **então** ela não aparece; na A aparece. Confirmar via B devolve 404
5. **Dado** regra `POR_VENDA` da A, **quando** lanço venda na B marcando esse id, **então** recebo 422
6. **Dado** criar regra na A com rateio incluindo a Maria (que só está na B), **então** 422
7. **Dado** regra antiga global, **quando** abro qualquer lavoura, **então** ela aparece e continua gerando sugestão/despesa em todas
8. **Dado** app mobile antigo que não envia `safra_id`, **quando** cria regra, **então** ela nasce global (comportamento de hoje)
9. Web e mobile: a tela de regras mostra as globais e as da lavoura ativa; regra global exibe a marca "Todas as lavouras" para o dono entender por que edição nela afeta todas

## Perguntas em aberto

- Vale oferecer "Converter para esta lavoura" nas regras globais? Adiado até o dono pedir
