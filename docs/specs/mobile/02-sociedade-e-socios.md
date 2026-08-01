# Mobile 02 — Sociedade e sócios

## Objetivo

Levar pro app mobile o onboarding de Sociedade já validado no app web (spec `02-sociedade-e-socios.md`, incluindo o incremento de sócio sem conta): criar sociedade, entrar por código de 6 dígitos, definir percentuais de lucro, e gerenciar sócios. **Nenhum endpoint novo** — reaproveita 100% do contrato de API já existente e testado em produção.

Também define a primeira regra concreta de "o que entra na fila offline e o que não entra" (ver `CLAUDE.md`, seção de offline-first) — nem toda escrita do app deveria ser enfileirada.

## Escopo

**Entra:**
- Tela "Minhas sociedades" (hub pós-login, equivalente à `HomePage` do web): lista as sociedades do usuário; estado vazio com CTA "Criar sociedade" / "Entrar com código" quando não participa de nenhuma
- Criar sociedade (nome) — `POST /sociedades`
- Entrar por código de 6 dígitos — `GET /sociedades/convite/:codigo` (preview) + `POST /sociedades/entrar`, incluindo a pergunta "é algum desses sócios?" quando o convite tem sócios sem conta
- Tela de sócios de uma sociedade: listar (`GET /sociedades/:id/socios`), editar percentuais de todos de uma vez (`PUT .../percentuais`), adicionar sócio sem conta (`POST /sociedades/:id/socios`)
- Cache local (leitura) de sociedades e sócios já carregados, seguindo o padrão offline-first geral (spec `00`): tela mostra dados salvos mesmo sem internet, com aviso de "sem conexão" ao tentar atualizar

**Fica de fora:**
- Safra — spec `03` (a partir daqui a numeração das specs de negócio muda: Safra `03`, Despesas/Vendas `04`, Painel/Acerto `05`, Despesa Pessoal `06`)
- Remover sócio, editar nome da sociedade depois de criada — mesmas lacunas já registradas na spec web, não é escopo aqui também
- Qualquer permissão granular por papel (financiador/meeiro têm a mesma visão, conforme `CLAUDE.md`)

## Regras de negócio

### Nem toda escrita é offline — primeira regra concreta
A spec `00` estabeleceu o mecanismo genérico de fila de sincronização, mas não disse quando usá-lo. Esta spec fixa o critério, que vale para as specs seguintes também:

- **Entram na fila offline** (salvam local e sincronizam depois): operações de **alto volume e uso em campo**, tipicamente lançamentos que o produtor faz várias vezes ao dia sem conexão — é o caso de despesas e vendas (specs `04`/`05`), não desta spec
- **Exigem conexão no momento da ação** (sem fila, mostra erro claro se offline): operações de sociedade — criar sociedade, entrar por código, editar percentuais, adicionar sócio. Motivo: são ações **raras** (acontecem uma vez ou poucas vezes por sociedade, não todo dia) e dependem de **validação imediata do servidor** que não pode ser resolvida localmente (código de convite existe? soma dos percentuais fecha 100% considerando sócios que só o servidor conhece?) — enfileirar essas ações criaria a possibilidade de descobrir um erro (ex: código inválido) só quando a sincronização já rodou, minutos ou horas depois, o que é pior experiência do que simplesmente pedir pra tentar com internet
- Essa distinção deve ser reavaliada spec a spec — o critério é "uso em campo + tolera confirmação tardia" vs. "raro + precisa de resposta imediata do servidor", não uma lista fixa

### Criar / entrar / percentuais / sócio sem conta
- Mesmas regras já implementadas no backend (spec `02` web): sem duplicar validação de negócio nova no app — o mobile só replica mensagens de erro e UX, a validação de verdade (soma 100%, código existente, sócio já vinculado) continua sendo o backend
- Fluxo de "entrar por código" segue exatamente o preview + vínculo já existente: `GET /sociedades/convite/:codigo` retorna `socios_sem_conta`; se a lista não estiver vazia, a tela pergunta "é algum desses sócios?" antes de confirmar

### Sociedade ativa no app
- Quando o usuário participa de mais de uma sociedade, a navegação precisa saber qual está selecionada — um `SociedadeContext` (React Context), equivalente ao `SafraContext` já existente no frontend web, guarda a sociedade selecionada e é consumido pelas telas seguintes (sócios, e depois safra/despesas/vendas)

## Contrato de API

Nenhuma mudança — reaproveita integralmente o contrato já em produção:

```
POST /sociedades                              { nome } → 201 { sociedade, socio }
GET  /sociedades                              → 200 { sociedades: [...] }
GET  /sociedades/convite/:codigo_convite      → 200 { sociedade, socios_sem_conta } | 404
POST /sociedades/entrar                       { codigo_convite, vincular_socio_id? } → 200 { sociedade } | 404 | 409
GET  /sociedades/:id/socios                   → 200 { socios: [...] } | 403
POST /sociedades/:id/socios                   { nome, papel } → 201 { socio } | 400 | 403
PUT  /sociedades/:id/socios/percentuais       { socios: [{ id, percentual_lucro, papel }] } → 200 { socios } | 422 | 403
```

## Critérios de aceite

1. Dado um usuário sem nenhuma sociedade, a tela "Minhas sociedades" mostra o estado vazio com as duas opções (criar / entrar por código)
2. Dado um nome válido, criar sociedade retorna sucesso e o usuário aparece como sócio com 100%
3. Dado um código de convite válido sem sócios sem conta, entrar direto cria o vínculo do usuário
4. Dado um código de convite com sócios sem conta cadastrados, a tela pergunta "é algum desses sócios?" antes de confirmar, e vincular a um deles preserva percentual/papel/histórico já existentes (mesmo `id` de sócio)
5. Dado um código inexistente, a tela mostra erro tratado (404), sem crash
6. Dado uma sociedade com 2+ sócios, editar percentuais com soma 100% salva com sucesso; com soma diferente de 100%, mostra o erro 422 do backend sem alterar nada localmente
7. Dado o financiador de uma sociedade, adicionar um sócio sem conta (nome + papel) funciona e o novo sócio aparece na lista com 0%
8. Dado sociedades/sócios já carregados uma vez, abrir o app sem internet mostra os dados salvos localmente, com aviso de "sem conexão" ao tentar atualizar — sem tela em branco
9. Dado o app sem internet, tentar criar sociedade, entrar por código, editar percentuais ou adicionar sócio mostra mensagem clara de que a ação exige conexão — **não** enfileira a ação
10. Existe teste unitário validando que a tentativa de escrita nesta spec, quando offline, não gera nenhum item na fila de sincronização genérica (spec `00`) — reforça a regra "nem toda escrita é offline"

## Decisões registradas durante a implementação

*(preencher durante a implementação, seguindo o mesmo padrão das specs `01` a `13` — decisões não previstas aqui entram nesta seção, não são resolvidas silenciosamente)*
