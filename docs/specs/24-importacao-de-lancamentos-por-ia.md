# Task 24 — Importação de despesas e vendas por foto, PDF ou planilha (via IA)

## Objetivo

Quem está começando a usar o HortiFlow Produtor hoje já tem despesas e vendas da safra anotadas em outro lugar — caderno de papel, print de planilha no celular, ou um arquivo Excel — e não vai digitar tudo de novo, uma linha por vez, nas telas de Despesa e Venda. Esta task cria um fluxo onde o sócio envia foto(s), um PDF ou um arquivo de planilha com esses lançamentos, um agente de IA (API da Claude) interpreta o conteúdo e sugere uma lista de despesas/vendas estruturadas, e o sócio **revisa e confirma linha por linha** antes de qualquer coisa ser gravada de fato — porque leitura de letra manuscrita nunca é 100% confiável, e dado incorreto de despesa/venda alimenta diretamente o cálculo de divisão de lucro entre os sócios (ver "Regra crítica de arquitetura" no CLAUDE.md).

## Adendo 2026-09-09 — lançamento perdido pela IA e adição manual na revisão

Teste real (dev, 2026-09-09) com foto de 8 lançamentos: a IA extraiu 7, deixando 1 de fora — comportamento esperado (nunca 100% garantido em letra manuscrita), mas a tela de revisão não dava nenhum jeito de completar o que faltou sem sair do fluxo de importação. Dois ajustes:

- **Aviso fixo na revisão**: banner explicando que a IA pode deixar lançamento de fora e que vale conferir contra o papel/arquivo original antes de confirmar — evita que o sócio confie cegamente no resultado
- **Botão "Adicionar" fixo** (sticky, logo abaixo do cabeçalho, ao lado do contador de linhas prontas/revisão/descartadas) que insere uma linha em branco no topo da lista, editável do mesmo jeito que as linhas extraídas — corrige lançamento que a IA não pegou sem precisar sair da tela. Fixo (não lá embaixo, na lista) porque com muitos lançamentos extraídos o scroll fica longo
- Linha adicionada manualmente ganha um selo "Adicionado por você" no lugar do selo de confiança (não fazia sentido mostrar confiança de algo que não veio de extração nenhuma)
- Decisão do dev: não vale a pena tentar melhorar a precisão da extração em si (ex: rodar duas vezes e comparar) — dobraria o custo por importação pra um ganho incerto, e vai contra a premissa da spec original: a revisão humana é a rede de segurança, não a perfeição do OCR

## Adendo 2026-09-08 — rateio na tela de revisão e data herdada de cabeçalho de página

Dois ajustes feitos após teste real com foto de caderno (dev, 2026-09-08):

- **Rateio ausente na revisão**: a spec original só previa "sócio responsável" (quem bancou a despesa) na tela de revisão, mas não o rateio (quem essa despesa é descontada na divisão de lucro) — o mesmo recurso que a tela manual de despesa já tem desde a spec 13 (Dividir como o lucro / Só de um sócio / Personalizado). Sem isso, uma despesa importada sempre cairia no rateio padrão, mesmo quando o financiador queria descontar 100% do meeiro ou dividir de outro jeito. Adicionado o mesmo três-modos da tela manual em cada linha de despesa da revisão.
- **Data no cabeçalho da página**: numa foto real de caderno, a data (ex: "01 SETEMBRO") aparecia uma única vez no topo da página, valendo para todas as anotações abaixo — e a IA não estava associando essa data às linhas sem data explícita ao lado, deixando o campo `data` vazio. Ajustada a instrução em `importacao.service.ts` pra tratar esse padrão explicitamente.

## Adendo 2026-09-07 — troca de Claude pra Gemini

Decisão do dev: usar a API do Gemini (Google) em vez da API da Claude (Anthropic), por custo — o Gemini "flash" é mais barato por chamada que os modelos da Claude usados aqui. Como toda a lógica de IA ficou isolada em `backend/src/services/importacao.service.ts` (mesma razão da "Regra crítica de arquitetura" do CLAUDE.md: lógica sujeita a mudar isolada num arquivo só), a troca não exigiu tocar em controller, rotas nem frontend — só esse arquivo mudou por dentro. O contrato de API descrito abaixo continua o mesmo.

