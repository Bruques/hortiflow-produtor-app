import { criarDespesaPessoal, registrarProcessadoresDespesasPessoais } from '../despesasPessoaisQueue';
import { enfileirar, listarPendentes, sincronizarTudo } from '../syncQueue';
import { criarDespesaPessoalRequest } from '../../services/despesasPessoais';
import type { DespesaPessoal } from '../../types/despesa';

// Mesmo fake mínimo de banco em memória usado em despesasQueue.test.ts, só pra sync_queue.
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
      if (sql.includes('status IN')) {
        const [operacao] = params as [string];
        return mockTabela.filter((l) => l.operacao === operacao && (l.status === 'pendente' || l.status === 'erro'));
      }
      if (sql.includes('AND operacao')) {
        const [status, operacao] = params as [string, string];
        return mockTabela.filter((l) => l.status === status && l.operacao === operacao);
      }
      const [status] = params as [string];
      return mockTabela.filter((l) => l.status === status);
    },
  }),
}));

jest.mock('../despesasPessoaisCache', () => ({
  inserirDespesaPessoalLocalPendente: jest.fn(),
  substituirDespesaPessoalLocalPorServidor: jest.fn(),
  atualizarDespesaPessoalCache: jest.fn(),
  confirmarEdicaoDespesaPessoal: jest.fn(),
  removerDespesaPessoalCache: jest.fn(),
  obterDespesaPessoalCachePorId: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../services/despesasPessoais', () => ({
  criarDespesaPessoalRequest: jest.fn(),
  atualizarDespesaPessoalRequest: jest.fn(),
  excluirDespesaPessoalRequest: jest.fn(),
}));

beforeEach(() => {
  mockTabela = [];
  jest.clearAllMocks();
  registrarProcessadoresDespesasPessoais();
});

const despesaPessoalServidor: DespesaPessoal = {
  id: 'dp-servidor-1',
  tipo: 'OUTRO',
  valor: '80.00',
  data: '2026-09-05',
  descricao: 'Remédio',
};

describe('despesasPessoaisQueue', () => {
  // docs/specs/mobile/07-despesa-pessoal.md, critério de aceite 6 — despesa pessoal é sempre
  // 100% de quem lançou e nunca tem rateio; o payload enviado ao backend não pode carregar
  // socio_id de outro usuário nem campo de rateio algum (diferente de Despesa da sociedade).
  it('enfileira uma despesa pessoal sem socio_id nem rateio, e sincroniza quando o envio funciona', async () => {
    (criarDespesaPessoalRequest as jest.Mock).mockResolvedValue({ despesaPessoal: despesaPessoalServidor });

    await criarDespesaPessoal('safra-1', {
      tipo: 'OUTRO',
      valor: 80,
      data: '2026-09-05',
      descricao: 'Remédio',
    });

    expect(criarDespesaPessoalRequest).toHaveBeenCalledWith('safra-1', {
      tipo: 'OUTRO',
      valor: 80,
      data: '2026-09-05',
      descricao: 'Remédio',
    });

    const payloadEnviado = JSON.parse(mockTabela[0].payload);
    expect(payloadEnviado).not.toHaveProperty('socio_id');
    expect(payloadEnviado).not.toHaveProperty('rateio');

    const pendentes = await listarPendentes('despesaPessoal.criar');
    expect(pendentes).toHaveLength(0);
    expect(mockTabela[0].status).toBe('sincronizado');
  });

  it('marca só o item que falhou como erro, sem travar os demais itens pendentes da fila', async () => {
    await enfileirar('despesaPessoal.criar', { localId: 'local-1', safraId: 'safra-1', tipo: 'OUTRO', valor: 10, data: '2026-09-05' });
    await enfileirar('despesaPessoal.criar', { localId: 'local-2', safraId: 'safra-1', tipo: 'OUTRO', valor: 20, data: '2026-09-05' });

    (criarDespesaPessoalRequest as jest.Mock).mockImplementation(async (_safraId, input) => {
      if (input.valor === 10) throw new Error('400: valor inválido');
      return { despesaPessoal: { ...despesaPessoalServidor, valor: String(input.valor) } };
    });

    await sincronizarTudo();

    const comFalha = mockTabela.find((l) => JSON.parse(l.payload).localId === 'local-1')!;
    const comSucesso = mockTabela.find((l) => JSON.parse(l.payload).localId === 'local-2')!;
    expect(comFalha.status).toBe('erro');
    expect(comSucesso.status).toBe('sincronizado');
  });
});
