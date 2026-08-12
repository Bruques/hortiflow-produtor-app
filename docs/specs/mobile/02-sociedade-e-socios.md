# Mobile 02 — Sociedade e sócios

## Objetivo

Levar pro app mobile o onboarding de Sociedade já validado no app web (spec `02-sociedade-e-socios.md`, incluindo o incremento de sócio sem conta): criar sociedade, entrar por código de 6 dígitos, definir percentuais de lucro, e gerenciar sócios. **Nenhum endpoint novo** — reaproveita 100% do contrato de API já existente e testado em produção.

Também define a primeira regra concreta de "o que entra na fila offline e o que não entra" (ver `CLAUDE.md`, seção de offline-first) — nem toda escrita do app deveria ser enfileirada.

> **Nota de 2026-08-02, registrada durante a implementação**: esta spec foi escrita espelhando a spec `02` **original** do web (sociedade como hub pós-login). O web evoluiu desde então — hoje a `HomePage` é centrada em **Safra**, não em Sociedade (0 safras → formulário que já cria sociedade+safra juntas; 1 safra → entra direto nela; 2+ → lista de safras), e a tela de sócios/percentuais só é alcançada de dentro de uma safra, via `MenuPage` (card "Sócios e Sociedade"). O mobile ainda não tem Safra (é a spec `03`), então esta spec constrói deliberadamente um hub "Minhas sociedades" **provisório**, só para o app ter algum caminho de onboarding e uma tela pra abrigar a gestão de sócios até a `03` chegar. Quando a `03` for implementada, essa tela vira o novo pós-login "de verdade" (lista de safras) e a atual `SociedadesScreen` deixa de ser a tela inicial — a spec `03` deve tratar essa substituição explicitamente, não como decisão nova e não documentada.

## Escopo

**Entra:**
- Tela "Minhas sociedades" (hub pós-login **provisório** — ver nota acima; não é o design alvo, é o que existe até a spec `03` trazer a Home centrada em safra): lista as sociedades do usuário; estado vazio com CTA "Criar sociedade" / "Entrar com código" quando não participa de nenhuma
- Criar sociedade (nome) — `POST /sociedades`. **Diferença deliberada do web atual**: hoje o web só cria sociedade em conjunto com a primeira safra (`HomePage`); aqui criar sociedade sozinha (sem safra) é uma simplificação aceita para esta spec, já que Safra ainda não existe no mobile — não é o fluxo final
- Entrar por código de 6 dígitos — `GET /sociedades/convite/:codigo` (preview) + `POST /sociedades/entrar`, incluindo a pergunta "é algum desses sócios?" quando o convite tem sócios sem conta
- Tela de sócios de uma sociedade: listar (`GET /sociedades/:id/socios`), editar percentuais de todos de uma vez (`PUT .../percentuais`), adicionar sócio sem conta (`POST /sociedades/:id/socios`) — mesmo conteúdo do card "Sócios e Sociedade" do `MenuPage` web atual, só que alcançado direto da lista de sociedades (mobile ainda não tem Menu — é a spec `08`)
- Cache local (leitura) de sociedades e sócios já carregados, seguindo o padrão offline-first geral (spec `00`): tela mostra dados salvos mesmo sem internet, com aviso de "sem conexão" ao tentar atualizar

**Fica de fora:**
- Safra — spec `03` (a partir daqui a numeração das specs de negócio muda: Safra `03`, Despesas/Vendas `04`, Painel/Acerto `05`, Despesa Pessoal `06`). Isso inclui a Home "de verdade" (centrada em safra) e o fluxo de criar sociedade+safra juntas — ficam para a `03`
- Editar nome da sociedade depois de criada
- Qualquer permissão granular por papel (financiador/meeiro têm a mesma visão, conforme `CLAUDE.md`)

