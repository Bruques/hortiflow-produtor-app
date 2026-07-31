export interface Venda {
  id: string;
  data: string;
  quantidade: string;
  preco: string;
  total: string;
  comprador: string | null;
  pago: boolean;
  unidade_id: string;
  unidade_nome: string;
  regras_aplicadas: string[];
  // true quando a data da venda já caiu dentro de um Acerto registrado — editar/excluir
  // vai receber 409 do backend (docs/specs/06-acerto.md), então a tela usa isso pra travar
  // a ação de antemão em vez de só reagir ao erro.
  coberta_por_acerto: boolean;
}
