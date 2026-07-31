# Mobile 04 — Despesas da sociedade

## Objetivo

Levar pro app mobile o lançamento e a listagem de Despesas da sociedade, incluindo o rateio customizado já validado no web (`docs/specs/13-rateio-de-despesas.md`, implementado e testado em `3818092`). Esta é a operação mais importante de toda a iniciativa mobile do ponto de vista do requisito de offline-first (`CLAUDE.md`): é o lançamento que o produtor faz na roça, sem sinal, várias vezes ao dia — é o caso concreto que primeiro justificou o mecanismo genérico de fila de sincronização da spec `00`.

## Escopo

**Entra:**
- Criar Despesa da sociedade — `POST /safras/:id/despesas` — com `socio_id`, `tipo`, `valor`, `data`, `descricao?`, `foto_comprovante?` e o rateio opcional (`rateio?: { socio_id, percentual }[]`)
- Seletor "Quem paga essa despesa?" — **Dividir como o lucro** (padrão) / **Só eu** / **Só [outro sócio]** / **Personalizado** — mesmas 4 opções da tela `NovaDespesaPage.tsx` do web
- Foto de comprovante via **câmera nativa** do celular, convertida pra base64 (mesmo formato que o backend já aceita hoje — string simples, sem storage externo)
- Listar despesas da safra — `GET /safras/:id/despesas` — com indicação visual (badge) quando o rateio não é o padrão
- Editar e excluir despesa — `PUT`/`DELETE /safras/:id/despesas/:despesaId` — respeitando a trava de `409` quando a despesa já está coberta por um Acerto
- **Fila de sincronização concreta de despesas**, usando o mecanismo genérico já construído na spec `00`: criar/editar/excluir despesa funciona sem internet, sincroniza automaticamente quando a conexão voltar

**Fica de fora:**
- Despesa compartilhada entre safras (spec `11-resumo-consolidado-e-despesa-compartilhada.md` do web) — mesma decisão já tomada na spec `05` mobile: fica pra um incremento futuro
- Vendas e `RegraDespesaRecorrente` — spec `06` mobile
- Despesa Pessoal — spec `07` mobile

## Regras de negócio

### Despesa é a operação central offline
Diferente das specs `02`/`03`/`05` (que exigem conexão por serem raras e dependerem de validação imediata do servidor), lançar despesa é **exatamente o caso que qualifica pra fila offline**, pelo critério fixado na spec `02`: alto volume, uso em campo, tolera confirmação tardia.

- Criar despesa sem internet: salva localmente com status `pendente`, aparece na lista imediatamente (atualização otimista), sincroniza sozinha quando a conexão volta — sem ação manual do produtor
- Editar/excluir uma despesa **que já existe no servidor**: mesma lógica, enfileira a alteração
- Editar/excluir uma despesa **ainda pendente de sincronização** (nunca chegou ao servidor): só atualiza o item na fila local, sem tentar chamar o servidor por uma despesa que ele nem sabe que existe
- Se a sincronização de um item falhar (ex: `422` inesperado), só aquele item fica marcado com erro — não trava os demais itens pendentes da fila

### Dependência de sócios já em cache
Lançar despesa (mesmo offline) exige saber a lista de sócios da sociedade (pra `socio_id` e pro seletor de rateio) — essa lista vem da spec `02`, já cacheada localmente. Se o app nunca teve conexão nem uma vez (primeiro uso), não há sócios em cache e a tela de nova despesa avisa que é preciso conectar à internet pelo menos uma vez antes de lançar despesas — não é possível "adivinhar" sócios que o app nunca viu.

### Rateio ("Quem paga essa despesa?")
- **Dividir como o lucro** (padrão, pré-selecionado): nenhum campo extra, `rateio` omitido no payload
- **Só eu** / **Só [outro sócio]**: monta automaticamente `rateio: [{ socio_id, percentual: 100 }]` pro sócio escolhido
- **Personalizado**: um campo de percentual por sócio, validado no cliente pra somar 100% **antes** de permitir salvar (mesmo offline) — evita descobrir o erro só na hora da sincronização, quando o produtor já saiu do campo
- Despesa com rateio customizado mostra um badge na listagem (ex: "Rateio: só Ana"); despesa padrão não mostra nada extra — mesmo princípio de transparência do web

