// Spec 28 — todas as métricas do painel do dono, calculadas a partir de dados já carregados
// (função pura, sem banco). O carregamento fica em adminDashboard.service.ts; aqui só mora
// a regra de "o que conta como receita/ativo/atenção", pra poder testar sem Prisma e pra
// mudar uma definição sem mexer na query.

export type SituacaoProdutor = 'BLOQUEADA' | 'CANCELADA' | 'VENCIDA' | 'TRIAL_EXPIRADO' | 'EM_TRIAL' | 'ATIVA';

export interface PagamentoBruto {
  valor: number;
  metodo: string;
  periodoInicio: Date;
  periodoFim: Date;
  criadoEm: Date;
}

export interface ProdutorBruto {
  id: string;
  nome: string;
  telefone: string;
  criadoEm: Date;
  bloqueado: boolean;
  assinatura: {
    status: 'TRIAL' | 'ATIVA' | 'CANCELADA';
    ciclo: 'MENSAL' | 'ANUAL' | null;
    plano: { id: string; nome: string } | null;
    dataFimAcesso: Date;
    // true quando existe recorrência no gateway (Asaas/Mercado Pago preapproval). Cartão e
    // Pix avulsos do Checkout Pro NÃO são recorrentes: precisam de uma nova cobrança a cada ciclo.
    renovacaoAutomatica: boolean;
    limiteSafras: number | null;
    perfil: { faixaMeeiros: string; quantidadePes: number | null; localizacao: string | null; localizacaoOutra?: string | null } | null;
  } | null;
  safrasAtivas: number;
  pagamentos: PagamentoBruto[];
}

export interface DadosDashboard {
  produtores: ProdutorBruto[];
  // Pagamentos de contas já excluídas (spec 20): não têm produtor, mas seguem valendo na receita.
  pagamentosOrfaos: { valor: number; criadoEm: Date }[];
}

export type TipoAtencao = 'ACESSO_VENCIDO' | 'RENOVACAO_MANUAL' | 'TRIAL_ACABANDO' | 'ONBOARDING_PARADO';

const DIA_MS = 24 * 60 * 60 * 1000;
// Brasília não tem horário de verão desde 2019, então o fuso é um deslocamento fixo de -3h.
const BRASILIA_MS = -3 * 60 * 60 * 1000;
const SEMANAS_NO_GRAFICO = 20;
const MESES_NO_GRAFICO = 5;

function emBrasilia(d: Date): Date {
  return new Date(d.getTime() + BRASILIA_MS);
}

