# 22 — Editar nome da safra

## Objetivo

Permitir que os sócios corrijam ou ajustem o nome de uma safra depois de criada. Hoje o nome só é definido na abertura da safra (`NovaSafraPage.tsx`) e não pode mais ser alterado — só as observações são editáveis ([spec 10](10-observacoes-da-safra.md)). Isso incomoda quando o produtor erra na digitação ou decide renomear a safra depois (ex: "Lavoura Boa Vi..." truncado por um nome mal escolhido).

## Escopo

**Entra:**
- Edição do campo `nome` de uma safra já existente, a qualquer momento (inclusive com a safra `ENCERRADA`), no mesmo espírito do critério de aceite 6 da spec 10
- **Um único botão "Editar" no card**, que abre nome e observações juntos no mesmo formulário — decisão tomada durante a implementação (substitui o par "Editar nome" / "Editar observações" testado inicialmente): dois botões lado a lado pra editar campos tão próximos (ambos identificação/descrição da mesma safra, sem ligação com regra de negócio) era fricção desnecessária. Ao salvar, só dispara `PATCH` pros campos que de fato mudaram
- Web **e mobile** (`mobile/src/screens/SafrasScreen.tsx`) — revertendo a exclusão de escopo registrada em `docs/specs/mobile/03-safra.md`

**Fica de fora:**
- Mudar as regras de quem pode abrir/encerrar safra
- Qualquer validação de unicidade de nome entre safras da mesma sociedade (hoje não existe essa regra na abertura, então edição não introduz uma nova)
- Histórico de nomes anteriores

## Regras de negócio

- Campo obrigatório — mesma regra da criação (`nome` não pode ficar vazio), diferente de observações que aceita `null`
- Qualquer sócio da sociedade (financiador ou meeiro) pode editar — é só identificação da safra, mesma justificativa de transparência usada pra observações, não é uma regra financeira como percentual de lucro
- Editável independentemente do status da safra (`PLANEJADA`, `EM_ANDAMENTO` ou `ENCERRADA`) — não é dado financeiro travado por Acerto
- Limite de tamanho: mesmo teto já usado no `abrirSafra` (sem limite explícito hoje além do que o banco aceita) — não introduzir restrição nova além de `min(1)`

### Comportamento offline (mobile)

Segue exatamente o critério já fixado em `docs/specs/mobile/03-safra.md` para observações: editar o nome **exige conexão** e **não entra na fila de sincronização offline**. Sem internet, mostra a mensagem de erro já usada pelas outras ações da tela (via `mensagemErro`), sem enfileirar. Não há motivo pra tratar diferente de observações — é o mesmo tipo de ação esporádica, sem urgência de funcionar no campo sem sinal (diferente de lançar despesa/venda).

## Contrato de API

```
PATCH /safras/:id/nome (autenticado, sócio da sociedade dona da safra)
  body: { nome: string }   // obrigatório, não pode ser vazio

  200: { safra: Safra }
  400: nome vazio ou ausente
  403: usuário não é sócio da sociedade dona da safra
  404: safra não encontrada
```

## Critérios de aceite

1. Dado um sócio (financiador ou meeiro) autenticado, quando chama `PATCH /safras/:id/nome` com um nome novo não vazio, então a resposta retorna a safra atualizada e uma nova listagem reflete o nome novo
2. Dado um nome vazio ou ausente no body, quando chama `PATCH /safras/:id/nome`, então retorna 400 e o nome não é alterado
3. Dado um usuário que não é sócio da sociedade dona da safra, quando chama `PATCH /safras/:id/nome`, então retorna 403
4. A edição funciona também numa safra com status `ENCERRADA`
5. Na tela "Safras" do web, cada card tem um único botão "Editar" (ícone de lápis) que abre nome e observações juntos num mesmo formulário; salvar atualiza o(s) campo(s) alterado(s) via `PATCH` e reflete no card sem precisar recarregar a tela
6. Mesmo critério 5, na tela "Safras" do mobile
7. Dado o app mobile sem internet, tentar editar (nome e/ou observações) mostra mensagem clara de que a ação exige conexão — não enfileira a ação
