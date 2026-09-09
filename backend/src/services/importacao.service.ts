import { GoogleGenAI, Type, type Part } from '@google/genai';
import { read, utils } from 'xlsx';
import { TipoDespesa } from '@prisma/client';

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Task 24 — importação de despesas/vendas por foto, PDF ou planilha (docs/specs/24). Trocado
// de Claude pra Gemini (decisão do dev, custo por chamada) — modelo "flash" (não "pro" nem
// "flash-lite"): é o nível intermediário/barato da família, ainda multimodal (visão + PDF) e
// com output estruturado, suficiente pra esse caso de uso esporádico. `gemini-2.5-flash` foi
// descontinuado pra contas novas (erro 404 confirmado em teste real em 2026-09-07) — a própria
// API indicou `gemini-3.6-flash` como substituto direto da mesma geração/tier.
const MODELO = 'gemini-3.6-flash';

export type TipoArquivo = 'IMAGEM' | 'PDF' | 'PLANILHA' | 'DESCONHECIDO';

export interface ArquivoClassificado {
  nome: string;
  tipo: TipoArquivo;
  // Data URI completa (ex: "data:image/png;base64,...."), como o frontend já envia foto de
  // comprovante hoje (ver NovaDespesaPage.tsx) — sem upload multipart, sem storage externo.
  dataUrl: string;
}

// Gemini não aceita HEIC/HEIF em conteúdo inline (só jpeg/png/webp/gif) — mesma restrição que
// já existia com a Claude, então mantida aqui.
const EXTENSOES_POR_TIPO: Record<Exclude<TipoArquivo, 'DESCONHECIDO'>, string[]> = {
  IMAGEM: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  PDF: ['pdf'],
  PLANILHA: ['xlsx', 'xls', 'csv'],
};

// Classifica pela extensão do nome do arquivo, não pelo mime type declarado pelo navegador —
// o mime de data URI varia entre navegadores/SO para o mesmo tipo de arquivo (ex: .xlsx vira
// "application/octet-stream" em alguns casos), enquanto a extensão é estável.
export function classificarArquivo(nome: string): TipoArquivo {
  const ext = nome.toLowerCase().split('.').pop() ?? '';
  for (const [tipo, extensoes] of Object.entries(EXTENSOES_POR_TIPO)) {
    if (extensoes.includes(ext)) return tipo as TipoArquivo;
  }
  return 'DESCONHECIDO';
}

export const LIMITE_BYTES_POR_TIPO: Record<Exclude<TipoArquivo, 'DESCONHECIDO'>, number> = {
  IMAGEM: 10 * 1024 * 1024,
  PDF: 20 * 1024 * 1024,
  PLANILHA: 5 * 1024 * 1024,
};

const MEDIA_TYPE_POR_EXTENSAO: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

function separarDataUrl(dataUrl: string): { base64: string; bytes: number } {
  const virgula = dataUrl.indexOf(',');
  const base64 = virgula >= 0 ? dataUrl.slice(virgula + 1) : dataUrl;
  // Tamanho real em bytes a partir do tamanho da string base64 (cada 4 caracteres = 3 bytes),
  // descontando o padding "=" no final — evita subestimar o tamanho de arquivos pequenos.
  const padding = (base64.match(/=+$/) ?? [''])[0].length;
  const bytes = Math.floor((base64.length * 3) / 4) - padding;
  return { base64, bytes };
}

export function tamanhoEmBytes(arquivo: ArquivoClassificado): number {
  return separarDataUrl(arquivo.dataUrl).bytes;
}

const ROTULO_TIPO_DESPESA: Record<TipoDespesa, string> = {
  TERRA: 'Terra',
  MUDAS: 'Mudas',
  ADUBO: 'Adubo',
  DEFENSIVOS: 'Defensivos',
  MAO_DE_OBRA: 'Mão de obra',
  EMBALAGEM: 'Embalagem',
  TRANSPORTE: 'Transporte',
  OUTRO: 'Outro',
};

const VALORES_TIPO_DESPESA = Object.keys(ROTULO_TIPO_DESPESA);

