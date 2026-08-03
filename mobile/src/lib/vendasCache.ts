import { getDatabase } from './database';
import type { Venda, VendaLocal } from '../types/venda';

interface VendaRow {
  id: string;
  safra_id: string;
  data: string;
  quantidade: string;
  preco: string;
  total: string;
  comprador: string | null;
  pago: number;
  unidade_id: string;
  unidade_nome: string;
  regras_aplicadas: string;
  coberta_por_acerto: number;
  pendente_operacao: 'criar' | 'editar' | null;
  fila_id: string | null;
  fila_status: 'pendente' | 'sincronizado' | 'erro' | null;
  fila_erro: string | null;
}

function converterLinha(row: VendaRow): VendaLocal {
  return {
    id: row.id,
    data: row.data,
    quantidade: row.quantidade,
    preco: row.preco,
    total: row.total,
    comprador: row.comprador,
    pago: row.pago === 1,
    unidade_id: row.unidade_id,
    unidade_nome: row.unidade_nome,
    regras_aplicadas: JSON.parse(row.regras_aplicadas) as string[],
    coberta_por_acerto: row.coberta_por_acerto === 1,
    pendenteOperacao: row.pendente_operacao,
    filaId: row.fila_id,
    erroSincronizacao: row.pendente_operacao && row.fila_status === 'erro' ? row.fila_erro : null,
  };
}

// Cache local de vendas, com leitura sempre feita via LEFT JOIN em `sync_queue`
// (mobile/src/lib/syncQueue.ts) — mesmo padrão de mobile/src/lib/despesasCache.ts
// (docs/specs/mobile/06-vendas-e-despesa-recorrente.md).
export async function obterVendasCache(safraId: string): Promise<VendaLocal[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<VendaRow>(
    `SELECT v.*, sq.status as fila_status, sq.erro as fila_erro
     FROM vendas_cache v
     LEFT JOIN sync_queue sq ON sq.id = v.fila_id
     WHERE v.safra_id = ?
     ORDER BY v.data DESC`,
    [safraId]
  );
  return rows.map(converterLinha);
}

// Estado atual de uma única venda no cache — usado por vendasQueue.ts antes de editar ou
// excluir, em vez de confiar só no "retrato" que a tela de lista capturou.
export async function obterVendaCachePorId(id: string): Promise<VendaLocal | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<VendaRow>(
    `SELECT v.*, sq.status as fila_status, sq.erro as fila_erro
     FROM vendas_cache v
     LEFT JOIN sync_queue sq ON sq.id = v.fila_id
     WHERE v.id = ?`,
    [id]
  );
  return row ? converterLinha(row) : null;
}

// Substitui só as vendas já confirmadas pelo servidor (pendente_operacao IS NULL) — preserva
// linhas locais ainda não sincronizadas, que não vêm nessa resposta.
export async function salvarVendasCache(safraId: string, vendas: Venda[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM vendas_cache WHERE safra_id = ? AND pendente_operacao IS NULL', [safraId]);
    for (const v of vendas) {
      await db.runAsync(
        `INSERT INTO vendas_cache
          (id, safra_id, data, quantidade, preco, total, comprador, pago, unidade_id, unidade_nome, regras_aplicadas, coberta_por_acerto, pendente_operacao, fila_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
        [
          v.id,
          safraId,
          v.data,
          v.quantidade,
          v.preco,
          v.total,
          v.comprador,
          v.pago ? 1 : 0,
          v.unidade_id,
          v.unidade_nome,
          JSON.stringify(v.regras_aplicadas),
          v.coberta_por_acerto ? 1 : 0,
        ]
      );
    }
  });
}

// Insere o registro otimista de uma venda criada offline (ou online, antes da confirmação do
// servidor) — aparece na lista imediatamente, com `pendenteOperacao: 'criar'` e
// `regras_aplicadas: []` (as despesas geradas por regra `POR_VENDA` nascem no servidor).
export async function inserirVendaLocalPendente(safraId: string, venda: VendaLocal): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO vendas_cache
      (id, safra_id, data, quantidade, preco, total, comprador, pago, unidade_id, unidade_nome, regras_aplicadas, coberta_por_acerto, pendente_operacao, fila_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      venda.id,
      safraId,
      venda.data,
      venda.quantidade,
      venda.preco,
      venda.total,
      venda.comprador,
      venda.pago ? 1 : 0,
      venda.unidade_id,
      venda.unidade_nome,
      JSON.stringify(venda.regras_aplicadas),
      venda.pendenteOperacao,
      venda.filaId,
    ]
  );
}

// Atualiza os campos de uma venda já existente no cache — usado tanto pra refletir uma edição
// otimista (pendenteOperacao: 'editar') quanto pra reescrever os dados de uma venda ainda
// `pendenteOperacao: 'criar'` (edição de item nunca sincronizado).
export async function atualizarVendaCache(
  id: string,
  campos: Pick<VendaLocal, 'data' | 'quantidade' | 'preco' | 'total' | 'comprador' | 'pago' | 'unidade_id' | 'unidade_nome'> & {
    pendenteOperacao: 'criar' | 'editar' | null;
    filaId: string | null;
  }
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE vendas_cache
     SET data = ?, quantidade = ?, preco = ?, total = ?, comprador = ?, pago = ?, unidade_id = ?, unidade_nome = ?, pendente_operacao = ?, fila_id = ?
     WHERE id = ?`,
    [
      campos.data,
      campos.quantidade,
      campos.preco,
      campos.total,
      campos.comprador,
      campos.pago ? 1 : 0,
      campos.unidade_id,
      campos.unidade_nome,
      campos.pendenteOperacao,
      campos.filaId,
      id,
    ]
  );
}

// Troca o registro local otimista (id gerado no aparelho) pelos dados definitivos do servidor
// após uma criação sincronizar com sucesso — muda inclusive o id da linha e preenche
// `regras_aplicadas` com o que o servidor de fato gerou.
export async function substituirVendaLocalPorServidor(safraId: string, idLocal: string, venda: Venda): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM vendas_cache WHERE id = ?', [idLocal]);
    await db.runAsync(
      `INSERT INTO vendas_cache
        (id, safra_id, data, quantidade, preco, total, comprador, pago, unidade_id, unidade_nome, regras_aplicadas, coberta_por_acerto, pendente_operacao, fila_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
      [
        venda.id,
        safraId,
        venda.data,
        venda.quantidade,
        venda.preco,
        venda.total,
        venda.comprador,
        venda.pago ? 1 : 0,
        venda.unidade_id,
        venda.unidade_nome,
        JSON.stringify(venda.regras_aplicadas),
        venda.coberta_por_acerto ? 1 : 0,
      ]
    );
  });
}

// Confirma uma edição depois que o servidor aceitou — mesmo id, some o estado de pendência.
export async function confirmarEdicaoVenda(venda: Venda): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE vendas_cache
     SET data = ?, quantidade = ?, preco = ?, total = ?, comprador = ?, pago = ?, unidade_id = ?, unidade_nome = ?, regras_aplicadas = ?, coberta_por_acerto = ?, pendente_operacao = NULL, fila_id = NULL
     WHERE id = ?`,
    [
      venda.data,
      venda.quantidade,
      venda.preco,
      venda.total,
      venda.comprador,
      venda.pago ? 1 : 0,
      venda.unidade_id,
      venda.unidade_nome,
      JSON.stringify(venda.regras_aplicadas),
      venda.coberta_por_acerto ? 1 : 0,
      venda.id,
    ]
  );
}

export async function removerVendaCache(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM vendas_cache WHERE id = ?', [id]);
}