### Foto de comprovante
- Capturada com a câmera nativa (não da galeria, pra manter o hábito de "foto do momento" já estabelecido no web), convertida pra base64 e enviada no mesmo campo `foto_comprovante` que o backend já aceita
- Funciona 100% offline: a foto viaja dentro do próprio item da fila de sincronização, sem precisar de um passo de upload separado

### Edição e exclusão travadas por Acerto
- Mesma regra do backend: despesa já coberta por um Acerto retorna `409` — tratado no app como mensagem clara ("essa despesa já faz parte de um acerto registrado"), não como erro genérico
- Desde a decisão de 2026-07-31 (web), `GET /safras/:id/despesas` já retorna `coberta_por_acerto` em cada item — o app deve usar esse campo pra desabilitar de antemão os botões de editar/excluir (com o mesmo texto explicativo), em vez de deixar o produtor tentar e só descobrir pelo 409 depois do clique

## Contrato de API

Nenhuma mudança — reaproveita o contrato já em produção (pós-spec `13`):

```
POST /safras/:id/despesas
  body: { socio_id, tipo, valor, data, foto_comprovante?, descricao?, rateio?: [{ socio_id, percentual }] }
  → 201 { despesa: { ..., rateio: [{ socio_id, socio_nome, percentual }] | null } }
  → 422 se rateio não fecha 100% ou socio_id fora da sociedade | 403

GET /safras/:id/despesas
  → 200 { despesas: [{ ..., rateio, coberta_por_acerto }] } | 403

PUT /safras/:id/despesas/:despesaId
  body aceita rateio?: [...] | null (null remove rateio customizado, omitido não mexe)
  → 200 { despesa } | 409 se coberta por Acerto

DELETE /safras/:id/despesas/:despesaId
  → 204 | 409 se coberta por Acerto
```

## Critérios de aceite

1. Dado internet disponível, criar despesa salva no backend e aparece na lista com os dados retornados
2. Dado o app sem internet, criar despesa aparece imediatamente na lista com indicação de "pendente de sincronização", sem travar nem exigir ação do produtor
3. Ao a conexão voltar, uma despesa pendente é enviada automaticamente e a indicação de pendente desaparece
4. Dado um item que falha ao sincronizar, só ele fica marcado com erro — os demais itens pendentes da fila continuam tentando normalmente
5. Escolher "Personalizado" no rateio e não fechar 100% bloqueia o salvar (mesmo offline), com mensagem de erro antes de qualquer tentativa de envio
6. Uma despesa com rateio customizado mostra o badge na listagem; uma despesa padrão não mostra nada extra
7. Uma foto tirada pela câmera é salva junto da despesa mesmo offline, e chega ao servidor junto quando a sincronização ocorre
8. Tentar editar ou excluir uma despesa já coberta por um Acerto mostra o erro tratado (409), sem crash
9. Editar ou excluir uma despesa ainda pendente de sincronização atualiza só o item local, sem tentar uma chamada ao servidor
10. Dado que a lista de sócios nunca foi carregada (nenhuma conexão desde a instalação), a tela de nova despesa avisa que é preciso conectar à internet antes de lançar despesas
11. `GET /safras/:id/despesas` mostra despesas de todos os sócios (transparência total), com cache local permitindo visualizar a lista offline
12. Existe teste unitário garantindo que o item da fila de sincronização de despesa carrega tudo que o backend exige (`socio_id`, `tipo`, `valor`, `data`, `rateio`, foto em base64) e transiciona corretamente entre `pendente` → `sincronizado` / `erro`

## Decisões registradas durante a implementação

*(preencher durante a implementação, seguindo o mesmo padrão das specs `01` a `13` — decisões não previstas aqui entram nesta seção, não são resolvidas silenciosamente)*
