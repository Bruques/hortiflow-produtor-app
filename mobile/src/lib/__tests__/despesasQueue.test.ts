import { criarDespesa, registrarProcessadoresDespesas } from '../despesasQueue';
import { enfileirar, listarPendentes, sincronizarTudo } from '../syncQueue';
import { criarDespesaRequest } from '../../services/despesas';
import type { Despesa } from '../../types/despesa';

// Mesmo fake mínimo de banco em memória usado em src/lib/__tests__/syncQueue.test.ts, só
// pra tabela sync_queue — esta suíte testa a camada de negócio de despesas por cima da fila
// genérica (docs/specs/mobile/04-despesas-da-sociedade.md, critério de aceite 12), não a
// fila em si (já coberta pela suíte da spec 00).
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

// A camada de cache (SQLite) é testada à parte — aqui só garante que despesasQueue chama a
// função certa, sem reimplementar o banco fake pra outra tabela.
jest.mock('../despesasCache', () => ({
  inserirDespesaLocalPendente: jest.fn(),
  substituirDespesaLocalPorServidor: jest.fn(),
  atualizarDespesaCache: jest.fn(),
  confirmarEdicaoDespesa: jest.fn(),
  removerDespesaCache: jest.fn(),
}));

jest.mock('../../services/despesas', () => ({
  criarDespesaRequest: jest.fn(),
  atualizarDespesaRequest: jest.fn(),
  excluirDespesaRequest: jest.fn(),
}));

beforeEach(() => {
  mockTabela = [];
  jest.clearAllMocks();
  registrarProcessadoresDespesas();
});

const despesaServidor: Despesa = {
  id: 'desp-servidor-1',
  socio_id: 'u-1',
  socio_nome: 'Eduardo Ramos',
  tipo: 'ADUBO',
  valor: '150.00',
  data: '2026-08-02',
  foto_comprovante: 'data:image/jpeg;base64,ZmFrZQ==',
  descricao: 'Adubo pro talhão 2',
  rateio: null,
  coberta_por_acerto: false,
};

describe('despesasQueue', () => {
  it('enfileira uma despesa com todos os campos exigidos pelo backend e sincroniza quando o envio funciona', async () => {
    (criarDespesaRequest as jest.Mock).mockResolvedValue({ despesa: despesaServidor });

    await criarDespesa(
      'safra-1',
      {
        socio_id: 'u-1',
        tipo: 'ADUBO',
        valor: 150,
        data: '2026-08-02',
        foto_comprovante: 'data:image/jpeg;base64,ZmFrZQ==',
        descricao: 'Adubo pro talhão 2',
        rateio: [{ socio_id: 'sc-1', percentual: 60 }, { socio_id: 'sc-2', percentual: 40 }],
      },
      'Eduardo Ramos',
      [
        { id: 'sc-1', nome: 'Eduardo Ramos' },
        { id: 'sc-2', nome: 'Ana Souza' },
      ]
    );

    // O que chegou ao backend carrega tudo que ele exige (docs/specs/mobile/
    // 04-despesas-da-sociedade.md, contrato de POST /safras/:id/despesas). `idempotency_key` é
    // o `localId` gerado pela fila, ecoado pro backend deduplicar um retry (ver despesasQueue.ts).
    expect(criarDespesaRequest).toHaveBeenCalledWith('safra-1', {
      socio_id: 'u-1',
      tipo: 'ADUBO',
      valor: 150,
      data: '2026-08-02',
      foto_comprovante: 'data:image/jpeg;base64,ZmFrZQ==',
      descricao: 'Adubo pro talhão 2',
      rateio: [{ socio_id: 'sc-1', percentual: 60 }, { socio_id: 'sc-2', percentual: 40 }],
      idempotency_key: expect.any(String),
    });

    // Transicionou pendente -> sincronizado (o item já não aparece mais como pendente).
    const pendentes = await listarPendentes('despesa.criar');
    expect(pendentes).toHaveLength(0);
    expect(mockTabela[0].status).toBe('sincronizado');
  });

  it('marca só o item que falhou como erro, sem travar os demais itens pendentes da fila', async () => {
    await enfileirar('despesa.criar', {
      localId: 'local-1',
      safraId: 'safra-1',
      socio_id: 'u-1',
      tipo: 'ADUBO',
      valor: 10,
      data: '2026-08-02',
    });
    await enfileirar('despesa.criar', {
      localId: 'local-2',
      safraId: 'safra-1',
      socio_id: 'u-1',
      tipo: 'ADUBO',
      valor: 20,
      data: '2026-08-02',
    });

    (criarDespesaRequest as jest.Mock).mockImplementation(async (_safraId, input) => {
      if (input.valor === 10) throw new Error('422: rateio não fecha 100%');
      return { despesa: { ...despesaServidor, valor: String(input.valor) } };
    });

    await sincronizarTudo();

    const comFalha = mockTabela.find((l) => JSON.parse(l.payload).localId === 'local-1')!;
    const comSucesso = mockTabela.find((l) => JSON.parse(l.payload).localId === 'local-2')!;
    expect(comFalha.status).toBe('erro');
    expect(comFalha.erro).toContain('422');
    expect(comSucesso.status).toBe('sincronizado');
  });
});
