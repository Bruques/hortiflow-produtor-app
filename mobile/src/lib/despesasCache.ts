import { getDatabase } from './database';
import type { Despesa, DespesaLocal, ItemRateio, StatusPagamento, TipoDespesa } from '../types/despesa';

interface DespesaRow {
  id: string;
  safra_id: string;
  socio_id: string;
  socio_nome: string;
  tipo: TipoDespesa;
  valor: string;
  data: string;
  foto_comprovante: string | null;
  descricao: string | null;
  rateio: string | null;
  coberta_por_acerto: number;
  pendente_operacao: 'criar' | 'editar' | null;
  fila_id: string | null;
  fila_status: 'pendente' | 'sincronizado' | 'erro' | null;
  fila_erro: string | null;
  status_pagamento: StatusPagamento;
  data_vencimento: string | null;
  data_pagamento: string | null;
}

function converterLinha(row: DespesaRow): DespesaLocal {
  return {
    id: row.id,
    socio_id: row.socio_id,
    socio_nome: row.socio_nome,
    tipo: row.tipo,
    valor: row.valor,
    data: row.data,
    foto_comprovante: row.foto_comprovante,
    descricao: row.descricao,
    rateio: row.rateio ? (JSON.parse(row.rateio) as ItemRateio[]) : null,
    coberta_por_acerto: row.coberta_por_acerto === 1,
    pendenteOperacao: row.pendente_operacao,
    filaId: row.fila_id,
    erroSincronizacao: row.pendente_operacao && row.fila_status === 'erro' ? row.fila_erro : null,
    status_pagamento: row.status_pagamento,
    data_vencimento: row.data_vencimento,
    data_pagamento: row.data_pagamento,
  };
}

// Cache local de despesas, com leitura sempre feita via LEFT JOIN em `sync_queue`
// (mobile/src/lib/syncQueue.ts) — é o que permite saber, sem duplicar estado em outro lugar,
// se um item ainda pendente já falhou uma sincronização (docs/specs/mobile/
// 04-despesas-da-sociedade.md, critério de aceite 4).
export async function obterDespesasCache(safraId: string): Promise<DespesaLocal[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DespesaRow>(
    `SELECT d.*, sq.status as fila_status, sq.erro as fila_erro
     FROM despesas_cache d
     LEFT JOIN sync_queue sq ON sq.id = d.fila_id
     WHERE d.safra_id = ?
     ORDER BY d.data DESC`,
    [safraId]
  );
  return rows.map(converterLinha);
}

// Estado atual de uma única despesa no cache — usado por `despesasQueue.ts` antes de editar ou
// excluir, em vez de confiar só no "retrato" que a tela de lista capturou quando o produtor
// tocou no item (que pode ter ficado desatualizado se algo sincronizou por baixo nesse meio-tempo).
export async function obterDespesaCachePorId(id: string): Promise<DespesaLocal | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<DespesaRow>(
    `SELECT d.*, sq.status as fila_status, sq.erro as fila_erro
     FROM despesas_cache d
     LEFT JOIN sync_queue sq ON sq.id = d.fila_id
     WHERE d.id = ?`,
    [id]
  );
  return row ? converterLinha(row) : null;
}

