// Copiado manualmente de frontend/src/types/despesa.ts — mobile/ e frontend/ não
// compartilham tipos entre si (docs/specs/mobile/00-setup-e-infra.md).
export type TipoDespesa =
  | 'TERRA'
  | 'MUDAS'
  | 'ADUBO'
  | 'DEFENSIVOS'
  | 'MAO_DE_OBRA'
  | 'EMBALAGEM'
  | 'TRANSPORTE'
  | 'OUTRO';

export interface ItemRateio {
  socio_id: string;
  socio_nome: string;
  percentual: number;
}

// docs/specs/19-despesa-pendente-e-parcelamento.md — não afeta calcularDivisao, só controle
// visual de quanto já foi pago x ainda vai ser (mesmo comportamento do web).
export type StatusPagamento = 'PAGO' | 'PENDENTE';

export interface Despesa {
  id: string;
  socio_id: string;
  socio_nome: string;
  tipo: TipoDespesa;
  valor: string;
  data: string;
  foto_comprovante: string | null;
  descricao: string | null;
  // null = rateio padrão (segue o percentual de lucro); array = rateio customizado dessa
  // despesa (docs/specs/13-rateio-de-despesas.md, web)
  rateio: ItemRateio[] | null;
  // true quando a despesa já está coberta por um Acerto — editar/excluir vai receber 409 do
  // backend, então a tela trava a ação de antemão (docs/specs/mobile/04-despesas-da-sociedade.md)
  coberta_por_acerto: boolean;
  status_pagamento: StatusPagamento;
  data_vencimento: string | null;
  data_pagamento: string | null;
}

// Estado de sincronização de um item que existe no cache local (mobile/src/lib/despesasCache.ts).
// `pendenteOperacao` só é não-nulo enquanto a criação/edição ainda não foi confirmada pelo
// servidor; `filaId` referencia o item correspondente em `sync_queue` (mobile/src/lib/syncQueue.ts)
// enquanto a operação for 'criar' — é o que permite editar/cancelar uma despesa que nunca
// chegou ao servidor sem tentar falar com ele (critério de aceite 9 da spec 04).
export interface DespesaLocal extends Despesa {
  pendenteOperacao: 'criar' | 'editar' | null;
  filaId: string | null;
  erroSincronizacao: string | null;
}