Mudanças concretas:
- Dependência `@anthropic-ai/sdk` removida, `@google/genai` adicionada
- Variável de ambiente `ANTHROPIC_API_KEY` vira `GEMINI_API_KEY`
- Modelo: `gemini-3.6-flash` (nível intermediário/barato da família, ainda multimodal e com output estruturado — suficiente pro volume esporádico dessa funcionalidade). `gemini-2.5-flash` foi cogitado primeiro mas está descontinuado pra contas novas (confirmado com chamada real em 2026-09-07, erro 404 recomendando `gemini-3.6-flash` como substituto)
- Output estruturado via `responseSchema` (formato OpenAPI 3.0 simplificado do Gemini, com `nullable: true` nos campos opcionais) em vez do `output_config.format` baseado em Zod da Claude — mesmo formato de resposta (`{ linhas: [...] }`), só muda como o schema é declarado internamente
- Continua não aceitando HEIC/HEIF (mesma limitação de formato de imagem que já existia)

## Decisões tomadas durante a implementação (não previstas na spec original)

- **Upload por JSON base64, não multipart/form-data**: o backend não tinha (e continua sem ter) nenhuma dependência de multipart (Multer etc.) — toda foto hoje (comprovante de despesa) já viaja como data URI base64 dentro do corpo JSON normal (ver `docs/specs/07`). Pra manter esse mesmo padrão em vez de introduzir uma segunda forma de upload, a importação usa o mesmo formato: `{ arquivos: [{ nome, base64 }] }`. O limite de corpo do Express (`express.json`) subiu de 8mb pra 25mb por causa disso.
- **Classificação do tipo de arquivo pela extensão do nome, não pelo mime type**: o mime de uma data URI gerada por `FileReader.readAsDataURL` varia entre navegador/SO pro mesmo tipo de arquivo (ex: planilha `.xlsx` pode virar `application/octet-stream`), enquanto a extensão é estável.
- **HEIC/HEIF (padrão de foto do iPhone) não é aceito**: a API da Claude só aceita `image/jpeg`, `image/png`, `image/gif` e `image/webp` em blocos de imagem. Enviar uma foto `.heic` retorna 422 pedindo outro formato — a galeria/câmera do iPhone já oferece exportar como JPEG.
- **Modelo fixo: `claude-opus-5`** (não um modelo mais barato) — é dado financeiro que alimenta `calcularDivisao` entre sócios, então o custo de um erro de leitura supera a economia de usar um modelo menor numa chamada esporádica de importação.
- **Extração via `output_config.format` (structured output com Zod)**, não parsing manual de texto — garante que a resposta bate exatamente com o schema esperado (`linhas: [...]`) sem re-parsear string livre.

## Dependências novas (a instalar e por quê)

- **`@anthropic-ai/sdk`** (backend) — cliente oficial pra chamar a API da Claude a partir do Node/Express. É o motor que faz a leitura de imagem/PDF (capacidade de visão) e a interpretação de texto livre (planilha com colunas fora de padrão). Precisa de uma `ANTHROPIC_API_KEY` nova nas variáveis de ambiente do Railway, nos dois ambientes (`develop` e `production`).
- **`xlsx`** (backend) — biblioteca pra ler arquivos `.xlsx`/`.xls`/`.csv` e transformar em linhas/colunas de dados brutos antes de mandar pra IA interpretar o mapeamento de colunas. Não usamos IA pra "olhar" a planilha como imagem — ela já é dado estruturado, só precisa mapear coluna → campo do nosso modelo.

Cada chamada de importação consome créditos da API da Claude (custo por token/imagem). Nesta rodada não há limite de uso por sociedade/dia — ver "Fica de fora".

## Escopo

**Entra:**
- Botão "Importar lançamentos" dentro da tela de uma Safra específica (a que o sócio está vendo no momento é a safra de destino — sem seletor de safra separado, é a mesma navegação que hoje leva a "+ Despesa"/"+ Venda")
- Upload de até 10 arquivos por importação, podendo ser:
  - **Fotos/prints** (jpg, png, heic — até 10MB cada): foto de página de caderno, foto de comprovante avulso, ou print de qualquer coisa (extrato, conversa de WhatsApp, planilha em imagem)
  - **PDF** (até 20MB, até 20 páginas): tratado com o suporte nativo a documentos da API da Claude, sem conversão manual pra imagem
  - **Planilha** (`.xlsx`, `.xls` ou `.csv`, até 5MB): não pode ser misturada com foto/PDF no mesmo envio (pipelines diferentes — ver "Regras de negócio")
