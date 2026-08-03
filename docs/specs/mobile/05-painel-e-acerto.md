# Mobile 05 — Painel de simulação e Acerto

## Objetivo

Levar pro app mobile o coração da proposta de valor do produto: a visão em tempo real de "quanto cada sócio tem a receber" (painel de simulação, spec `05-calculo-e-painel-simulacao.md` do web) e o registro formal de que os sócios se acertaram (Acerto, spec `06-acerto.md` do web). Reaproveita 100% dos endpoints já existentes — nenhuma mudança de backend, e **nenhuma reimplementação da fórmula de divisão no cliente** (ver "Regras de negócio").

Esta spec não é afetada pela mudança de rateio de despesas em andamento em paralelo (`docs/specs/13-rateio-de-despesas.md`): essa spec declara explicitamente que os contratos de `GET /safras/:id/simulacao`, `POST /safras/:id/acertos` e `GET /acertos/:id` não mudam — a mudança fica isolada dentro de `calcularDivisao`.

## Escopo

**Entra:**
- Tela de painel (dentro da safra ativa, via `SafraContext` da spec `03`) com seletor de período (dia/semana/mês/safra inteira, ou intervalo personalizado) mostrando receita, despesas, lucro líquido e a divisão por sócio (nome, percentual, valor) — `GET /safras/:id/simulacao`
- Criar um Acerto (`PARCIAL` ou `FINAL`) para um intervalo de datas — `POST /safras/:id/acertos`
- Histórico de Acertos da safra — `GET /safras/:id/acertos`
- Extrato detalhado de um Acerto — `GET /acertos/:id`
- Cache local do **último resultado já recebido do servidor** (painel e histórico de acertos), pra exibir offline com indicação de quando foi atualizado pela última vez

**Fica de fora:**
- Resumo consolidado entre safras (spec `11-resumo-consolidado-e-despesa-compartilhada.md` do web) — no web esse card ainda é considerado provisório (local da tela pode mudar); trazer pro mobile fica pra um incremento futuro, depois de estabilizado no web
- Reembolso de quem bancou despesas antes de dividir o restante (pergunta em aberto do `CLAUDE.md`, não implementada nem no web)
- Exportar o extrato em PDF (Fase 2)
- Editar ou excluir um Acerto já criado (é snapshot imutável, mesma regra do web)
- Reabrir uma Safra `ENCERRADA`

## Regras de negócio

### Sem cálculo local — reforça a regra crítica de arquitetura do CLAUDE.md
O `CLAUDE.md` estabelece que **todo o cálculo de divisão vive em um único service** (`calcularDivisao`, no backend), justamente pra que trocar a fórmula seja mudança em um arquivo só. Duplicar essa lógica no app mobile (por exemplo, pra funcionar 100% offline) quebraria essa garantia: a fórmula ficaria em dois lugares, e uma mudança futura (como a que está em andamento na spec `13`) exigiria lembrar de atualizar o mobile também.

Por isso:
- O painel de simulação e o extrato de Acerto **são sempre o resultado devolvido pela API**, nunca recalculados no app
- Nenhum arquivo do app mobile reimplementa soma de despesas/vendas ou aplicação de percentual — isso é verificado em code review, não é um critério de teste automatizado

### Painel de simulação: leitura com cache, sem cálculo offline
- Com conexão: busca `GET /safras/:id/simulacao` normalmente a cada troca de período
- Sem conexão: mostra o **último resultado já recebido**, com indicação clara de quando foi ("Atualizado às 14:32 — sem conexão para recalcular"), em vez de travar ou mostrar tela em branco
- Trocar de período sem conexão, se aquele período específico nunca foi carregado antes, mostra que não há dado salvo pra aquele filtro (não inventa um número)

### Criar Acerto exige conexão
- Mesmo critério já fixado nas specs `02`/`03`: é uma ação rara que depende de validação imediata do servidor (sobreposição de período com o Acerto anterior, status da safra `EM_ANDAMENTO`) — **não entra na fila de sincronização offline**
- Sem conexão, a tela de criar Acerto mostra mensagem clara pedindo internet, sem permitir tentar salvar localmente

### Visão igual para financiador e meeiro
- Mesma regra de sempre: nenhuma tela ou dado desta spec é diferente por papel do sócio

## Contrato de API

Nenhuma mudança — reaproveita integralmente:

```
GET  /safras/:id/simulacao?periodo=dia|semana|mes|safra
GET  /safras/:id/simulacao?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
  → 200 { periodo, receita, despesas, lucroLiquido, divisao: [{ socio_id, nome, percentual, valor }] }
  → 400 sem filtro de período | 403 se não for sócio

POST /safras/:id/acertos
  body: { data_inicio, data_fim, tipo: "PARCIAL" | "FINAL" }
  → 201 { id, safra_id, data_inicio, data_fim, tipo, criado_em, receita, despesas, lucroLiquido, socios: [...] }
  → 400 (datas inválidas, sobreposição, safra não EM_ANDAMENTO) | 403

GET  /safras/:id/acertos
  → 200 [{ id, data_inicio, data_fim, tipo, criado_em }] | 403

GET  /acertos/:id
  → 200 { id, safra_id, data_inicio, data_fim, tipo, criado_em, receita, despesas, lucroLiquido, socios: [...] }
  → 403 | 404
```

