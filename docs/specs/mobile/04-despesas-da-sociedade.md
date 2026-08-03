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

- **Criar/editar/excluir sempre passam pela fila local, mesmo online**: em vez de dois caminhos de código (chamada direta quando há internet, fila quando não há), toda escrita grava primeiro no cache otimista (`despesasCache.ts`) e enfileira na `sync_queue` (`despesasQueue.ts`); em seguida chama `sincronizarTudo()` imediatamente, na hora. Online, isso sincroniza na mesma interação (sem esperar o gatilho de reconexão do `syncTrigger.ts`, que só dispara na transição offline→online); offline, a chamada falha silenciosamente e o item fica pendente. Um único caminho de código cobre os dois casos.
- **Edição/exclusão de um item ainda `pendenteOperacao: 'criar'`** (nunca sincronizado) usa a nova função genérica `atualizarPayload` (`syncQueue.ts`) pra reescrever o payload ainda não enviado, e `removerItem` pra cancelar — sem nenhuma chamada de rede, exatamente como pede o critério de aceite 9. `atualizarPayload` foi adicionado ao mecanismo genérico da spec `00` (não só desta spec) porque a mesma necessidade vai se repetir em Vendas.
- **Exclusão de uma despesa já sincronizada é otimista e simplificada**: a linha some do cache local (e da lista) assim que o produtor confirma, antes mesmo da fila tentar excluir no servidor. Se a exclusão falhar (ex: 409 por corrida rara com um Acerto registrado por outro sócio nesse meio-tempo), o item da fila fica marcado `erro` mas não reaparece na lista — diferente de criar/editar, que mostram o badge de erro. Ficou fora do escopo tratar esse caso raro (edição concorrente de dois sócios) com mais robustez agora; revisitar se aparecer na prática.
- **`expo-image-picker` adicionado como nova dependência** para abrir a câmera nativa (`launchCameraAsync`) — React Native não tem equivalente do `<input type="file" capture="environment">` do navegador. Usado com `base64: true` pra manter o mesmo formato que o backend já aceita (string `data:image/jpeg;base64,...`), sem precisar de um passo de upload/storage separado.
- **Sem seletor de data nativo (calendário)**: a tela web usa `DatePickerField`, que não tem equivalente pronto no mobile ainda (nenhuma spec anterior introduziu um). Pra não adicionar uma dependência nova só por causa disso, "Outra data" mostra um campo de texto com máscara `DD/MM/AAAA` validada no cliente. Mesma regra de negócio (hoje por padrão, outra data opcional), widget mais simples — revisitar com um date picker de verdade se a digitação manual incomodar na prática.
- **Filtro de período não entra nesta tela**: a `DespesasScreen` sempre lista o histórico inteiro da safra (`periodo: 'safra'`). O toggle dia/semana/mês do web (`PeriodToggle`) pertence ao painel de simulação, fora do escopo desta spec — sem isso, listar tudo é o comportamento mais simples e correto por padrão.
- **Sugestões de regra recorrente (`por_venda`/`por_periodo`) não aparecem nesta tela**: fazem parte da spec `06` mobile (Vendas e Regra de Despesa Recorrente), fora do escopo declarado desta spec.
- **Validado sem simulador/dispositivo físico**, mesma limitação registrada na spec `00`: a suíte de testes (`npm test`, cobrindo o critério de aceite 12) e `npx expo export --platform ios` (bundling completo, sem erro) confirmam que o código compila e a lógica de fila funciona; os critérios que dependem de interação real (tirar foto, navegar entre telas, ver o banner de pendência) ainda precisam ser conferidos rodando o app de verdade.