- Extração por IA retornando uma lista de linhas candidatas, cada uma já classificada como possível Despesa ou Venda, com um nível de confiança
- Tela de revisão: tabela editável onde o sócio corrige/completa cada linha (data, categoria, sócio responsável, valor, ou quantidade/unidade/preço/comprador no caso de venda) antes de confirmar
- Confirmação cria as despesas/vendas de fato, uma a uma, reaproveitando os endpoints `POST /safras/:id/despesas` e `POST /safras/:id/vendas` já existentes — sem endpoint novo de criação em lote
- Opção de anexar a imagem de origem como `foto_comprovante` de cada despesa criada a partir dela

**Fica de fora (não implementar nesta task):**
- `DespesaPessoal` — o problema relatado é sobre dados da sociedade (caderno da safra); despesa pessoal fica pra uma rodada futura se virar necessidade real (decisão do dev)
- App mobile — só web nesta rodada, mesmo padrão de faseamento já usado na spec 19 (valida em staging web antes de levar pro app nativo); também evita ter que decidir agora como isso se encaixa no modelo offline-first do mobile, já que upload de imagem/PDF pra IA exige conexão
- Persistir o rascunho da revisão no banco — vive só em memória do navegador (estado React) durante a sessão. Se o sócio recarregar a página ou fechar a aba no meio da revisão, perde o progresso e precisa reenviar os arquivos (decisão do dev)
- Endpoint de criação em lote no backend — a tela de revisão chama os endpoints de criação existentes N vezes em sequência, mesmo padrão do parcelamento (spec 19)
- Processamento assíncrono/fila — a extração roda de forma síncrona (o sócio espera o resultado na tela); se o volume de arquivos grandes se mostrar lento demais em uso real, isso vira uma task própria de infra depois
- Rate limit ou controle de custo de uso da IA por sociedade/dia — consciente do custo por chamada, mas sem controle nesta rodada; monitorar depois de validado em staging
- Correção automática de foto rotacionada/tremida/mal enquadrada — a IA de visão geralmente tolera rotação razoável, mas isso não é algo que o app resolve ativamente; qualidade ruim só gera confiança baixa (ver seção de OCR)
- Detecção de duplicidade entre um lançamento já existente no sistema e um sendo importado agora — a responsabilidade de não lançar duas vezes é do sócio, igual já é hoje entre dois lançamentos manuais
- Qualquer leitura estruturada de nota fiscal (NF-e) — já é um "nunca" do produto (ver CLAUDE.md, "Diferenças importantes")
- Suporte a outros formatos de planilha (Google Sheets por link, `.numbers` da Apple) — só os três formatos listados acima

## Regras de negócio

### Entrada e pipeline por tipo de arquivo

- **Foto/print** e **PDF** seguem o mesmo pipeline: cada página/imagem é enviada como conteúdo de visão para a Claude, com um prompt que descreve o domínio (lançamentos de despesa e venda de uma parceria agrícola) e pede de volta uma lista estruturada (usando tool-use/structured output da API, não texto livre a ser re-parseado)
- **Planilha** segue pipeline próprio: o backend lê o arquivo com `xlsx` e extrai as linhas/colunas brutas (sem IA de visão, já é dado estruturado). Como a planilha do usuário pode ter colunas em qualquer ordem/nome (ex: "Data", "Qdo", "Gasto", "R$", "O que foi"), essas linhas brutas são enviadas em texto pra Claude interpretar o mapeamento coluna → campo e devolver a mesma lista estruturada dos outros pipelines
- Um envio mistura no máximo um tipo de pipeline: ou um ou mais arquivos de foto/PDF, ou uma única planilha — nunca os dois no mesmo envio (evita ambiguidade de "qual arquivo é a fonte de qual linha" na tela de revisão)
- Cada linha retornada guarda de qual arquivo/página ela veio, pra permitir oferecer aquela imagem específica como comprovante depois

### Classificação de cada linha

