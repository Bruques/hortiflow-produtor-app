// Copiado manualmente de frontend/src/types/importacao.ts — mobile/ e frontend/ não
// compartilham tipos entre si (docs/specs/mobile/00-setup-e-infra.md).
import type { TipoDespesa } from './despesa';

export type TipoLancamentoSugerido = 'DESPESA' | 'VENDA';
export type ConfiancaImportacao = 'ALTA' | 'BAIXA';

// Espelha a resposta de POST /safras/:id/importacao/extrair (docs/specs/24 web,
// docs/specs/mobile/12 aqui) — nada aqui é persistido no banco, vive só em memória da tela.
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