// Substitui só as despesas já confirmadas pelo servidor (pendente_operacao IS NULL) —
// preserva linhas locais ainda não sincronizadas, que não vêm nessa resposta (spec 00: toda
// tela lista o que está salvo localmente primeiro, sem perder escrita ainda não enviada).
export async function salvarDespesasCache(safraId: string, despesas: Despesa[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM despesas_cache WHERE safra_id = ? AND pendente_operacao IS NULL', [safraId]);
    for (const d of despesas) {
      await db.runAsync(
        `INSERT INTO despesas_cache
          (id, safra_id, socio_id, socio_nome, tipo, valor, data, foto_comprovante, descricao, rateio, coberta_por_acerto, pendente_operacao, fila_id, status_pagamento, data_vencimento, data_pagamento)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
        [
          d.id,
          safraId,
          d.socio_id,
          d.socio_nome,
          d.tipo,
          d.valor,
          d.data,
          d.foto_comprovante,
          d.descricao,
          d.rateio ? JSON.stringify(d.rateio) : null,
          d.coberta_por_acerto ? 1 : 0,
          // `?? null`: um backend momentaneamente desatualizado (ex: staging antes de um
          // deploy) pode responder sem esses 3 campos (spec 19) — expo-sqlite rejeita bind de
          // `undefined`, então sem isso a transação inteira falhava e apagava o cache local
          // sem repor nada (bug relatado 2026-08-27).
          d.status_pagamento ?? 'PAGO',
          d.data_vencimento ?? null,
          d.data_pagamento ?? null,
        ]
      );
    }
  });
}

// Insere o registro otimista de uma despesa criada offline (ou online, antes da confirmação
// do servidor) — aparece na lista imediatamente, com `pendenteOperacao: 'criar'`.
export async function inserirDespesaLocalPendente(safraId: string, despesa: DespesaLocal): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO despesas_cache
      (id, safra_id, socio_id, socio_nome, tipo, valor, data, foto_comprovante, descricao, rateio, coberta_por_acerto, pendente_operacao, fila_id, status_pagamento, data_vencimento, data_pagamento)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    [
      despesa.id,
      safraId,
      despesa.socio_id,
      despesa.socio_nome,
      despesa.tipo,
      despesa.valor,
      despesa.data,
      despesa.foto_comprovante,
      despesa.descricao,
      despesa.rateio ? JSON.stringify(despesa.rateio) : null,
      despesa.pendenteOperacao,
      despesa.filaId,
      despesa.status_pagamento,
      despesa.data_vencimento,
      despesa.data_pagamento,
    ]
  );
}

// Atualiza os campos de uma despesa já existente no cache — usado tanto pra refletir uma
// edição otimista (pendenteOperacao: 'editar') quanto pra reescrever os dados de uma despesa
// ainda `pendenteOperacao: 'criar'` (edição de item nunca sincronizado, critério de aceite 9).
export async function atualizarDespesaCache(
  id: string,
  campos: Pick<
    DespesaLocal,
    'socio_id' | 'socio_nome' | 'tipo' | 'valor' | 'data' | 'foto_comprovante' | 'descricao' | 'rateio' | 'status_pagamento' | 'data_vencimento'
  > & {
    pendenteOperacao: 'criar' | 'editar' | null;
    filaId: string | null;
  }
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE despesas_cache
     SET socio_id = ?, socio_nome = ?, tipo = ?, valor = ?, data = ?, foto_comprovante = ?, descricao = ?, rateio = ?, pendente_operacao = ?, fila_id = ?, status_pagamento = ?, data_vencimento = ?
     WHERE id = ?`,
    [
      campos.socio_id,
      campos.socio_nome,
      campos.tipo,
      campos.valor,
      campos.data,
      campos.foto_comprovante,
      campos.descricao,
      campos.rateio ? JSON.stringify(campos.rateio) : null,
      campos.pendenteOperacao,
      campos.filaId,
      campos.status_pagamento,
      campos.data_vencimento,
      id,
    ]
  );
}

// Aplica só a transição de pagamento (status_pagamento/data_pagamento) sem tocar nos demais
// campos — usado tanto pelo "marcar como pago" otimista quanto pela confirmação vinda do
// servidor depois que a fila processa (docs/specs/19-despesa-pendente-e-parcelamento.md).
export async function atualizarStatusPagamentoCache(
  id: string,
  campos: {
    statusPagamento: StatusPagamento;
    dataPagamento: string | null;
    pendenteOperacao: 'criar' | 'editar' | null;
    filaId: string | null;
  }
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE despesas_cache SET status_pagamento = ?, data_pagamento = ?, pendente_operacao = ?, fila_id = ? WHERE id = ?',
    [campos.statusPagamento, campos.dataPagamento, campos.pendenteOperacao, campos.filaId, id]
  );
}

// Troca o registro local otimista (id gerado no aparelho) pelos dados definitivos do servidor
// após uma criação sincronizar com sucesso — muda inclusive o id da linha.
export async function substituirDespesaLocalPorServidor(
  safraId: string,
  idLocal: string,
  despesa: Despesa
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM despesas_cache WHERE id = ?', [idLocal]);
    await db.runAsync(
      `INSERT INTO despesas_cache
        (id, safra_id, socio_id, socio_nome, tipo, valor, data, foto_comprovante, descricao, rateio, coberta_por_acerto, pendente_operacao, fila_id, status_pagamento, data_vencimento, data_pagamento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
      [
        despesa.id,
        safraId,
        despesa.socio_id,
        despesa.socio_nome,
        despesa.tipo,
        despesa.valor,
        despesa.data,
        despesa.foto_comprovante,
        despesa.descricao,
        despesa.rateio ? JSON.stringify(despesa.rateio) : null,
        despesa.coberta_por_acerto ? 1 : 0,
        // `?? null` — mesmo motivo do comentário em salvarDespesasCache acima.
        despesa.status_pagamento ?? 'PAGO',
        despesa.data_vencimento ?? null,
        despesa.data_pagamento ?? null,
      ]
    );
  });
}

// Confirma uma edição depois que o servidor aceitou — mesmo id, some o estado de pendência.
export async function confirmarEdicaoDespesa(despesa: Despesa): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE despesas_cache
     SET socio_id = ?, socio_nome = ?, tipo = ?, valor = ?, data = ?, foto_comprovante = ?, descricao = ?, rateio = ?, coberta_por_acerto = ?, pendente_operacao = NULL, fila_id = NULL, status_pagamento = ?, data_vencimento = ?
     WHERE id = ?`,
    [
      despesa.socio_id,
      despesa.socio_nome,
      despesa.tipo,
      despesa.valor,
      despesa.data,
      despesa.foto_comprovante,
      despesa.descricao,
      despesa.rateio ? JSON.stringify(despesa.rateio) : null,
      despesa.coberta_por_acerto ? 1 : 0,
      // `?? null` — mesmo motivo do comentário em salvarDespesasCache acima.
      despesa.status_pagamento ?? 'PAGO',
      despesa.data_vencimento ?? null,
      despesa.id,
    ]
  );
}

export async function removerDespesaCache(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM despesas_cache WHERE id = ?', [id]);
}