Cada linha extraída vem com:
- `tipo_sugerido`: `DESPESA` ou `VENDA` (a IA decide pelo contexto: "comprei", "gastei", "paguei" → despesa; "vendi", "entreguei pro comprador X" → venda)
- `confianca`: `ALTA` ou `BAIXA` — `BAIXA` sempre que a IA teve que adivinhar algo (data incompleta, categoria ambígua, número de difícil leitura, texto riscado/rasurado, ou letra genuinamente ilegível em parte do campo)
- Campos específicos de despesa: `data`, `tipo_despesa` (mapeado pro enum `TipoDespesa` existente — se o texto não corresponder a nenhuma categoria conhecida, cai em `OUTRO`), `valor`, `descricao`
- Campos específicos de venda: `data`, `quantidade`, `unidade_nome_sugerido` (texto livre, ex: "cx", "caixa", "kg" — mapeado na revisão contra as `UnidadeVenda` já cadastradas na sociedade), `preco`, `comprador`
- Nenhum campo é inventado quando a IA não consegue ler: fica vazio/nulo, e a linha entra na tela de revisão marcada como "precisa revisão" até o sócio completar manualmente

### Problemas conhecidos de OCR em manuscrito e como o app lida com cada um

| Problema | Comportamento do app |
|---|---|
| Data ausente ou incompleta (ex: só "dia 15", sem mês/ano) | Campo `data` vem vazio; **obrigatório o sócio preencher antes de confirmar aquela linha** — não há palpite automático de ano/mês |
| Categoria de despesa não identificável ou fora do enum fixo | Cai em `OUTRO` com confiança `BAIXA`; sócio escolhe a categoria certa no dropdown da revisão |
| Valor de leitura ambígua (ex: caligrafia confusa entre "150" e "750") | Vem com o melhor palpite da IA, mas confiança `BAIXA`; formato assumido é o brasileiro (vírgula decimal, ponto de milhar) |
| Texto riscado/rasurado no caderno | A IA tenta ignorar o que está riscado; se não tiver certeza se algo foi cancelado, inclui a linha mesmo assim com confiança `BAIXA` |
| Duas informações na mesma linha do caderno (ex: "adubo e frete 300") | A IA tenta separar em duas linhas quando dá pra distinguir valores; se não der, mantém uma linha só com a descrição completa e confiança `BAIXA` |
| Letra ilegível em parte do campo (ex: dá pra ler o valor mas não a categoria) | Só o campo ilegível fica vazio; os demais campos daquela linha são preenchidos normalmente |
| Foto borrada, mal iluminada ou tremida | Pode gerar zero linhas extraídas daquele arquivo, ou linhas todas com confiança `BAIXA`; a tela avisa por arquivo quando isso acontece ("não conseguimos ler bem a imagem X, considere tirar outra foto") |
| Arquivo sem nenhum lançamento identificável | Retorna lista vazia para aquele arquivo, sem erro — a tela informa que nada foi encontrado nele |

### Tela de revisão

- Tabela com uma linha por lançamento candidato, agrupada visualmente por arquivo de origem
- Cada linha tem os campos editáveis: tipo (Despesa/Venda — o sócio pode reclassificar), data, categoria (só despesa), sócio responsável (só despesa — dropdown, default é o sócio logado; só pode escolher outro sócio que já tenha conta vinculada, já que `Despesa.socio_id` referencia `Usuario`, e um `SocioSociedade` sem `usuario_id` não é uma opção válida), valor (despesa) ou quantidade/unidade/preço/comprador (venda), e um checkbox "anexar imagem original como comprovante" (só aparece pra despesa vinda de foto/PDF)
- Se `unidade_nome_sugerido` de uma venda não corresponder a nenhuma `UnidadeVenda` já cadastrada na sociedade (comparação sem diferenciar maiúsculas/acentos), o sócio precisa escolher uma unidade existente ou criar uma nova ali mesmo (reaproveitando o fluxo de criação de unidade da spec 08), antes de conseguir confirmar aquela linha
- Toda linha com campo obrigatório vazio (data, valor, ou quantidade/preço/unidade no caso de venda) fica marcada "precisa revisão" e **não pode ser confirmada** até ser completada — mas não bloqueia a confirmação das outras linhas já válidas
- Cada linha tem uma ação "Descartar" (não importa aquele item — útil pra anotação do caderno que não era um lançamento de fato, tipo um lembrete)
- Resumo no topo da tela: quantas linhas prontas pra importar, quantas precisam de revisão, quantas foram descartadas

### Confirmação

- Ao confirmar, o frontend chama `POST /safras/:id/despesas` ou `POST /safras/:id/vendas` uma vez por linha válida, em sequência (mesmo padrão do parcelamento da spec 19)
- Se uma chamada falhar no meio do processo, a tela mostra quais linhas foram criadas com sucesso e quais falharam, permitindo tentar de novo só as que faltaram — sem rollback automático das que já foram criadas
- Ao final, mostra um resumo: "X despesas e Y vendas importadas com sucesso" (com link pra cada uma na listagem normal da safra)