const INSTRUCAO_BASE = `Você está ajudando um produtor rural (parceria de meação, produção de morango) a migrar
lançamentos financeiros anotados fora do sistema (caderno de papel, planilha) para dados estruturados.

Cada lançamento é uma DESPESA (compra, gasto, pagamento) ou uma VENDA (venda da produção pra um comprador).

Categorias de despesa disponíveis (use exatamente um destes valores em tipo_despesa, nunca invente outro):
${Object.entries(ROTULO_TIPO_DESPESA)
  .map(([valor, rotulo]) => `- ${valor}: ${rotulo}`)
  .join('\n')}
Se a categoria não for nenhuma dessas com clareza, use OUTRO.

Regras importantes:
- NUNCA invente um valor que você não conseguiu ler com razoável confiança. Se um campo estiver ilegível,
  incompleto ou ausente, deixe-o como null — não adivinhe uma data, valor ou categoria.
- Datas: use o formato ISO (AAAA-MM-DD). Se a data estiver incompleta (faltando mês ou ano) ou ilegível,
  retorne null em vez de adivinhar o ano/mês.
- É muito comum, numa página de caderno, a data aparecer **uma única vez** no topo do bloco (ex: "01
  SETEMBRO") e valer para todas as anotações abaixo dela, até aparecer uma nova data mais adiante. Nesse
  caso, aplique essa data a cada lançamento daquele bloco — não deixe a data como null só porque ela não
  está repetida ao lado de cada linha individual. Assuma o ano atual quando a data do cabeçalho não tiver
  ano explícito.
- Valores monetários: o formato de origem é brasileiro (vírgula como separador decimal, ponto como separador
  de milhar). Converta pra número puro (ex: "1.234,56" vira 1234.56).
- Marque confianca "BAIXA" sempre que você precisou adivinhar algo: letra difícil de ler, número ambíguo,
  texto riscado/rasurado sobre o qual não tem certeza se foi cancelado, ou duas informações misturadas na
  mesma linha do caderno que você teve que tentar separar.
- Se duas informações distintas estiverem na mesma linha/anotação e derem pra separar em dois lançamentos
  com valores próprios, gere duas linhas. Se não der pra separar com segurança, gere uma linha só com a
  descrição completa e confianca "BAIXA".
- Ignore texto claramente riscado/cancelado. Se não tiver certeza se foi cancelado, inclua mesmo assim
  com confianca "BAIXA".
- Se um arquivo não tiver nenhum lançamento identificável (foto borrada, página em branco, etc.), não gere
  nenhuma linha para aquele origem_arquivo_index — não force um resultado.
- O campo origem_arquivo_index deve ser o índice (começando em 0) do arquivo de onde aquela linha veio,
  na ordem em que os arquivos foram apresentados a você.
- Responda só com o JSON pedido pelo schema, nada além disso.`;

// Schema de output estruturado no formato que o Gemini exige (subconjunto de OpenAPI 3.0,
// campos opcionais viram `nullable: true` em vez de `type: [..., "null"]" do JSON Schema puro).
const schemaLinha = {
  type: Type.OBJECT,
  properties: {
    origem_arquivo_index: { type: Type.INTEGER },
    tipo_sugerido: { type: Type.STRING, enum: ['DESPESA', 'VENDA'] },
    confianca: { type: Type.STRING, enum: ['ALTA', 'BAIXA'] },
    data: { type: Type.STRING, nullable: true },
    tipo_despesa: { type: Type.STRING, enum: VALORES_TIPO_DESPESA, nullable: true },
    valor: { type: Type.NUMBER, nullable: true },
    descricao: { type: Type.STRING, nullable: true },
    quantidade: { type: Type.NUMBER, nullable: true },
    unidade_nome_sugerido: { type: Type.STRING, nullable: true },
    preco: { type: Type.NUMBER, nullable: true },
    comprador: { type: Type.STRING, nullable: true },
  },
  required: ['origem_arquivo_index', 'tipo_sugerido', 'confianca'],
};

const schemaResposta = {
  type: Type.OBJECT,
  properties: { linhas: { type: Type.ARRAY, items: schemaLinha } },
  required: ['linhas'],
};

interface LinhaBruta {
  origem_arquivo_index: number;
  tipo_sugerido: 'DESPESA' | 'VENDA';
  confianca: 'ALTA' | 'BAIXA';
  data: string | null;
  tipo_despesa: TipoDespesa | null;
  valor: number | null;
  descricao: string | null;
  quantidade: number | null;
  unidade_nome_sugerido: string | null;
  preco: number | null;
  comprador: string | null;
}

export type LinhaExtraida = LinhaBruta & { imagem_origem_base64?: string };

async function extrairComGemini(systemInstruction: string, parts: Part[]): Promise<LinhaBruta[]> {
  const response = await client.models.generateContent({
    model: MODELO,
    contents: parts,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: schemaResposta,
    },
  });

  if (!response.text) {
    throw new Error('A IA não retornou um resultado estruturado válido');
  }
  const resultado = JSON.parse(response.text) as { linhas: LinhaBruta[] };
  return resultado.linhas ?? [];
}

