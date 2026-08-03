// Copiado manualmente de frontend/src/types/acerto.ts — mobile/ e frontend/ não
// compartilham tipos entre si (docs/specs/mobile/00-setup-e-infra.md).
export type TipoAcerto = 'PARCIAL' | 'FINAL';

export interface AcertoSocioDetalhe {
  socio_id: string;
  nome: string;
  despesas_bancadas: number;
  percentual_aplicado: number;
  valor_lucro: number;
}

export interface AcertoResumo {
  id: string;
  data_inicio: string;
  data_fim: string;
  tipo: TipoAcerto;
  criado_em: string;
}

export interface AcertoDetalhado extends AcertoResumo {
  safra_id: string;
  receita: number;
  despesas: number;
  lucroLiquido: number;
  socios: AcertoSocioDetalhe[];
}
