# 10 — Observações da safra

## Objetivo

Permitir que os sócios registrem um texto livre e informativo sobre a safra (ex: "Safra 2026 | Estufa | Córrego do Bom Jesus | 20 mil pés"), útil principalmente para diferenciar safras quando o usuário tem mais de uma ao mesmo tempo, ou lembrar detalhes como localização, número de pés e quem é o meeiro. É puramente informativo: **não entra em nenhum cálculo** (`calcularDivisao`, painel de simulação, Acerto) — mesma garantia já dada a `DespesaPessoal` no `CLAUDE.md`.

## Escopo

**Entra:**
- Campo `observacoes` (texto livre, opcional) na Safra
- Cadastro do campo na tela "Nova safra" (`NovaSafraPage.tsx`), abaixo do nome
- Exibição truncada do campo no card de cada safra na tela "Safras" (`SafrasPage.tsx`)
- Edição do campo depois da safra já criada, a qualquer momento (inclusive com a safra encerrada) — resolve o caso real de dado que só se sabe/decide depois da abertura (ex: contagem de pés)

**Fica de fora:**
- Qualquer validação de formato ou estrutura do texto (é texto livre, sem campos separados tipo "localização", "nº de pés" etc. — se isso virar necessidade real de busca/filtro estruturado, é uma spec própria depois)
- Histórico de versões da observação (só o valor atual é guardado)

## Regras de negócio

- Campo opcional — safra sem observação não mostra nada extra na listagem
- Qualquer sócio da sociedade (financiador ou meeiro) pode editar — é informativo, não uma regra de negócio como percentual ou regra de despesa recorrente, e a transparência do produto já dá visão igual a todos; não há necessidade de restringir a um papel
- Sem limite de caracteres rígido no backend além de um teto sensato (ex: 500) para evitar abuso — a UI trunca visualmente na listagem, mas guarda o texto completo
- Editável independentemente do status da safra (`PLANEJADA`, `EM_ANDAMENTO` ou `ENCERRADA`) — não é dado financeiro travado por Acerto, então não faz sentido bloquear

## Contrato de API

```
PATCH /safras/:id/observacoes (autenticado, sócio da sociedade dona da safra)
  body: { observacoes: string | null }   // string vazia ou null limpa o campo

  200: { safra: Safra }   // já inclui o campo observacoes
  400: observacoes acima do limite de tamanho
  403: usuário não é sócio da sociedade dona da safra
  404: safra não encontrada
```

`POST /sociedades/:id/safras` (abrir safra) passa a aceitar `observacoes` opcional no body, junto do `nome` já existente.

`GET /safras`, `GET /safras/:id` e `GET /sociedades/:id/safras` passam a retornar `observacoes` no objeto Safra.

## Critérios de aceite

1. Dado o formulário de "Nova safra", quando o usuário preenche observações e cria a safra, então a safra é criada com esse texto salvo
2. Dado o formulário de "Nova safra", quando o usuário deixa observações em branco, então a safra é criada normalmente com `observacoes` nulo
3. Na tela "Safras", um card de safra com observação preenchida mostra o texto truncado abaixo do nome; um card sem observação não mostra essa linha
4. Dado um sócio (financiador ou meeiro) autenticado, quando chama `PATCH /safras/:id/observacoes` com um texto novo, então a resposta retorna a safra atualizada e uma nova listagem reflete o texto novo
5. Dado um usuário que não é sócio da sociedade dona da safra, quando chama `PATCH /safras/:id/observacoes`, então retorna 403
6. A edição funciona também numa safra com status `ENCERRADA`
7. Na tela "Safras", cada card tem uma forma de editar a observação (ex: ícone de lápis) que abre um campo de texto, salva via `PATCH` e atualiza o card sem precisar recarregar a tela
