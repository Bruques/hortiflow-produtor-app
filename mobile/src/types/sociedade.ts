// Copiado manualmente de frontend/src/types/sociedade.ts — mobile/ e frontend/ não
// compartilham tipos entre si (docs/specs/mobile/00-setup-e-infra.md).
export type PapelSocio = 'FINANCIADOR' | 'MEEIRO' | 'MISTO';

export interface Sociedade {
  id: string;
  nome: string;
  codigo_convite: string;
  percentual_lucro: string;
  papel: PapelSocio;
}

export interface Socio {
  id: string;
  usuario_id: string | null;
  nome: string;
  telefone: string | null;
  percentual_lucro: string;
  papel: PapelSocio;
}

export interface SocioSemConta {
  id: string;
  nome: string;
  papel: PapelSocio;
}
