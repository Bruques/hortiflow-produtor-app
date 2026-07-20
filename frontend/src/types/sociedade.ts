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
