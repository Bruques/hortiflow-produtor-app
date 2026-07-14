export type StatusSafra = 'PLANEJADA' | 'EM_ANDAMENTO' | 'ENCERRADA';

export interface Safra {
  id: string;
  sociedade_id: string;
  nome: string;
  status: StatusSafra;
  data_inicio: string | null;
  data_fim: string | null;
}
