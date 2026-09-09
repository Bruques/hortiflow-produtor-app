import type { TipoDespesa } from '@/types/despesa';

export type TipoLancamentoSugerido = 'DESPESA' | 'VENDA';
export type ConfiancaImportacao = 'ALTA' | 'BAIXA';

// Espelha a resposta de POST /safras/:id/importacao/extrair (docs/specs/24) — nada aqui é
// persistido no banco, vive só em memória até o sócio confirmar linha por linha.
export interface LinhaExtraida {
  origem_arquivo_index: number;
  tipo_sugerido: TipoLancamentoSugerido;
  confianca: ConfiancaImportacao;
  data: string | null;
  tipo_despesa: TipoDespesa | null;
  valor: number | null;
  descricao: string | null;
  quantidade: number | null;
  unidade_nome_sugerido: string | null;
  preco: number | null;
  comprador: string | null;
  imagem_origem_base64?: string;
}

export interface RespostaExtracao {
  linhas: LinhaExtraida[];
  arquivos_sem_leitura: number[];
}
