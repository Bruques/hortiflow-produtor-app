# Mobile 07 — Despesa pessoal

> **Status: adiada para pós-MVP mobile** (decisão do dev, 2026-08-03). Fica de fora da ordem `00`-`08` do roadmap inicial — ver `docs/backlog.md`. Spec continua aprovada e pronta pra implementar quando for retomada; nada no conteúdo abaixo muda por causa do adiamento.

## Objetivo

Levar pro app mobile o controle de despesas pessoais: cada sócio registra, dentro da safra ativa, gastos que não têm nenhuma relação com a conta da sociedade — sempre privados, nunca visíveis a outros sócios, nunca somados em `calcularDivisao` nem em nenhum Acerto (mesma garantia que o `CLAUDE.md` já dá pra `DespesaPessoal`). Fecha o roadmap inicial do MVP mobile (specs `00` a `07`). Reaproveita 100% do contrato já em produção.

## Escopo

**Entra:**
- Criar despesa pessoal (`tipo`, `valor`, `data`, `descricao?`) — `POST /safras/:id/despesas-pessoais`
- Listar só as próprias despesas pessoais na safra ativa — `GET /safras/:id/despesas-pessoais`
- Editar e excluir, só pelo dono — `PUT`/`DELETE /despesas-pessoais/:id`
- Fila de sincronização offline (mesmo mecanismo genérico da spec `00`), já que lançar despesa pessoal também é uma ação de campo, de uso frequente

**Fica de fora:**
- Rateio — não existe no conceito de despesa pessoal (é sempre 100% de quem lançou, não é dividida com ninguém)
- Foto de comprovante — o backend nunca teve esse campo em `DespesaPessoal` (diferente de `Despesa` da sociedade), não é escopo introduzir agora

## Regras de negócio

### Isolamento (reforça a regra do CLAUDE.md)
- Toda despesa pessoal é criada com o usuário autenticado como dono — nunca existe campo pra lançar em nome de outro sócio (diferente da Despesa da sociedade, spec `04`, onde qualquer sócio pode lançar em nome de outro)
- Nunca aparece em nenhuma tela ou fila que envolva outros sócios (Despesas da sociedade, Painel, Acerto) — telas e cache local são completamente separados
- Edição/exclusão restrita ao dono é garantida pelo backend (`403` se forçado), mas no app a tela de listagem nunca mostra despesa de outro usuário pra começo de conversa — não há cenário de tentar editar a de outro

### Offline, sem a dependência de cache que a Despesa da sociedade tem
- Mesmo critério de alto volume/uso em campo da spec `04`: criar/editar/excluir despesa pessoal funciona sem internet, enfileira e sincroniza sozinho quando a conexão volta
- **Diferente da spec `04`**: não depende de lista de sócios em cache (é sempre o próprio usuário autenticado) — pode ser lançada offline mesmo no primeiro uso do app, desde que o login já tenha acontecido uma vez (spec `01`, que já garante sessão persistente)
- Editar/excluir um item ainda pendente de sincronização (nunca chegou ao servidor) atualiza só localmente, mesmo padrão da spec `04`

## Contrato de API

Nenhuma mudança — reaproveita integralmente:

```
POST   /safras/:id/despesas-pessoais         { tipo, valor, data, descricao? } → 201 { despesaPessoal } | 403
GET    /safras/:id/despesas-pessoais         → 200 { despesasPessoais: [...] } (só do usuário autenticado) | 403
PUT    /despesas-pessoais/:id                { tipo?, valor?, data?, descricao? } → 200 { despesaPessoal } | 403 (não é o dono)
DELETE /despesas-pessoais/:id                → 204 | 403 (não é o dono)
```

## Critérios de aceite

1. Dado internet disponível, criar uma despesa pessoal salva no backend e aparece na lista do próprio usuário
2. Dado o app sem internet, criar uma despesa pessoal aparece imediatamente como "pendente", sincronizando sozinha ao reconectar — sem exigir que a lista de sócios esteja em cache (diferente da spec `04`)
3. Dado dois sócios A e B na mesma safra, a listagem de despesas pessoais de A nunca mostra nada lançado por B, mesmo offline com dados de ambos eventualmente sincronizados no dispositivo (o que não deveria nem acontecer, já que o backend só retorna as do usuário autenticado)
4. Editar ou excluir uma despesa pessoal ainda pendente de sincronização atualiza só o item local, sem tentar chamar o servidor
5. Nenhuma despesa pessoal aparece nas telas de Despesas da sociedade, Painel de simulação ou Acerto (specs `04`/`05`)
6. Existe teste unitário garantindo que o item de despesa pessoal na fila de sincronização nunca inclui `socio_id` de outro usuário nem qualquer campo de rateio

## Decisões registradas durante a implementação

*(preencher durante a implementação, seguindo o mesmo padrão das specs `01` a `13` — decisões não previstas aqui entram nesta seção, não são resolvidas silenciosamente)*
