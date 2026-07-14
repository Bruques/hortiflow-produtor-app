# Task 6 — Acerto

## Objetivo

Permitir que os sócios registrem formalmente que "se acertaram" financeiramente para um período da Safra — transformando a simulação em tempo real (task 5) num snapshot congelado e auditável. É a peça que resolve a dor central do produto: o meeiro deixa de "receber por caixa, descontada" sem explicação, e passa a ter um extrato permanente de como cada valor foi calculado. Um Acerto do tipo `FINAL` também encerra a Safra.

## Escopo

**Entra:**
- Criar um Acerto (`PARCIAL` ou `FINAL`) para um intervalo de datas dentro da Safra, reaproveitando `calcularDivisao` (task 5) para gerar o snapshot
- Persistir o snapshot por sócio em `AcertoSocio` (despesas bancadas, percentual aplicado, valor de lucro) — imutável a partir da criação
- Listar o histórico de Acertos de uma Safra
- Ver o extrato detalhado de um Acerto específico
- Acerto `FINAL` muda `Safra.status` para `ENCERRADA`
- Mesma visão para financiador e meeiro (sem permissão parcial, igual ao resto do MVP)

**Fica de fora (não implementar nesta task):**
- Editar ou excluir um Acerto já criado (é um snapshot — corrigir dado errado é lançar despesa/venda de ajuste e fazer um novo Acerto, não alterar o histórico)
- Reembolso de quem bancou despesas antes de dividir o restante (mesma decisão em aberto da task 5)
- Confirmação dos dois lados antes de fechar (pergunta em aberto #5 do CLAUDE.md — MVP: qualquer sócio pode registrar um Acerto sozinho, consistente com "sem permissões parciais no MVP")
- Exportar o extrato em PDF (Fase 2)
- Reabrir uma Safra `ENCERRADA`

## Regras de negócio

### Quem pode criar um Acerto

Qualquer sócio da Sociedade (financiador ou meeiro) — sem distinção de papel, mesma lógica de "sem permissões parciais no MVP" já usada nas outras tasks. Fica registrado como decisão explícita porque é diferente de "só o financiador decide quando fechar", que seria outra opção razoável; escolhida a mais simples para o MVP.

### Pré-condições para criar um Acerto

- A Safra precisa estar com `status = EM_ANDAMENTO` (não dá pra acertar uma Safra `PLANEJADA`, sem lançamentos, nem uma já `ENCERRADA`)
- `data_inicio <= data_fim`
- `data_inicio` deve ser maior ou igual à `data_fim` do último Acerto já criado nessa Safra (se houver algum) — evita períodos sobrepostos, que causariam o mesmo lucro sendo "acertado" duas vezes. Se não houver Acerto anterior, qualquer intervalo dentro da Safra é aceito.

### Geração do snapshot

O controller busca Despesas e Vendas da Safra no intervalo `[data_inicio, data_fim]` e os `SocioSociedade` da Sociedade, chama `calcularDivisao` (mesmo service da task 5, sem alteração) e persiste o resultado:

- `Acerto`: `safra_id`, `data_inicio`, `data_fim`, `tipo`
- `AcertoSocio` (um por sócio da Sociedade): `socio_id`, `despesas_bancadas` (soma de `Despesa.valor` no período, filtrado por `socio_id` = aquele sócio), `percentual_aplicado` (cópia de `SocioSociedade.percentual_lucro` no momento da criação — não referencia o valor ao vivo, pra não mudar retroativamente se o percentual for alterado depois), `valor_lucro` (o valor calculado pelo `calcularDivisao` para aquele sócio)

Tudo dentro de uma transação Prisma (`$transaction`): se `tipo = FINAL`, o mesmo `update` que cria o Acerto também muda `Safra.status` para `ENCERRADA`.

### Acerto FINAL

- Além de tudo acima, marca `Safra.status = ENCERRADA`
- Depois disso, nenhum novo Acerto pode ser criado nessa Safra (bloqueado pela pré-condição de `status = EM_ANDAMENTO`)
- Não há necessidade de todas as vendas/despesas estarem "fechadas" antes — o produtor decide quando encerrar, o sistema só congela o que existir até `data_fim`

## Contrato de API

```
POST /safras/:id/acertos
  auth obrigatório, requer ser sócio da sociedade dona da safra
  body: { data_inicio: string, data_fim: string, tipo: "PARCIAL" | "FINAL" }
  → 201 {
      id, safra_id, data_inicio, data_fim, tipo, criado_em,
      receita, despesas, lucroLiquido,
      socios: [{ socio_id, nome, despesas_bancadas, percentual_aplicado, valor_lucro }]
    }
  → 400 se data_inicio > data_fim, se sobrepõe o último Acerto, ou se a Safra não está EM_ANDAMENTO
  → 403 se não for sócio da sociedade

GET /safras/:id/acertos
  auth obrigatório, requer ser sócio
  → 200 [{ id, data_inicio, data_fim, tipo, criado_em }]  (lista resumida, mais recente primeiro)
  → 403 se não for sócio

GET /acertos/:id
  auth obrigatório, requer ser sócio da sociedade dona da safra do acerto
  → 200 { id, safra_id, data_inicio, data_fim, tipo, criado_em, receita, despesas, lucroLiquido,
          socios: [{ socio_id, nome, despesas_bancadas, percentual_aplicado, valor_lucro }] }
  → 403 se não for sócio
  → 404 se o acerto não existe
```

## Decisão de arquitetura a registrar

Nenhuma migration nova — `Acerto` e `AcertoSocio` já existem no schema desde a task 1, exatamente pra suportar isso sem redesenho.

**Por que reaproveitar `calcularDivisao` sem alterá-lo:** é a regra crítica do CLAUDE.md — o Acerto é só "mais um consumidor" do mesmo cálculo puro da task 5, com o resultado persistido em vez de só exibido. Se a fórmula mudar, muda em um arquivo só e tanto a simulação quanto os Acertos futuros passam a refletir a nova fórmula (Acertos já criados continuam com o snapshot antigo, propositalmente).

**Por que `percentual_aplicado` é uma cópia e não uma referência:** se o percentual de lucro de um sócio for renegociado numa safra futura (ou até dentro da mesma, embora não seja o fluxo esperado), os Acertos antigos não podem mudar de valor retroativamente — são documento histórico.

**Por que bloquear sobreposição de período em vez de permitir livremente:** sem essa trava, dois Acertos parciais cobrindo o mesmo intervalo contariam o mesmo lucro duas vezes, quebrando a credibilidade do extrato — que é o ponto central do produto.

## Critérios de aceite

1. Dado uma Safra `EM_ANDAMENTO` com despesas e vendas lançadas, `POST /safras/:id/acertos` com `tipo=PARCIAL` cria um `Acerto` e um `AcertoSocio` por sócio, com os valores batendo com o que `GET /safras/:id/simulacao` retornaria pro mesmo intervalo
2. `POST` com `tipo=FINAL` muda `Safra.status` para `ENCERRADA`
3. Depois de um Acerto `FINAL`, uma nova tentativa de `POST /safras/:id/acertos` retorna 400
4. `POST` com `data_inicio > data_fim` retorna 400
5. Um segundo `POST` cujo `data_inicio` é anterior ao `data_fim` do último Acerto (sobreposição) retorna 400
6. Um segundo `POST` cujo `data_inicio` é igual ou posterior ao `data_fim` do último Acerto é aceito normalmente
7. `GET /safras/:id/acertos` lista os Acertos da Safra, mais recente primeiro
8. `GET /acertos/:id` retorna o extrato completo, incluindo o valor por sócio
9. Um sócio `MEEIRO` consegue criar um Acerto e ver o extrato de qualquer Acerto da Safra, igual a um `FINANCIADOR`
10. Se o percentual de lucro de um sócio for alterado depois de um Acerto existir, o `percentual_aplicado` daquele Acerto antigo permanece inalterado
11. Frontend: tela de histórico de Acertos da Safra (lista) + tela de detalhe/extrato de um Acerto + fluxo de criar novo Acerto (escolher período, tipo, confirmar) reaproveitando o seletor de período já existente na tela de simulação