> **Atualização (2026-08-11)**: editar nome de sócio sem conta e remover sócio deixaram de ser lacuna — ver incremento "editar nome e remover sócio" na spec web `02-sociedade-e-socios.md`. `PATCH`/`DELETE /sociedades/:id/socios/:socioId` foram levados para `SociosScreen` junto com o web, seguindo a mesma regra desta spec de "exige conexão no momento, sem fila offline" (são ações raras que dependem de validação do servidor — ver abaixo).

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

- **"Minhas sociedades" substitui a Home placeholder das specs 00/01**: não existe mais uma tela "Home" genérica — `SociedadesScreen` passa a ser a tela inicial pós-login. Os atalhos "Trocar senha"/"Sair" (antes na Home de teste) viraram links no rodapé dessa tela, já que ainda não existe nenhum outro lugar (Menu/Configurações) pra eles morarem — isso deve mudar quando a spec `08` (navegação/Resumo/Menu) chegar.
- **Cache local de sociedades/sócios com estratégia "substitui tudo"** (`src/lib/sociedadesCache.ts`, tabelas `sociedades_cache`/`socios_cache` novas em `database.ts`): a cada fetch bem-sucedido, apaga e reinsere a lista inteira, em vez de diff linha a linha. Simples o suficiente pro volume dessas listas (poucas sociedades/sócios por conta) e resolve o critério de aceite 8 (mostrar dados salvos ao abrir offline) sem esperar uma spec futura de sincronização mais sofisticada.
- **`SociedadeContext` guarda só `{ id, nome, codigo_convite }`** (não o objeto `Sociedade` completo, que também tem `percentual_lucro`/`papel` do usuário logado) — é só o suficiente pra tela de Sócios operar; o percentual/papel do usuário atual já vem dentro da lista de sócios carregada por `listarSociosRequest`, não precisa duplicar.
- **Ao entrar por código, a sociedade selecionada no contexto vem de um `listarSociedadesRequest()` logo após `entrarSociedadeRequest`** (que só devolve `{ id, nome }`, sem `codigo_convite`) — mesmo padrão que o `HomePage` do web usa (recarrega a lista após a ação), necessário aqui porque a tela de Sócios mostra o código de convite pra qualquer sócio, não só pra quem criou.
- **Mensagens de erro das ações de sociedade centralizadas em `src/lib/erroApi.ts`** (`mensagemErro`): distingue erro de rede (sem `response`, ação exige conexão — critério de aceite 9) de erro de validação do backend (usa a mensagem vinda de `response.data.error`, ex: 422 de percentuais). Reaproveitada pelas 4 telas de escrita desta spec.
- **Teste do critério de aceite 10** (nenhuma escrita desta spec cai na fila offline) implementado mockando `apiClient` pra rejeitar com erro de rede e verificando que `enfileirar` (da fila genérica da spec `00`) nunca é chamado — mais direto que testar através da UI, e prova estruturalmente que `services/sociedades.ts` nunca importa a fila.
- **Divergência do fluxo web atual identificada e registrada (2026-08-02)**: o dev notou que a spec (e a implementação) seguiam o modelo antigo de hub por Sociedade, enquanto o web hoje é centrado em Safra (`HomePage` lista safras, "Sócios e Sociedade" só é alcançado de dentro de uma safra via `MenuPage`). Ver nota no topo do arquivo.
- **Atualização (2026-08-02, durante a implementação da spec `03`)**: a substituição do hub foi feita imediatamente (não ficou pra depois). `SociedadesScreen` e `CriarSociedadeScreen` foram **removidas** (a criação de sociedade sozinha não existe mais — passou a acontecer só em conjunto com a primeira safra, na tela de Início da spec `03`, igual ao web). `SociedadeContext` também foi removido: `SociosScreen` passou a receber `sociedadeId` por parâmetro de rota e buscar nome/código de convite via `listarSociedadesRequest` sob demanda, mesmo padrão do `ConfiguracoesSociosPage` do web — em vez de guardar esses dados num Context próprio. `EntrarSociedadeScreen` e `criarSociedadeRequest`/`entrarSociedadeRequest`/`atualizarPercentuaisRequest`/`criarSocioRequest` (services) continuam exatamente como implementados aqui, só trocando quem os chama.
