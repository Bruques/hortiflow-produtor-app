# Mobile 11 — Despesa compartilhada entre safras

## Objetivo

Levar pro app mobile o lançamento de despesa compartilhada entre 2+ safras do usuário (docs/specs/11-resumo-consolidado-e-despesa-compartilhada.md), reaproveitando integralmente o contrato já em produção (`POST /despesas/compartilhada`). Fecha a última lacuna de paridade com o web identificada em 2026-09-05.

## Escopo

**Entra:**
- Tela "Despesa compartilhada": escolher 2+ safras próprias (`EM_ANDAMENTO`), tipo de despesa, valor total, data, descrição opcional, e o modo de rateio (igual ou percentual customizado)
- Card de resumo consolidado na tela de Início (`InicioScreen`), com o total estimado a receber somando todas as safras ativas, seletor de período e o link de acesso a esta tela — mesmo card do web (`HomePage.tsx`), reaproveitando `GET /safras/resumo` (já existia no backend, sem uso no mobile até então)

**Fica de fora:**
- Foto de comprovante — o web permite (`foto_comprovante` no contrato), mas não é critério de aceite aqui; pode entrar depois reaproveitando o componente de câmera já usado em `NovaDespesaScreen.tsx`
- Edição/exclusão em lote — cada despesa gerada é independente, editável/excluível normalmente pela tela de Despesas da safra correspondente (mesmo comportamento do web)

## Regras de negócio

### Exige conexão — não entra na fila de sincronização offline
Mesmo critério já usado pra abrir safra e editar sócios de uma safra (specs `03`/`23`): é uma ação pouco frequente que depende de validação imediata do servidor (soma de percentuais, safra ainda `EM_ANDAMENTO`, safra pertence ao usuário) — sem internet, mostra mensagem clara pedindo conexão, sem enfileirar.

### Demais regras
Idênticas às já documentadas na spec 11 do web — nenhuma decisão de negócio nova aqui, só a mesma tela levada pro mobile. Resumo: mínimo 2 safras (`EM_ANDAMENTO`, do próprio usuário), rateio "igual" (`valor_total / quantidade`, arredondamento absorvido pela primeira safra) ou "percentual customizado" (soma 100% ±0.01), gera uma `Despesa` normal por safra selecionada com o valor já rateado.

## Contrato de API

Nenhuma mudança — reaproveita integralmente:

```
POST /despesas/compartilhada
  auth obrigatório
  body: {
    safra_ids: string[],
    tipo: TipoDespesa,
    valor_total: number,
    data: string,
    descricao?: string,
    rateio: { modo: 'igual' } | { modo: 'percentual', percentuais: { safra_id: string, percentual: number }[] }
  }
  → 201 { despesas: [{ safra_id, despesa }] }
  → 422 se menos de 2 safras, safra não pertence ao usuário ou não está EM_ANDAMENTO, ou soma de percentual != 100%
```

## Critérios de aceite

1. Dado um usuário com 2+ safras ativas, a tela lista todas elas com nome da safra e da sociedade, selecionáveis
2. Escolher modo "igual" com 2 safras e valor R$300 gera duas despesas de R$150, uma em cada safra
3. Escolher modo "percentual" exige que a soma feche 100% antes de habilitar o botão de salvar
4. As despesas geradas aparecem normalmente na tela de Despesas de cada safra correspondente, editáveis/excluíveis independentemente
5. Sem internet, tentar lançar mostra mensagem clara de que a ação exige conexão — não enfileira nem finge sucesso
6. Usuário com menos de 2 safras ativas não vê o item de acesso na tela de Início (mesmo critério do web)

## Decisões registradas durante a implementação

- **Sem foto de comprovante nesta primeira versão** (já registrado como fora de escopo acima) — pode ser adicionado depois reaproveitando o componente de câmera de `NovaDespesaScreen.tsx`
- **Card de resumo consolidado adicionado à `InicioScreen`** (2026-09-05, depois de o desenvolvedor notar a ausência comparando com o print do web) — mesmo texto/dados do web, mas sem gradiente (`expo-linear-gradient` não é dependência do projeto; usa `cores.green[900]` sólido em vez de `from-hf-green-800 to-hf-green-900`), diferença puramente visual, sem efeito no dado exibido
- **Tela "Despesa compartilhada" fora da casca de navegação**, mesmo padrão de `AcertosScreen.tsx`/`SociosScreen.tsx`
