import { getDatabase } from './database';

export type SyncQueueStatus = 'pendente' | 'sincronizado' | 'erro';

export interface SyncQueueItem {
  id: string;
  operacao: string;
  payload: unknown;
  status: SyncQueueStatus;
  tentativas: number;
  erro: string | null;
  criado_em: string;
}

interface SyncQueueRow {
  id: string;
  operacao: string;
  payload: string;
  status: SyncQueueStatus;
  tentativas: number;
  erro: string | null;
  criado_em: string;
}

function gerarId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function converterLinha(row: SyncQueueRow): SyncQueueItem {
  return { ...row, payload: JSON.parse(row.payload) };
}

// Mecanismo genérico: "salvar localmente + marcar como pendente + tentar enviar quando
// houver conexão" (docs/specs/mobile/00-setup-e-infra.md). Nenhuma regra de negócio aqui —
// cada spec de escrita (despesas, vendas) chama `enfileirar` com sua própria `operacao` e
// registra como processá-la via `registrarProcessador`.
export async function enfileirar(operacao: string, payload: unknown): Promise<string> {
  const db = await getDatabase();
  const id = gerarId();
  await db.runAsync(
    'INSERT INTO sync_queue (id, operacao, payload, status, tentativas, criado_em) VALUES (?, ?, ?, ?, ?, ?)',
    [id, operacao, JSON.stringify(payload), 'pendente', 0, new Date().toISOString()]
  );
  return id;
}

// Usado pela UI para mostrar o que ainda não foi confirmado pelo servidor (badge "pendente
// de sincronização") — só status `pendente`, não inclui itens que já falharam uma vez.
export async function listarPendentes(operacao?: string): Promise<SyncQueueItem[]> {
  const db = await getDatabase();
  const rows = operacao
    ? await db.getAllAsync<SyncQueueRow>(
        'SELECT * FROM sync_queue WHERE status = ? AND operacao = ? ORDER BY criado_em ASC',
        ['pendente', operacao]
      )
    : await db.getAllAsync<SyncQueueRow>('SELECT * FROM sync_queue WHERE status = ? ORDER BY criado_em ASC', [
        'pendente',
      ]);
  return rows.map(converterLinha);
}

// Itens elegíveis a (re)tentar envio: pendentes de verdade, ou que já falharam uma vez —
// uma falha de rede é comum e não deve exigir ação manual do produtor para tentar de novo
// na próxima reconexão (só uma falha permanente, tipo 422, ficaria "presa" aqui, e mesmo
// assim tentar de novo é inofensivo).
async function listarParaProcessar(operacao: string): Promise<SyncQueueItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SyncQueueRow>(
    "SELECT * FROM sync_queue WHERE operacao = ? AND status IN ('pendente', 'erro') ORDER BY criado_em ASC",
    [operacao]
  );
  return rows.map(converterLinha);
}

export async function marcarSincronizado(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE sync_queue SET status = ? WHERE id = ?', ['sincronizado', id]);
}

export async function marcarErro(id: string, mensagem: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE sync_queue SET status = ?, tentativas = tentativas + 1, erro = ? WHERE id = ?', [
    'erro',
    mensagem,
    id,
  ]);
}

export async function removerItem(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
}

// Processa os itens elegíveis de uma operação, um a um: se `enviar` for bem-sucedido, marca
// como sincronizado; se falhar, marca erro naquele item específico e segue para o próximo —
// uma falha isolada nunca trava o restante da fila (critério de aceite da spec 00).
export async function processarPendentes(
  operacao: string,
  enviar: (payload: unknown) => Promise<void>
): Promise<void> {
  const itens = await listarParaProcessar(operacao);
  for (const item of itens) {
    try {
      await enviar(item.payload);
      await marcarSincronizado(item.id);
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido ao sincronizar';
      await marcarErro(item.id, mensagem);
    }
  }
}

// Registro de processadores por operação: cada spec de escrita (despesas, vendas) registra
// como enviar o próprio tipo de item uma vez, no bootstrap do app — o disparo automático ao
// reconectar (syncTrigger.ts) não precisa saber nada de despesa/venda, só percorre o registro.
type Processador = (payload: unknown) => Promise<void>;
const processadores = new Map<string, Processador>();

export function registrarProcessador(operacao: string, processador: Processador): void {
  processadores.set(operacao, processador);
}

export async function sincronizarTudo(): Promise<void> {
  for (const [operacao, processador] of processadores) {
    await processarPendentes(operacao, processador);
  }
}
