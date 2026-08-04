import PDFDocument from 'pdfkit';
import SVGtoPDF from 'svg-to-pdfkit';
import { TipoDespesa } from '@prisma/client';
import type { ResultadoDivisao } from './divisao.service';
import { brandIconSvg } from '../assets/brandIcon';

// Mesmos rótulos usados no frontend (frontend/src/lib/rotulos.ts) — duplicado aqui porque
// o backend não compartilha código com o frontend (monorepo com camadas separadas).
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

// Mesma paleta do app (frontend/tailwind.config.ts, mobile/src/theme.ts) — duplicada aqui
// pelo mesmo motivo do rótulo acima. Ver docs/design/notas-de-design.md.
const COR = {
  green900: '#123a24',
  green800: '#17482d',
  green700: '#1e6b3e',
  green100: '#e3eee3',
  cream100: '#f2f0e7',
  cream50: '#faf9f4',
  stone900: '#202821',
  stone600: '#5c6b5e',
  line: '#dde1d8',
  red: '#d64545',
};

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(data: Date): string {
  return data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export interface DespesaRelatorio {
  data: Date;
  tipo: TipoDespesa;
  valor: number;
  socio_nome: string;
}

export interface VendaRelatorio {
  data: Date;
  unidade_nome: string;
  quantidade: number;
  preco: number;
  total: number;
  pago: boolean;
}

export interface DadosRelatorio {
  safra_nome: string;
  sociedade_nome: string;
  data_inicio: Date | null;
  data_fim: Date | null;
  despesas: DespesaRelatorio[];
  vendas: VendaRelatorio[];
  divisao: ResultadoDivisao;
}

function periodoLabel(dados: DadosRelatorio): string {
  if (!dados.data_inicio && !dados.data_fim) return 'Safra inteira';
  if (dados.data_inicio && dados.data_fim) return `${formatarData(dados.data_inicio)} a ${formatarData(dados.data_fim)}`;
  if (dados.data_inicio) return `A partir de ${formatarData(dados.data_inicio)}`;
  return `Até ${formatarData(dados.data_fim as Date)}`;
}

interface Coluna {
  texto: string;
  x: number;
  largura: number;
  alinhamento?: 'left' | 'right';
}

// pdfkit não tem suporte nativo a tabelas — `continued: true` + `width` (tentativa inicial)
// quebra em múltiplas linhas em vez de alinhar colunas, porque `width` ali só limita
// wrap do texto corrente, não reserva uma coluna fixa. A forma correta é posicionar cada
// célula por coordenada X explícita, todas na mesma linha `y`, com `lineBreak: false`
// pra truncar em vez de quebrar (célula larga demais rouba espaço da próxima).
//
// `corFundo` desenha uma faixa colorida atrás da linha inteira antes do texto — usado tanto
// pro cabeçalho da tabela (verde da marca) quanto pro zebrado do corpo (linhas alternadas).
function linhaTabela(
  doc: PDFKit.PDFDocument,
  colunas: Coluna[],
  opcoes: { corFundo?: string; corTexto?: string; larguraTotal: number } = { larguraTotal: 0 }
): void {
  const y = doc.y;
  const alturaLinha = 16;
  if (opcoes.corFundo) {
    doc
      .rect(doc.page.margins.left, y - 3, opcoes.larguraTotal, alturaLinha)
      .fill(opcoes.corFundo);
  }
  doc.fillColor(opcoes.corTexto ?? COR.stone900);
  for (const c of colunas) {
    doc.text(c.texto, c.x, y, { width: c.largura, lineBreak: false, align: c.alinhamento ?? 'left' });
  }
  doc.y = y + alturaLinha;
  doc.x = doc.page.margins.left;
}

function tituloSecao(doc: PDFKit.PDFDocument, texto: string): void {
  doc.fillColor(COR.green800).fontSize(13).font('Helvetica-Bold').text(texto);
  const y = doc.y + 2;
  doc
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.margins.left + 40, y)
    .lineWidth(2)
    .strokeColor(COR.green700)
    .stroke();
  doc.y = y + 8;
  doc.x = doc.page.margins.left;
}

