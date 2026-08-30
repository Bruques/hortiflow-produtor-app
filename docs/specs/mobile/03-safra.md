# Mobile 03 — Safra

## Objetivo

Levar pro app mobile a gestão de Safra dentro de uma Sociedade: abrir, encerrar, listar e editar observações — reaproveitando os endpoints já validados nas specs `03-safra-despesas-e-despesa-pessoal.md` e `10-observacoes-da-safra.md` do web. Também estabelece o **contexto de safra ativa**, que as specs seguintes (Despesas/Vendas, Painel/Acerto, Despesa Pessoal) vão consumir.

## Escopo

**Entra:**
- Abrir Safra numa Sociedade (nome + observações opcional) — `POST /sociedades/:id/safras`
- Listar Safras de uma Sociedade — `GET /sociedades/:id/safras`
- Encerrar Safra — `PATCH /safras/:id/encerrar`
- Editar observações, a qualquer momento incluindo safra encerrada — `PATCH /safras/:id/observacoes`
- Editar o nome, mesmas condições — `PATCH /safras/:id/nome` (adicionado depois, ver [spec 22](../22-editar-nome-da-safra.md))
- `SafraContext` (React Context), equivalente ao `SafraContext.tsx` do frontend web: guarda a safra selecionada (`safraId`, `sociedadeId`, `safra`) e é consumido pelas telas de despesas, vendas, painel e acerto nas specs seguintes
- Cache local (leitura) das safras já carregadas, seguindo o padrão offline-first geral (spec `00`)

**Fica de fora:**
- Despesas, Despesas Pessoais, Vendas — specs `04`/`06`
- Painel de simulação e Acerto — spec `05`
- Múltiplas Safras `EM_ANDAMENTO` simultâneas na mesma Sociedade — mesma lacuna já registrada no web, não é escopo aqui resolver

## Regras de negócio

### Abrir / encerrar / observações exigem conexão
Seguindo o critério fixado na spec `02`: são ações pouco frequentes (uma vez por safra, ou esporádicas no caso de observações) que dependem de confirmação imediata do servidor — `encerrar` retorna `409` se a safra já estiver encerrada, um estado que só o servidor sabe com certeza no momento da ação. Por isso **não entram na fila de sincronização offline**; se o app estiver sem internet, mostra mensagem clara pedindo conexão, sem enfileirar.

### Listagem com cache offline
- Toda tela que lista safras (por sociedade) mostra os dados salvos localmente primeiro, mesmo sem internet, com aviso de "sem conexão" ao tentar atualizar — mesmo padrão já estabelecido nas specs `00`/`02`
- Uma safra `ENCERRADA` sincronizada localmente continua visível offline (histórico), mesmo que o dispositivo não tenha buscado atualização recente

### Observações
- Texto livre, opcional, sem estrutura (mesmo teto de tamanho do backend, ~500 caracteres)
- Editável por qualquer sócio, independente do status da safra (`PLANEJADA`, `EM_ANDAMENTO`, `ENCERRADA`) — não é dado financeiro travado por Acerto

### Contexto de safra ativa
- Ao entrar numa Sociedade (spec `02`) e escolher uma Safra, o `SafraContext` guarda a seleção pro resto da navegação daquela sessão de uso do app — evita repassar `safraId`/`sociedadeId` manualmente em cada tela seguinte

## Contrato de API

Nenhuma mudança — reaproveita integralmente o que já está em produção:

```
POST  /sociedades/:id/safras           { nome, observacoes? } → 201 { safra } | 403
GET   /sociedades/:id/safras           → 200 { safras: [...] } | 403
PATCH /safras/:id/encerrar             → 200 { safra } | 403 | 409 (já encerrada)
PATCH /safras/:id/observacoes          { observacoes: string | null } → 200 { safra } | 400 | 403 | 404
```

## Critérios de aceite

1. Dado um sócio de uma Sociedade, abrir uma Safra com nome (e opcionalmente observações) cria a safra com status `EM_ANDAMENTO`
2. Dado um usuário que não é sócio, a tentativa de abrir/listar/encerrar/editar observações retorna erro tratado (403), sem crash
3. A tela "Safras" lista as safras da sociedade selecionada, com observação truncada exibida no card quando preenchida
4. Encerrar uma safra muda seu status para `ENCERRADA`; tentar encerrar de novo mostra o erro do backend (409) sem travar o app
5. Editar observações de uma safra já `ENCERRADA` funciona normalmente
6. Dado safras já carregadas uma vez, abrir o app sem internet mostra a lista salva localmente (incluindo safras encerradas), com aviso de "sem conexão" ao tentar atualizar
7. Dado o app sem internet, tentar abrir/encerrar safra ou editar observações mostra mensagem clara de que a ação exige conexão — não enfileira a ação
8. Selecionar uma safra propaga `safraId`/`sociedadeId` via `SafraContext` pras telas subsequentes (validado nesta spec com uma tela placeholder que só exibe o que o contexto expõe — as telas reais vêm nas specs seguintes)

## Decisões registradas durante a implementação

- **Resolvida a divergência registrada na spec `02`**: esta spec substitui de vez o hub "Minhas sociedades" (provisório, spec `02`) pela tela de Início real do mobile — `InicioScreen`, equivalente à `HomePage` do web: 0 safras → formulário único que já cria sociedade+safra juntas (`criarSociedadeRequest` + `abrirSafraRequest` em sequência); 1 safra → entra direto nela; 2+ → lista pra escolher. O card de resumo consolidado (múltiplas safras ativas) do web **não** foi replicado aqui — depende do painel de simulação (spec `05`, ainda não implementada); fica como lacuna registrada, não como decisão de produto.
- **`SociosScreen` (spec `02`) passou a receber `sociedadeId` por parâmetro de rota**, não mais por Context — o `SociedadeContext` foi removido (ver decisão espelhada na spec `02`).
- **Sem Menu ainda (é a spec `08`)**: os atalhos que no web moram no `MenuPage` (Sócios e Sociedade, Todas as safras, Conta e Senha, Sair) foram colocados temporariamente na tela placeholder "dentro da safra" (`SafraScreen`). Isso é reconhecidamente provisório e deve ser revisitado quando a spec `08` implementar a navegação/Menu de verdade.
- **`SafraScreen` é deliberadamente um placeholder mínimo**, exatamente como a spec pede (critério de aceite 8) — mostra nome/status/observações da safra ativa e os links acima, mas nenhum dado de Resumo/Despesas/Vendas (specs `04`/`05`/`06`).
- **Tela "Safras" (listar/encerrar/editar observações de uma sociedade) e "Nova safra" implementadas seguindo 1:1 o comportamento das páginas equivalentes do web** (`SafrasPage`/`NovaSafraPage`), incluindo o aviso de "já existe uma safra em andamento" ao tentar abrir outra.
- **Cache local de safras com a mesma estratégia "substitui tudo"** de `sociedadesCache.ts` (spec `02`) — duas tabelas novas (`minhas_safras_cache` para a lista cross-sociedade da tela de Início, `safras_cache` por sociedade para a tela "Safras").
- **Teste do critério de aceite 7** (abrir/encerrar safra e editar observações offline não caem na fila) implementado no mesmo molde do teste equivalente da spec `02`: mocka `apiClient` pra rejeitar com erro de rede e verifica que `enfileirar` nunca é chamado.