function mediaTypeDaImagem(nome: string): string {
  const ext = nome.toLowerCase().split('.').pop() ?? '';
  return MEDIA_TYPE_POR_EXTENSAO[ext] ?? 'image/jpeg';
}

async function extrairDeImagensOuPdf(arquivos: ArquivoClassificado[]): Promise<LinhaExtraida[]> {
  const parts: Part[] = [];

  arquivos.forEach((arquivo, index) => {
    parts.push({ text: `Arquivo ${index}: "${arquivo.nome}"` });
    const { base64 } = separarDataUrl(arquivo.dataUrl);
    const mimeType = arquivo.tipo === 'PDF' ? 'application/pdf' : mediaTypeDaImagem(arquivo.nome);
    parts.push({ inlineData: { data: base64, mimeType } });
  });

  parts.push({ text: 'Extraia todos os lançamentos (despesas e vendas) visíveis nesses arquivos, seguindo as regras acima.' });

  const linhas = await extrairComGemini(INSTRUCAO_BASE, parts);

  // Anexa a própria imagem de origem em cada linha vinda de foto (não PDF — várias páginas
  // num PDF só tornariam ambíguo qual página vira comprovante), pra tela de revisão oferecer
  // "anexar como comprovante" sem o sócio precisar re-selecionar o arquivo.
  return linhas.map((linha) => {
    const arquivo = arquivos[linha.origem_arquivo_index];
    if (arquivo && arquivo.tipo === 'IMAGEM') {
      return { ...linha, imagem_origem_base64: arquivo.dataUrl };
    }
    return linha;
  });
}

// Planilha não passa pela visão da IA (já é dado estruturado) — só o *mapeamento* de coluna
// pra campo (data/valor/categoria/etc, já que o nome das colunas do usuário é livre) usa IA,
// com as linhas brutas como texto.
async function extrairDePlanilha(arquivo: ArquivoClassificado): Promise<LinhaExtraida[]> {
  const { base64 } = separarDataUrl(arquivo.dataUrl);
  const buffer = Buffer.from(base64, 'base64');
  const workbook = read(buffer, { type: 'buffer' });
  const primeiraAba = workbook.SheetNames[0];
  if (!primeiraAba) return [];

  const linhasBrutas: unknown[][] = utils.sheet_to_json(workbook.Sheets[primeiraAba], {
    header: 1,
    blankrows: false,
  });
  if (linhasBrutas.length === 0) return [];

  // Limite de linhas pra não estourar o contexto com uma planilha absurdamente grande —
  // suficiente pro caso real (histórico de uma safra num caderno/planilha simples).
  const linhasLimitadas = linhasBrutas.slice(0, 500);
  const tabelaTexto = linhasLimitadas
    .map((linha) => linha.map((celula) => String(celula ?? '')).join(' | '))
    .join('\n');

  const instrucaoPlanilha = `${INSTRUCAO_BASE}

As linhas abaixo vieram de uma planilha (arquivo "${arquivo.nome}"), separadas por " | ". A primeira linha
provavelmente é o cabeçalho, mas o nome das colunas é livre (pode ser em qualquer ordem, com abreviações,
sem padrão) — você precisa identificar o que cada coluna representa pelo conteúdo, não só pelo nome.
Use origem_arquivo_index = 0 em todas as linhas retornadas (é um único arquivo).

Linhas da planilha:
${tabelaTexto}`;

  return extrairComGemini(instrucaoPlanilha, [{ text: 'Extraia os lançamentos dessa planilha.' }]);
}

export interface ResultadoExtracao {
  linhas: LinhaExtraida[];
  arquivos_sem_leitura: number[];
}

export async function extrairLancamentos(arquivos: ArquivoClassificado[]): Promise<ResultadoExtracao> {
  const ehPlanilha = arquivos[0]?.tipo === 'PLANILHA';
  const linhas = ehPlanilha ? await extrairDePlanilha(arquivos[0]) : await extrairDeImagensOuPdf(arquivos);

  const indicesComLinha = new Set(linhas.map((l) => l.origem_arquivo_index));
  const arquivosSemLeitura = arquivos.map((_, i) => i).filter((i) => !indicesComLinha.has(i));

  return { linhas, arquivos_sem_leitura: arquivosSemLeitura };
}