## Critérios de aceite

1. Dado uma safra com despesas e vendas lançadas, o painel mostra receita, despesas, lucro líquido e a divisão por sócio para o período selecionado (dia/semana/mês/safra)
2. Trocar o seletor de período busca o resultado correspondente da API e atualiza a tela
3. Dado o painel já carregado uma vez para um período, abrir o app sem internet mostra esse último resultado com indicação de quando foi atualizado, sem tela em branco
4. Dado um período nunca carregado antes, sem internet, a tela indica que não há dado salvo pra aquele filtro (não mostra número inventado nem zero enganoso)
5. Dado uma safra `EM_ANDAMENTO`, criar um Acerto `PARCIAL` com um intervalo válido cria o Acerto e mostra o extrato com os mesmos valores do painel para aquele intervalo
6. Criar um Acerto `FINAL` muda o status da safra para `ENCERRADA` (refletido também na spec `03`)
7. Tentar criar um Acerto com datas sobrepostas ao último já criado mostra o erro 400 do backend, sem travar o app
8. Dado o app sem internet, a tela de criar Acerto pede conexão e não permite salvar localmente
9. O histórico de Acertos lista do mais recente pro mais antigo; abrir um Acerto do histórico mostra o extrato completo por sócio
10. Um sócio `MEEIRO` vê exatamente o mesmo painel e extrato de Acerto que um `FINANCIADOR` veria
11. Revisão de código confirma que nenhum arquivo do app mobile soma despesas/vendas ou aplica percentual manualmente — todo valor exibido vem direto da resposta da API

## Decisões registradas durante a implementação

- **Cache do painel é por combinação de safra+filtro, não por safra**: `simulacao_cache` guarda uma linha por chave `safraId:periodo:X` ou `safraId:custom:dataInicio:dataFim` (`mobile/src/lib/simulacaoCache.ts`). Sem isso, trocar de "Hoje" pra "Semana" offline mostraria o número errado (do filtro anterior) em vez de "sem dado salvo pra esse filtro" — exatamente o critério de aceite 4.
- **Timestamp do histórico de Acertos mora numa tabela própria (`acertos_cache_meta`), separada de `acertos_cache`**: se o "atualizado às" dependesse de alguma linha existir em `acertos_cache`, uma safra sem nenhum Acerto ainda (estado comum, logo após abrir a safra) perderia essa informação porque não haveria linha nenhuma pra carregar o timestamp. A tabela meta grava o timestamp mesmo quando a lista vem vazia do servidor.
- **Sem seletor de data nativo**, mesma decisão já registrada na spec `04`: os campos de data (painel personalizado, criação de Acerto) usam texto mascarado `DD/MM/AAAA`, com os conversores extraídos para `mobile/src/lib/data.ts` (`dataIsoParaExibicao`/`exibicaoParaDataIso`) para não duplicar a lógica que já existia (privada) em `NovaDespesaScreen.tsx`.
- **Seletor de período personalizado é um botão a mais dentro do próprio segmented control** (pill "Personalizado" ao lado de Hoje/Semana/Mês/Safra), em vez do padrão do web (`PeriodToggle` + `PeriodoPersonalizadoButton` como um botão de calendário separado que abre uma sheet). Mais simples de implementar sem um componente de bottom-sheet novo — os dois campos de data aparecem inline abaixo dos pills quando "Personalizado" é tocado.
- **Criar um Acerto `FINAL` atualiza o `SafraContext` na hora**, sem re-buscar a safra do servidor: `NovoAcertoScreen` chama `selecionarSafra({ ...safraAtiva, safra: { ...safra, status: 'ENCERRADA' } })` logo após o `201` de `POST /safras/:id/acertos`. Simples porque o único campo que muda é o status, e o backend já validou a transição — evita uma chamada de rede extra só pra confirmar algo que a resposta do POST já implica.
- **Botão "voltar" das telas novas usa sempre `navigation.goBack()`**, diferente do padrão do web (`AcertoDetalhePage.tsx` usa uma rota explícita porque um link direto/refresh no navegador pode não ter histórico). Não existe o equivalente de "abrir direto numa URL" no app mobile — toda navegação vem de dentro do próprio app, então o stack do React Navigation sempre tem de onde voltar.
- **`Simulacao`/tipos mobile não incluem `quantidadePorUnidade`**: esse campo existe no tipo do web mas nenhuma tela desta spec o exibe (é usado só no `ResumoPage.tsx`, fora de escopo aqui) — mantido fora do tipo copiado pra não sugerir um dado que a tela nunca usa.
- **Validado sem simulador/dispositivo físico**, mesma limitação registrada nas specs `00` e `04`: a suíte de testes (`npm test`, 13 suítes/52 testes) e `npx expo export --platform ios` (bundling completo, sem erro) confirmam que o código compila e a lógica de cache/fallback offline funciona; os critérios que dependem de interação real (trocar de período na tela, ver o aviso "Atualizado às..." aparecer/sumir ao alternar conexão, navegar entre Painel → Acertos → Novo Acerto → Extrato) ainda precisam ser conferidos rodando o app de verdade.
