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

// Task 23 — item do catálogo de sócios da Sociedade (com ou sem conta), sem percentual —
// usado pra "reaproveitar sócio já cadastrado" ao montar os sócios de uma nova Safra.
// `usuario_id` permite identificar "qual sou eu" na lista pra pré-adicionar o financiador
// automaticamente, sem depender de comparar nomes (que podem repetir).
export interface SocioCatalogo {
  id: string;
  usuario_id: string | null;
  nome: string;
  papel: PapelSocio;
}
