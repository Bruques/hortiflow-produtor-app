import PDFDocument from 'pdfkit';
import { TipoDespesa } from '@prisma/client';
import type { ResultadoDivisao } from './divisao.service';

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

// pdfkit não tem suporte nativo a tabelas — `continued: true` + `width` (tentativa inicial)
// quebra em múltiplas linhas em vez de alinhar colunas, porque `width` ali só limita
// wrap do texto corrente, não reserva uma coluna fixa. A forma correta é posicionar cada
// célula por coordenada X explícita, todas na mesma linha `y`, com `lineBreak: false`
// pra truncar em vez de quebrar (célula larga demais rouba espaço da próxima).
// Reseta `doc.x` pra margem esquerda ao final: posicionar texto por coordenada explícita
// deixa o cursor interno do pdfkit parado na última coluna escrita, o que estreitaria (pra
// só o espaço restante até a margem direita) o wrap de qualquer `doc.text` solto que venha
// depois sem x explícito (ex: os títulos de seção abaixo da tabela).
function linhaTabela(doc: PDFKit.PDFDocument, colunas: { texto: string; x: number; largura: number }[]): void {
  const y = doc.y;
  for (const c of colunas) {
    doc.text(c.texto, c.x, y, { width: c.largura, lineBreak: false });
  }
  doc.y = y + 14;
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

  doc.fontSize(18).font('Helvetica-Bold').text(`Relatório — ${dados.safra_nome}`);
  doc.fontSize(10).font('Helvetica').fillColor('#555').text(dados.sociedade_nome);
  doc.text(`Período: ${periodoLabel(dados)}`);
  doc.moveDown(1.2);

  // Bloco 1 — extrato de movimentação (o que interessa à contabilidade formal: dinheiro
  // que efetivamente entrou/saiu do caixa do financiador).
  doc.fillColor('#000').fontSize(13).font('Helvetica-Bold').text('Despesas');
  doc.moveDown(0.3);
  if (dados.despesas.length === 0) {
    doc.fontSize(10).font('Helvetica').text('Nenhuma despesa no período.');
  } else {
    const colunas = [
      { x: margem, largura: 60 },
      { x: margem + 65, largura: 130 },
      { x: margem + 200, largura: 150 },
      { x: margem + 355, largura: 90 },
    ];
    doc.fontSize(9).font('Helvetica-Bold');
    linhaTabela(doc, [
      { texto: 'Data', ...colunas[0] },
      { texto: 'Tipo', ...colunas[1] },
      { texto: 'Sócio', ...colunas[2] },
      { texto: 'Valor', ...colunas[3] },
    ]);
    doc.font('Helvetica');
    for (const d of dados.despesas) {
      linhaTabela(doc, [
        { texto: formatarData(d.data), ...colunas[0] },
        { texto: ROTULO_TIPO_DESPESA[d.tipo], ...colunas[1] },
        { texto: d.socio_nome, ...colunas[2] },
        { texto: formatarMoeda(d.valor), ...colunas[3] },
      ]);
    }
  }
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica-Bold').text(`Total de despesas: ${formatarMoeda(dados.divisao.despesas)}`);
  doc.moveDown(1);

  doc.fontSize(13).font('Helvetica-Bold').text('Vendas');
  doc.moveDown(0.3);
  if (dados.vendas.length === 0) {
    doc.fontSize(10).font('Helvetica').text('Nenhuma venda no período.');
  } else {
    const colunas = [
      { x: margem, largura: 60 },
      { x: margem + 65, largura: 130 },
      { x: margem + 200, largura: 80 },
      { x: margem + 285, largura: 80 },
      { x: margem + 370, largura: 90 },
    ];
    doc.fontSize(9).font('Helvetica-Bold');
    linhaTabela(doc, [
      { texto: 'Data', ...colunas[0] },
      { texto: 'Unidade/Qtd', ...colunas[1] },
      { texto: 'Preço', ...colunas[2] },
      { texto: 'Status', ...colunas[3] },
      { texto: 'Total', ...colunas[4] },
    ]);
    doc.font('Helvetica');
    for (const v of dados.vendas) {
      linhaTabela(doc, [
        { texto: formatarData(v.data), ...colunas[0] },
        { texto: `${v.quantidade} ${v.unidade_nome}`, ...colunas[1] },
        { texto: formatarMoeda(v.preco), ...colunas[2] },
        { texto: v.pago ? 'Paga' : 'A receber', ...colunas[3] },
        { texto: formatarMoeda(v.total), ...colunas[4] },
      ]);
    }
  }
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica-Bold').text(`Total de vendas: ${formatarMoeda(dados.divisao.receita)}`);
  doc.moveDown(1.5);

  // Bloco 2 — resumo de divisão entre sócios: acordo interno da parceria, não é fato
  // fiscal, mas é o que ajuda o financiador a saber quanto descontar/pagar no acerto.
  doc.fontSize(13).font('Helvetica-Bold').text('Resumo de divisão entre sócios');
  doc.fontSize(9).font('Helvetica-Oblique').fillColor('#555').text(
    'Simulação interna da parceria, calculada a partir do percentual de lucro de cada sócio — não é um lançamento contábil.'
  );
  doc.fillColor('#000').moveDown(0.3);
  doc.fontSize(10).font('Helvetica').text(`Lucro líquido do período: ${formatarMoeda(dados.divisao.lucroLiquido)}`);
  doc.moveDown(0.3);
  const colunasDivisao = [
    { x: margem, largura: 220 },
    { x: margem + 220, largura: 100 },
    { x: margem + 320, largura: 120 },
  ];
  doc.fontSize(9).font('Helvetica-Bold');
  linhaTabela(doc, [
    { texto: 'Sócio', ...colunasDivisao[0] },
    { texto: 'Percentual', ...colunasDivisao[1] },
    { texto: 'Valor', ...colunasDivisao[2] },
  ]);
  doc.font('Helvetica');
  for (const s of dados.divisao.divisao) {
    linhaTabela(doc, [
      { texto: s.nome, ...colunasDivisao[0] },
      { texto: `${s.percentual}%`, ...colunasDivisao[1] },
      { texto: formatarMoeda(s.valor), ...colunasDivisao[2] },
    ]);
  }

  doc.end();
  return finalizado;
}
