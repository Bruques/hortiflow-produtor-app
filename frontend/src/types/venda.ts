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
}