function chaveDoMes(ano: number, mesIndex: number): string {
  const d = new Date(Date.UTC(ano, mesIndex, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function mesDe(d: Date): string {
  const b = emBrasilia(d);
  return chaveDoMes(b.getUTCFullYear(), b.getUTCMonth());
}

// Meia-noite de segunda-feira (horário de Brasília) da semana da data, como instante real.
function inicioDaSemana(d: Date): Date {
  const b = emBrasilia(d);
  const diasDesdeSegunda = (b.getUTCDay() + 6) % 7;
  const segundaComoUtc = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() - diasDesdeSegunda);
  return new Date(segundaComoUtc - BRASILIA_MS);
}

function chaveDoDia(instante: Date): string {
  return emBrasilia(instante).toISOString().slice(0, 10);
}

export function situacaoDoProdutor(p: ProdutorBruto, agora: Date): SituacaoProdutor {
  if (p.bloqueado) return 'BLOQUEADA';
  const a = p.assinatura;
  if (!a) return 'VENCIDA';
  if (a.status === 'CANCELADA') return 'CANCELADA';
  if (a.dataFimAcesso < agora) return a.status === 'TRIAL' ? 'TRIAL_EXPIRADO' : 'VENCIDA';
  return a.status === 'TRIAL' ? 'EM_TRIAL' : 'ATIVA';
}

function diasAte(alvo: Date, agora: Date): number {
  return Math.ceil((alvo.getTime() - agora.getTime()) / DIA_MS);
}

function pagamentosPagos(p: ProdutorBruto): PagamentoBruto[] {
  return p.pagamentos.filter((x) => x.valor > 0);
}

function ultimoPagamento(p: ProdutorBruto): PagamentoBruto | null {
  if (p.pagamentos.length === 0) return null;
  return p.pagamentos.reduce((a, b) => (b.criadoEm > a.criadoEm ? b : a));
}

// Valor mensal equivalente de um pagamento: divide pelo número de meses que ele cobre
// (30 dias = 1 mês, 365 dias = 12). Usa o período de fato coberto, não o ciclo gravado,
// porque o pagamento manual aceita qualquer quantidade de dias.
function valorMensalEquivalente(pg: PagamentoBruto): number {
  const dias = (pg.periodoFim.getTime() - pg.periodoInicio.getTime()) / DIA_MS;
  const meses = Math.max(1, Math.round(dias / 30));
  return pg.valor / meses;
}

export function montarDashboard(dados: DadosDashboard, agora: Date) {
  const { produtores, pagamentosOrfaos } = dados;

  // --- Receita ---
  const todosOsPagamentos = [
    ...produtores.flatMap((p) => pagamentosPagos(p).map((x) => ({ valor: x.valor, criadoEm: x.criadoEm }))),
    ...pagamentosOrfaos.filter((x) => x.valor > 0),
  ];
  const b = emBrasilia(agora);
  const mesAtual = chaveDoMes(b.getUTCFullYear(), b.getUTCMonth());
  const mesAnterior = chaveDoMes(b.getUTCFullYear(), b.getUTCMonth() - 1);
  const somaDoMes = (chave: string) =>
    todosOsPagamentos.filter((x) => mesDe(x.criadoEm) === chave).reduce((acc, x) => acc + x.valor, 0);

  const situacoes = new Map(produtores.map((p) => [p.id, situacaoDoProdutor(p, agora)]));
  const ativos = produtores.filter((p) => situacoes.get(p.id) === 'ATIVA');

  const recorrenciaMensal = ativos.reduce((acc, p) => {
    const ultimo = ultimoPagamento(p);
    return acc + (ultimo ? valorMensalEquivalente(ultimo) : 0);
  }, 0);

  const resumo = {
    receitaMes: somaDoMes(mesAtual),
    receitaMesAnterior: somaDoMes(mesAnterior),
    receitaTotal: todosOsPagamentos.reduce((acc, x) => acc + x.valor, 0),
    recorrenciaMensal,
    ativos: ativos.length,
    emTrial: produtores.filter((p) => situacoes.get(p.id) === 'EM_TRIAL').length,
    cadastrados: produtores.length,
    cadastradosUltimos7Dias: produtores.filter((p) => p.criadoEm.getTime() > agora.getTime() - 7 * DIA_MS).length,
  };

  // --- Receita por mês (últimos 5 meses, o atual incluído) ---
  const receitaPorMes = [];
  for (let i = MESES_NO_GRAFICO - 1; i >= 0; i--) {
    const chave = chaveDoMes(b.getUTCFullYear(), b.getUTCMonth() - i);
    const doMes = todosOsPagamentos.filter((x) => mesDe(x.criadoEm) === chave);
    receitaPorMes.push({ mes: chave, valor: doMes.reduce((acc, x) => acc + x.valor, 0), pagamentos: doMes.length });
  }

  // --- Crescimento semanal acumulado ---
  const primeiroPagamentoDe = (p: ProdutorBruto): Date | null => {
    const pagos = pagamentosPagos(p);
    return pagos.length ? new Date(Math.min(...pagos.map((x) => x.criadoEm.getTime()))) : null;
  };
  const primeirosPagamentos = produtores.map(primeiroPagamentoDe).filter((d): d is Date => d !== null);
  const segundaAtual = inicioDaSemana(agora);
  const crescimentoSemanal = [];
  for (let i = SEMANAS_NO_GRAFICO - 1; i >= 0; i--) {
    const segunda = new Date(segundaAtual.getTime() - i * 7 * DIA_MS);
    const fimDaSemana = segunda.getTime() + 7 * DIA_MS;
    crescimentoSemanal.push({
      semana: chaveDoDia(segunda),
      cadastrados: produtores.filter((p) => p.criadoEm.getTime() < fimDaSemana).length,
      pagantes: primeirosPagamentos.filter((d) => d.getTime() < fimDaSemana).length,
    });
  }

  // --- Funil ---
  const funil = {
    cadastraram: produtores.length,
    responderamOnboarding: produtores.filter((p) => p.assinatura?.perfil).length,
    escolheramPlano: produtores.filter((p) => p.assinatura?.plano).length,
    pagaram: produtores.filter((p) => pagamentosPagos(p).length > 0).length,
  };

  // --- Precisa de atenção ---
  const prioridade: Record<TipoAtencao, number> = { ACESSO_VENCIDO: 0, RENOVACAO_MANUAL: 1, TRIAL_ACABANDO: 2, ONBOARDING_PARADO: 3 };
  const atencao: { usuarioId: string; tipo: TipoAtencao; titulo: string; detalhe: string }[] = [];
  for (const p of produtores) {
    const s = situacoes.get(p.id)!;
    const a = p.assinatura;
    if (!a) continue;
    const dias = diasAte(a.dataFimAcesso, agora);
    const plural = (n: number) => (n === 1 ? 'dia' : 'dias');

    if (s === 'VENCIDA' || s === 'TRIAL_EXPIRADO') {
      const atraso = Math.max(1, -Math.floor((a.dataFimAcesso.getTime() - agora.getTime()) / DIA_MS));
      atencao.push({
        usuarioId: p.id,
        tipo: 'ACESSO_VENCIDO',
        titulo: `${s === 'VENCIDA' ? 'Plano vencido' : 'Trial expirado'} há ${atraso} ${plural(atraso)}`,
        detalhe: 'Sem acesso até pagar ou você liberar',
      });
    } else if (s === 'ATIVA' && dias <= 7 && !a.renovacaoAutomatica) {
      atencao.push({
        usuarioId: p.id,
        tipo: 'RENOVACAO_MANUAL',
        titulo: dias <= 0 ? 'Plano vence hoje' : `Plano vence em ${dias} ${plural(dias)}`,
        detalhe: 'Sem renovação automática: gere uma nova cobrança',
      });
    } else if (s === 'EM_TRIAL' && dias <= 3) {
      atencao.push({
        usuarioId: p.id,
        tipo: 'TRIAL_ACABANDO',
        titulo: dias <= 0 ? 'Trial acaba hoje' : `Trial acaba em ${dias} ${plural(dias)}`,
        detalhe: a.plano ? `Ainda não pagou, escolheu ${a.plano.nome}` : 'Ainda não pagou e não escolheu plano',
      });
    }

    if (s === 'EM_TRIAL' && !a.perfil && agora.getTime() - p.criadoEm.getTime() >= DIA_MS) {
      atencao.push({
        usuarioId: p.id,
        tipo: 'ONBOARDING_PARADO',
        titulo: 'Cadastrou e não respondeu o onboarding',
        detalhe: 'Travou logo depois do cadastro',
      });
    }
  }
  atencao.sort((x, y) => prioridade[x.tipo] - prioridade[y.tipo]);

  // --- Últimos pagamentos ---
  const ultimosPagamentos = produtores
    .flatMap((p) => p.pagamentos.map((x) => ({ p, x })))
    .sort((m, n) => n.x.criadoEm.getTime() - m.x.criadoEm.getTime())
    .slice(0, 7)
    .map(({ p, x }) => ({
      usuarioId: p.id,
      nome: p.nome,
      plano: p.assinatura?.plano?.nome ?? null,
      metodo: x.metodo,
      valor: x.valor,
      data: x.criadoEm.toISOString(),
      periodoFim: x.periodoFim.toISOString(),
    }));

  // --- Tabela de produtores ---
  const tabela = [...produtores]
    .sort((m, n) => n.criadoEm.getTime() - m.criadoEm.getTime())
    .map((p) => {
      const a = p.assinatura;
      return {
        usuarioId: p.id,
        nome: p.nome,
        telefone: p.telefone,
        situacao: situacoes.get(p.id)!,
        plano: a?.plano ?? null,
        ciclo: a?.ciclo ?? null,
        dataFimAcesso: a ? a.dataFimAcesso.toISOString() : null,
        totalPago: pagamentosPagos(p).reduce((acc, x) => acc + x.valor, 0),
        safrasAtivas: p.safrasAtivas,
        limiteSafras: a?.limiteSafras ?? null,
        criadoEm: p.criadoEm.toISOString(),
        bloqueado: p.bloqueado,
        renovacaoAutomatica: a?.renovacaoAutomatica ?? false,
        respondeuOnboarding: Boolean(a?.perfil),
        perfil: a?.perfil ?? null,
        pagamentos: [...p.pagamentos]
          .sort((m, n) => n.criadoEm.getTime() - m.criadoEm.getTime())
          .map((x) => ({
            valor: x.valor,
            metodo: x.metodo,
            periodoInicio: x.periodoInicio.toISOString(),
            periodoFim: x.periodoFim.toISOString(),
            data: x.criadoEm.toISOString(),
          })),
      };
    });

  return { resumo, receitaPorMes, crescimentoSemanal, funil, atencao, ultimosPagamentos, produtores: tabela };
}
