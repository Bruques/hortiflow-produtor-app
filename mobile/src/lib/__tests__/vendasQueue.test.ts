import { criarVenda, registrarProcessadoresVendas } from '../vendasQueue';
import { enfileirar, listarPendentes, sincronizarTudo } from '../syncQueue';
import { criarVendaRequest } from '../../services/vendas';
import type { Venda } from '../../types/venda';

// Mesmo fake mínimo de banco em memória usado em despesasQueue.test.ts, só pra tabela
// sync_queue — esta suíte testa a camada de negócio de vendas por cima da fila genérica
// (docs/specs/mobile/06-vendas-e-despesa-recorrente.md, critério de aceite 14), não a fila em
// si (já coberta pela suíte da spec 00).
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

// A camada de cache (SQLite) é testada à parte — aqui só garante que vendasQueue chama a
// função certa, sem reimplementar o banco fake pra outra tabela.
jest.mock('../vendasCache', () => ({
  inserirVendaLocalPendente: jest.fn(),
  substituirVendaLocalPorServidor: jest.fn(),
  atualizarVendaCache: jest.fn(),
  confirmarEdicaoVenda: jest.fn(),
  removerVendaCache: jest.fn(),
}));

jest.mock('../../services/vendas', () => ({
  criarVendaRequest: jest.fn(),
  atualizarVendaRequest: jest.fn(),
  excluirVendaRequest: jest.fn(),
}));

beforeEach(() => {
  mockTabela = [];
  jest.clearAllMocks();
  registrarProcessadoresVendas();
});

const vendaServidor: Venda = {
  id: 'venda-servidor-1',
  data: '2026-08-02',
  quantidade: '10',
  preco: '15.00',
  total: '150.00',
  comprador: 'Ceasa Betim',
  pago: false,
  unidade_id: 'un-1',
  unidade_nome: 'Caixa',
  // Gerado pelo servidor durante a sincronização — nunca calculado no cliente
  // (docs/specs/mobile/06-vendas-e-despesa-recorrente.md, "Venda é operação offline").
  regras_aplicadas: ['regra-1'],
  coberta_por_acerto: false,
};

describe('vendasQueue', () => {
  it('enfileira uma venda com todos os campos exigidos pelo backend e não calcula despesas geradas no cliente', async () => {
    (criarVendaRequest as jest.Mock).mockResolvedValue({ venda: vendaServidor });

    await criarVenda(
      'safra-1',
      {
        data: '2026-08-02',
        quantidade: 10,
        preco: 15,
        comprador: 'Ceasa Betim',
        unidade_id: 'un-1',
        pago: false,
        regras_por_venda_aplicadas: ['regra-1'],
      },
      'Caixa'
    );

    // O que chegou ao backend carrega tudo que ele exige (contrato de POST /safras/:id/vendas)
    // — e nenhum campo de despesa gerada, já que isso nasce no servidor.
    expect(criarVendaRequest).toHaveBeenCalledWith('safra-1', {
      data: '2026-08-02',
      quantidade: 10,
      preco: 15,
      comprador: 'Ceasa Betim',
      unidade_id: 'un-1',
      pago: false,
      regras_por_venda_aplicadas: ['regra-1'],
    });

    const pendentes = await listarPendentes('venda.criar');
    expect(pendentes).toHaveLength(0);
    expect(mockTabela[0].status).toBe('sincronizado');
  });

  it('marca só o item que falhou como erro, sem travar os demais itens pendentes da fila', async () => {
    await enfileirar('venda.criar', {
      localId: 'local-1',
      safraId: 'safra-1',
      data: '2026-08-02',
      quantidade: 10,
      preco: 15,
      unidade_id: 'un-1',
    });
    await enfileirar('venda.criar', {
      localId: 'local-2',
      safraId: 'safra-1',
      data: '2026-08-02',
      quantidade: 5,
      preco: 20,
      unidade_id: 'un-1',
    });

    (criarVendaRequest as jest.Mock).mockImplementation(async (_safraId, input) => {
      if (input.quantidade === 10) throw new Error('422: unidade inválida');
      return { venda: { ...vendaServidor, quantidade: String(input.quantidade) } };
    });

    await sincronizarTudo();

    const comFalha = mockTabela.find((l) => JSON.parse(l.payload).localId === 'local-1')!;
    const comSucesso = mockTabela.find((l) => JSON.parse(l.payload).localId === 'local-2')!;
    expect(comFalha.status).toBe('erro');
    expect(comFalha.erro).toContain('422');
    expect(comSucesso.status).toBe('sincronizado');
  });
});
