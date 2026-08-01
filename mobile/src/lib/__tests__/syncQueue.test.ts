import { enfileirar, processarPendentes, listarPendentes, registrarProcessador, sincronizarTudo } from '../syncQueue';

// Fake mínimo do banco em memória, só com o suficiente para as queries que syncQueue.ts
// emite — evita depender do módulo nativo expo-sqlite dentro do Jest (docs/specs/mobile/
// 00-setup-e-infra.md pede teste unitário da fila, não teste de integração com SQLite real).
// Nome com prefixo "mock" é exigido pelo Jest para variáveis referenciadas dentro de jest.mock().
interface LinhaFake {
  id: string;
  operacao: string;
  payload: string;
  status: string;
  tentativas: number;
  erro: string | null;
  criado_em: string;
}

let mockTabela: LinhaFake[] = [];

jest.mock('../database', () => ({
  getDatabase: async () => ({
    runAsync: async (sql: string, params: unknown[]) => {
      if (sql.startsWith('INSERT')) {
        const [id, operacao, payload, status, tentativas, criado_em] = params as [
          string,
          string,
          string,
          string,
          number,
          string,
        ];
        mockTabela.push({ id, operacao, payload, status, tentativas, erro: null, criado_em });
      } else if (sql.includes('SET status = ?, tentativas')) {
        const [status, erro, id] = params as [string, string, string];
        const linha = mockTabela.find((l) => l.id === id);
        if (linha) {
          linha.status = status;
          linha.erro = erro;
          linha.tentativas += 1;
        }
      } else if (sql.startsWith('UPDATE sync_queue SET status')) {
        const [status, id] = params as [string, string];
        const linha = mockTabela.find((l) => l.id === id);
        if (linha) linha.status = status;
      } else if (sql.startsWith('DELETE')) {
        const [id] = params as [string];
        mockTabela = mockTabela.filter((l) => l.id !== id);
      }
    },
    getAllAsync: async (sql: string, params: unknown[]) => {
      // listarParaProcessar: WHERE operacao = ? AND status IN ('pendente', 'erro') — só 1 param
      if (sql.includes("status IN")) {
        const [operacao] = params as [string];
        return mockTabela.filter((l) => l.operacao === operacao && (l.status === 'pendente' || l.status === 'erro'));
      }
      // listarPendentes com filtro de operação: WHERE status = ? AND operacao = ?
      if (sql.includes('AND operacao')) {
        const [status, operacao] = params as [string, string];
        return mockTabela.filter((l) => l.status === status && l.operacao === operacao);
      }
      // listarPendentes sem filtro: WHERE status = ?
      const [status] = params as [string];
      return mockTabela.filter((l) => l.status === status);
    },
  }),
}));

beforeEach(() => {
  mockTabela = [];
});

describe('syncQueue', () => {
  it('enfileira um item como pendente', async () => {
    await enfileirar('despesa.criar', { valor: 100 });

    const pendentes = await listarPendentes('despesa.criar');
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].status).toBe('pendente');
    expect(pendentes[0].payload).toEqual({ valor: 100 });
  });

  it('marca como sincronizado quando o envio funciona', async () => {
    await enfileirar('despesa.criar', { valor: 100 });

    await processarPendentes('despesa.criar', async () => {
      // sucesso — não lança erro
    });

    const pendentes = await listarPendentes('despesa.criar');
    expect(pendentes).toHaveLength(0);
  });

  it('mantém o item marcado (com erro) quando o envio falha, sem afetar os demais', async () => {
    await enfileirar('despesa.criar', { valor: 1 });
    await enfileirar('despesa.criar', { valor: 2 });

    await processarPendentes('despesa.criar', async (payload) => {
      const { valor } = payload as { valor: number };
      if (valor === 1) {
        throw new Error('Falha de rede simulada');
      }
    });

    const pendentesRestantes = await listarPendentes('despesa.criar');
    expect(pendentesRestantes).toHaveLength(0);

    const itemComFalha = mockTabela.find((l) => JSON.parse(l.payload).valor === 1)!;
    const itemComSucesso = mockTabela.find((l) => JSON.parse(l.payload).valor === 2)!;
    expect(itemComFalha.status).toBe('erro');
    expect(itemComFalha.tentativas).toBe(1);
    expect(itemComFalha.erro).toBe('Falha de rede simulada');
    expect(itemComSucesso.status).toBe('sincronizado');
  });

  it('tenta de novo um item que já falhou antes (retry automático)', async () => {
    await enfileirar('despesa.criar', { valor: 1 });
    await processarPendentes('despesa.criar', async () => {
      throw new Error('Falha de rede simulada');
    });
    expect(mockTabela[0].status).toBe('erro');

    await processarPendentes('despesa.criar', async () => {
      // dessa vez a conexão voltou de verdade
    });

    expect(mockTabela[0].status).toBe('sincronizado');
  });

  it('sincronizarTudo dispara o processador registrado para cada operação, sem precisar saber a regra de negócio', async () => {
    await enfileirar('despesa.criar', { valor: 10 });
    await enfileirar('venda.criar', { quantidade: 5 });

    const chamadas: string[] = [];
    registrarProcessador('despesa.criar', async () => {
      chamadas.push('despesa.criar');
    });
    registrarProcessador('venda.criar', async () => {
      chamadas.push('venda.criar');
    });

    await sincronizarTudo();

    expect(chamadas.sort()).toEqual(['despesa.criar', 'venda.criar']);
    expect(mockTabela.every((l) => l.status === 'sincronizado')).toBe(true);
  });
});