## Contrato de API

```
POST /safras/:id/importacao/extrair
  auth obrigatório, requer ser sócio da sociedade dona da safra
  body: multipart/form-data
    arquivos[]: 1 a 10 arquivos
      - imagem: jpg/png/heic, até 10MB cada
      - OU pdf: até 20MB, até 20 páginas
      - OU planilha: xlsx/xls/csv, até 5MB (não pode vir junto com imagem/pdf no mesmo envio)
  → 200 {
      linhas: [{
        origem_arquivo_index: number,
        tipo_sugerido: 'DESPESA' | 'VENDA',
        confianca: 'ALTA' | 'BAIXA',
        // despesa
        data?: string,
        tipo_despesa?: TipoDespesa,
        valor?: number,
        descricao?: string,
        // venda
        quantidade?: number,
        unidade_nome_sugerido?: string,
        preco?: number,
        comprador?: string,
        // só presente pra linha vinda de imagem/pdf, pra oferecer como comprovante
        imagem_origem_base64?: string
      }],
      arquivos_sem_leitura: number[]  // índices de arquivos onde nada foi extraído (imagem ruim ou vazia)
    }
  → 422 se nenhum arquivo enviado, tipo/tamanho fora do permitido, ou mistura de planilha com imagem/pdf
  → 403 se autenticado não for sócio da sociedade dona da safra
  → 502 se a chamada à API da Claude falhar (mensagem amigável, sem gravar nada)

POST /safras/:id/despesas   — já existe (spec 03/19), reaproveitado sem mudança de contrato
POST /safras/:id/vendas     — já existe (spec 04/08), reaproveitado sem mudança de contrato
```

Nenhuma mudança de schema Prisma é necessária para esta task — não existe tabela de rascunho/importação, já que o resultado da extração vive só em memória no frontend até a confirmação.

## Critérios de aceite

1. Dado uma foto nítida de uma página de caderno com "12/03 - Adubo - 350" e "15/03 - vendi 20 caixas a 45 - João", `POST /safras/:id/importacao/extrair` retorna duas linhas: uma `DESPESA` (categoria mapeada, valor 350, confiança `ALTA`) e uma `VENDA` (quantidade 20, preço 45, comprador "João", confiança `ALTA`)
2. Dada uma foto onde a data de um item está ilegível, a linha correspondente vem com `data` vazio e `confianca: 'BAIXA'`, e a tela de revisão bloqueia a confirmação daquela linha até o sócio preencher a data
3. Dada uma planilha `.xlsx` com colunas em ordem/nomes arbitrários (ex: "Qdo", "O que", "Valor R$"), a extração mapeia corretamente para os campos do modelo
4. Envio simultâneo de uma planilha e uma foto no mesmo request retorna 422
5. Envio de mais de 10 arquivos, ou de um arquivo acima do limite de tamanho do seu tipo, retorna 422
6. Uma imagem borrada sem nenhum texto legível retorna `linhas: []` e o índice do arquivo em `arquivos_sem_leitura`, sem erro 500
7. Na tela de revisão, uma venda cujo `unidade_nome_sugerido` não bate com nenhuma `UnidadeVenda` da sociedade obriga o sócio a escolher/criar uma unidade antes de liberar a confirmação daquela linha
8. Confirmar 3 linhas válidas cria 3 registros reais (chamando os endpoints existentes de Despesa/Venda), refletidos imediatamente na listagem da safra e no painel de simulação
9. Se a 2ª de 3 chamadas de confirmação falhar (ex: rede caiu), a tela informa quais das 3 foram criadas e permite reenviar só a que falhou, sem duplicar as outras duas
10. Marcar "anexar imagem original como comprovante" numa linha de despesa grava a imagem em base64 no campo `foto_comprovante`, do mesmo jeito que o lançamento manual já faz hoje (spec 07)
11. Recarregar a página no meio da revisão perde o progresso (comportamento esperado, documentado nesta spec) — não é um bug a corrigir
12. Nenhuma mudança de valor ou comportamento em `calcularDivisao`, no painel de simulação ou nos endpoints existentes de Despesa/Venda — esta task só cria um caminho novo de preenchimento dos mesmos formulários, reaproveitando as mesmas rotas e validações já existentes
