// Copiado manualmente de frontend/src/types/venda.ts — mobile/ e frontend/ não
// compartilham tipos entre si (docs/specs/mobile/00-setup-e-infra.md).
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
  // vai receber 409 do backend, então a tela usa isso pra travar a ação de antemão em vez
  // de só reagir ao erro (docs/specs/mobile/06-vendas-e-despesa-recorrente.md).
  coberta_por_acerto: boolean;
}

// Estado de sincronização de uma venda que existe no cache local (mobile/src/lib/vendasCache.ts) —
// mesmo padrão de DespesaLocal (mobile/src/types/despesa.ts). `regras_aplicadas` de uma venda
// ainda `pendenteOperacao: 'criar'` fica sempre vazio: as despesas geradas por regra `POR_VENDA`
// nascem no servidor durante a sincronização, nunca calculadas no cliente (spec `06`, regra
// "Venda é operação offline").
export interface VendaLocal extends Venda {
  pendenteOperacao: 'criar' | 'editar' | null;
  filaId: string | null;
  erroSincronizacao: string | null;
}