// Gera o PDF em memória e devolve o Buffer pronto — o controller só precisa escrever no
// response, sem lidar com stream/eventos do pdfkit.
export function gerarRelatorioPdf(dados: DadosRelatorio): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const partes: Buffer[] = [];
  doc.on('data', (parte) => partes.push(parte));
  const finalizado = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
  });

  const margem = doc.page.margins.left;
  const larguraUtil = doc.page.width - margem * 2;

  // Cabeçalho com a identidade visual do app: ícone + wordmark "HortiFlow Produtor",
  // igual ao que aparece na tela de splash/login (docs/design/notas-de-design.md).
  const iconeTamanho = 26;
  SVGtoPDF(doc, brandIconSvg(), margem, doc.y, { width: iconeTamanho, height: iconeTamanho, preserveAspectRatio: 'xMidYMid meet' });
  doc
    .fillColor(COR.green700)
    .fontSize(15)
    .font('Helvetica-Bold')
    .text('HortiFlow', margem + iconeTamanho + 10, doc.y + 4, { continued: true })
    .fillColor(COR.stone600)
    .text(' Produtor');
  doc.moveDown(1);
  doc.x = margem;

  doc.fillColor(COR.green900).fontSize(18).font('Helvetica-Bold').text(`Relatório — ${dados.safra_nome}`, margem);
  doc.fillColor(COR.stone600).fontSize(10).font('Helvetica').text(dados.sociedade_nome, margem);
  doc.text(`Período: ${periodoLabel(dados)}`, margem);
  doc.moveDown(1.2);
  doc.x = margem;

  // Bloco 1 — extrato de movimentação (o que interessa à contabilidade formal: dinheiro
  // que efetivamente entrou/saiu do caixa do financiador).
  tituloSecao(doc, 'Despesas');
  if (dados.despesas.length === 0) {
    doc.fillColor(COR.stone600).fontSize(10).font('Helvetica').text('Nenhuma despesa no período.');
  } else {
    const colunas: Omit<Coluna, 'texto'>[] = [
      { x: margem + 6, largura: 60 },
      { x: margem + 65, largura: 130 },
      { x: margem + 200, largura: 145 },
      { x: margem + 355, largura: 84, alinhamento: 'right' },
    ];
    doc.fontSize(9).font('Helvetica-Bold');
    linhaTabela(
      doc,
      [
        { texto: 'Data', ...colunas[0] },
        { texto: 'Tipo', ...colunas[1] },
        { texto: 'Sócio', ...colunas[2] },
        { texto: 'Valor', ...colunas[3] },
      ],
      { corFundo: COR.green100, corTexto: COR.green800, larguraTotal: larguraUtil }
    );
    doc.font('Helvetica');
    dados.despesas.forEach((d, i) => {
      linhaTabela(
        doc,
        [
          { texto: formatarData(d.data), ...colunas[0] },
          { texto: ROTULO_TIPO_DESPESA[d.tipo], ...colunas[1] },
          { texto: d.socio_nome, ...colunas[2] },
          { texto: formatarMoeda(d.valor), ...colunas[3] },
        ],
        { corFundo: i % 2 === 0 ? COR.cream50 : COR.cream100, larguraTotal: larguraUtil }
      );
    });
  }
  doc.moveDown(0.5);
  doc.fillColor(COR.green800).fontSize(10).font('Helvetica-Bold').text(`Total de despesas: ${formatarMoeda(dados.divisao.despesas)}`, margem);
  doc.moveDown(1);
  doc.x = margem;

  tituloSecao(doc, 'Vendas');
  if (dados.vendas.length === 0) {
    doc.fillColor(COR.stone600).fontSize(10).font('Helvetica').text('Nenhuma venda no período.');
  } else {
    const colunas: Omit<Coluna, 'texto'>[] = [
      { x: margem + 6, largura: 60 },
      { x: margem + 65, largura: 130 },
      { x: margem + 200, largura: 75 },
      { x: margem + 280, largura: 75 },
      { x: margem + 365, largura: 74, alinhamento: 'right' },
    ];
    doc.fontSize(9).font('Helvetica-Bold');
    linhaTabela(
      doc,
      [
        { texto: 'Data', ...colunas[0] },
        { texto: 'Unidade/Qtd', ...colunas[1] },
        { texto: 'Preço', ...colunas[2] },
        { texto: 'Status', ...colunas[3] },
        { texto: 'Total', ...colunas[4] },
      ],
      { corFundo: COR.green100, corTexto: COR.green800, larguraTotal: larguraUtil }
    );
    doc.font('Helvetica');
    dados.vendas.forEach((v, i) => {
      linhaTabela(
        doc,
        [
          { texto: formatarData(v.data), ...colunas[0] },
          { texto: `${v.quantidade} ${v.unidade_nome}`, ...colunas[1] },
          { texto: formatarMoeda(v.preco), ...colunas[2] },
          { texto: v.pago ? 'Paga' : 'A receber', ...colunas[3] },
          { texto: formatarMoeda(v.total), ...colunas[4] },
        ],
        { corFundo: i % 2 === 0 ? COR.cream50 : COR.cream100, larguraTotal: larguraUtil }
      );
    });
  }
  doc.moveDown(0.5);
  doc.fillColor(COR.green800).fontSize(10).font('Helvetica-Bold').text(`Total de vendas: ${formatarMoeda(dados.divisao.receita)}`, margem);
  doc.moveDown(1.5);
  doc.x = margem;

  // Bloco 2 — resumo de divisão entre sócios: acordo interno da parceria, não é fato
  // fiscal, mas é o que ajuda o financiador a saber quanto descontar/pagar no acerto.
  tituloSecao(doc, 'Resumo de divisão entre sócios');
  doc.fillColor(COR.stone600).fontSize(9).font('Helvetica-Oblique').text(
    'Simulação interna da parceria, calculada a partir do percentual de lucro de cada sócio — não é um lançamento contábil.',
    margem
  );
  doc.moveDown(0.3);
  doc.fillColor(COR.stone900).fontSize(10).font('Helvetica').text(`Lucro líquido do período: ${formatarMoeda(dados.divisao.lucroLiquido)}`, margem);
  doc.moveDown(0.3);
  doc.x = margem;
  const colunasDivisao: Omit<Coluna, 'texto'>[] = [
    { x: margem + 6, largura: 210 },
    { x: margem + 220, largura: 100 },
    { x: margem + 320, largura: 114, alinhamento: 'right' },
  ];
  doc.fontSize(9).font('Helvetica-Bold');
  linhaTabela(
    doc,
    [
      { texto: 'Sócio', ...colunasDivisao[0] },
      { texto: 'Percentual', ...colunasDivisao[1] },
      { texto: 'Valor', ...colunasDivisao[2] },
    ],
    { corFundo: COR.green100, corTexto: COR.green800, larguraTotal: larguraUtil }
  );
  doc.font('Helvetica');
  dados.divisao.divisao.forEach((s, i) => {
    const y = doc.y;
    doc
      .rect(margem, y - 3, larguraUtil, 16)
      .fill(i % 2 === 0 ? COR.cream50 : COR.cream100);
    doc.fillColor(COR.stone900).text(s.nome, colunasDivisao[0].x, y, { width: colunasDivisao[0].largura, lineBreak: false });
    doc.text(`${s.percentual}%`, colunasDivisao[1].x, y, { width: colunasDivisao[1].largura, lineBreak: false });
    doc
      .fillColor(s.valor < 0 ? COR.red : COR.green800)
      .font('Helvetica-Bold')
      .text(formatarMoeda(s.valor), colunasDivisao[2].x, y, { width: colunasDivisao[2].largura, lineBreak: false, align: 'right' })
      .font('Helvetica');
    doc.y = y + 16;
    doc.x = margem;
  });

  doc.end();
  return finalizado;
}
