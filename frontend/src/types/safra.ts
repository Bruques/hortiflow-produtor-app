export type StatusSafra = 'PLANEJADA' | 'EM_ANDAMENTO' | 'ENCERRADA';

export interface Safra {
  id: string;
  sociedade_id: string;
  nome: string;
  observacoes: string | null;
  status: StatusSafra;
  data_inicio: string | null;
  data_fim: string | null;
}

// Retorno de GET /safras (todas as safras do usuário, entre todas as sociedades que
// participa) — carrega o nome da sociedade porque a tela de listagem pós-login precisa
// mostrar de qual propriedade é cada safra quando o usuário tem mais de uma.
export interface MinhaSafra extends Safra {
  sociedade_nome: string;
}
