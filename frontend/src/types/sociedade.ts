export type PapelSocio = 'FINANCIADOR' | 'MEEIRO' | 'MISTO';

export interface Sociedade {
  id: string;
  nome: string;
  codigo_convite: string;
  percentual_lucro: string;
  papel: PapelSocio;
}

export interface Socio {
  usuario_id: string;
  nome: string;
  telefone: string;
  percentual_lucro: string;
  papel: PapelSocio;
}
