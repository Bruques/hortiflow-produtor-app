import { StatusSafra, StatusUsuario } from '@prisma/client';
import prisma from '../lib/prisma';
import { limiteEfetivo } from './assinatura.service';
import { DadosDashboard, montarDashboard } from '../lib/dashboardAdmin';

// Spec 28 — carrega do banco os dados brutos e entrega pra `montarDashboard`, que é quem
// decide o que conta como receita/ativo/atenção. Escala pequena de propósito (uma leitura
// completa dos usuários, sem paginação): o painel é de uso único do dono, com dezenas de
// produtores. Se passar de alguns milhares, aí sim vale agregar no banco.
export async function carregarDashboard() {
  const [usuarios, safrasEmAndamento, pagamentosOrfaos] = await Promise.all([
    prisma.usuario.findMany({
      where: { status: { not: StatusUsuario.EXCLUIDO } },
      select: {
        id: true,
        nome: true,
        telefone: true,
        criado_em: true,
        status: true,
        _count: { select: { sociedadesCriadas: true } },
        socioSociedades: { select: { sociedade: { select: { criado_por_usuario_id: true } } } },
        assinatura: { include: { plano: true, pagamentos: true } },
      },
    }),
    prisma.safra.findMany({
      where: { status: StatusSafra.EM_ANDAMENTO },
      select: { sociedade: { select: { criado_por_usuario_id: true } } },
    }),
    // Contas excluídas (spec 20): a assinatura fica sem usuário, ou o usuário fica anonimizado
    // como EXCLUIDO. Nos dois casos o dinheiro recebido continua valendo na receita.
    prisma.pagamento.findMany({
      where: { assinatura: { OR: [{ usuario_id: null }, { usuario: { status: StatusUsuario.EXCLUIDO } }] } },
      select: { valor: true, criado_em: true },
    }),
  ]);

  const safrasPorTitular = new Map<string, number>();
  for (const s of safrasEmAndamento) {
    const titular = s.sociedade.criado_por_usuario_id;
    safrasPorTitular.set(titular, (safrasPorTitular.get(titular) ?? 0) + 1);
  }

  const dados: DadosDashboard = {
    produtores: usuarios
      // Meeiro que só entrou pelo código de convite também ganha uma Assinatura de trial no
      // cadastro, mas não é cliente: não criou sociedade e nunca pagou. Fica fora da lista.
      // Cadastro novo que ainda não fez nada (sem sociedade alheia) continua dentro, porque é
      // justamente ele que o funil e a lista de atenção querem mostrar.
      .filter((u) => {
        const somenteConvidado =
          u._count.sociedadesCriadas === 0 &&
          u.socioSociedades.some((s) => s.sociedade.criado_por_usuario_id !== u.id) &&
          (u.assinatura?.pagamentos.length ?? 0) === 0;
        return !somenteConvidado;
      })
      .map((u) => {
        const a = u.assinatura;
        return {
          id: u.id,
          nome: u.nome,
          telefone: u.telefone,
          criadoEm: u.criado_em,
          bloqueado: u.status === StatusUsuario.BLOQUEADO,
          safrasAtivas: safrasPorTitular.get(u.id) ?? 0,
          assinatura: a
            ? {
                status: a.status,
                ciclo: a.ciclo,
                plano: a.plano ? { id: a.plano.id, nome: a.plano.nome } : null,
                dataFimAcesso: a.data_fim_acesso,
                renovacaoAutomatica: a.status !== 'CANCELADA' && Boolean(a.asaas_subscription_id || a.mp_preapproval_id),
                limiteSafras: limiteEfetivo(a),
                perfil: a.faixa_meeiros
                  ? {
                      faixaMeeiros: a.faixa_meeiros,
                      quantidadePes: a.quantidade_pes_morango,
                      localizacao: a.localizacao_producao,
                      localizacaoOutra: a.localizacao_producao_outra,
                    }
                  : null,
              }
            : null,
          pagamentos: (a?.pagamentos ?? []).map((x) => ({
            valor: Number(x.valor),
            metodo: x.metodo,
            periodoInicio: x.periodo_inicio,
            periodoFim: x.periodo_fim,
            criadoEm: x.criado_em,
          })),
        };
      }),
    pagamentosOrfaos: pagamentosOrfaos.map((x) => ({ valor: Number(x.valor), criadoEm: x.criado_em })),
  };

  return montarDashboard(dados, new Date());
}
