import { montarDashboard, situacaoDoProdutor, ProdutorBruto, PagamentoBruto } from './dashboardAdmin';

const AGORA = new Date('2026-09-19T15:00:00Z');
const dia = (iso: string) => new Date(`${iso}T15:00:00Z`);

function pagamento(valor: number, criadoEm: string, dias = 30, metodo = 'GATEWAY_MP_PIX'): PagamentoBruto {
  const inicio = dia(criadoEm);
  return { valor, metodo, periodoInicio: inicio, periodoFim: new Date(inicio.getTime() + dias * 86400000), criadoEm: inicio };
}

function produtor(id: string, extra: Partial<ProdutorBruto> = {}): ProdutorBruto {
  return {
    id,
    nome: `Produtor ${id}`,
    telefone: '35999990000',
    criadoEm: dia('2026-08-01'),
    bloqueado: false,
    assinatura: {
      status: 'ATIVA',
      ciclo: 'MENSAL',
      plano: { id: 'p1', nome: 'Profissional' },
      dataFimAcesso: dia('2026-10-30'),
      renovacaoAutomatica: false,
      limiteSafras: 3,
      perfil: { faixaMeeiros: 'QUATRO_A_DEZ', quantidadePes: 9000, localizacao: 'BOM_REPOUSO' },
    },
    safrasAtivas: 1,
    pagamentos: [],
    ...extra,
  };
}

describe('situacaoDoProdutor', () => {
  it('bloqueada vence qualquer outra situação', () => {
    expect(situacaoDoProdutor(produtor('a', { bloqueado: true }), AGORA)).toBe('BLOQUEADA');
  });

  it('cancelada aparece como cancelada mesmo com acesso ainda válido', () => {
    const p = produtor('a');
    p.assinatura!.status = 'CANCELADA';
    expect(situacaoDoProdutor(p, AGORA)).toBe('CANCELADA');
  });

  it('distingue vencida de trial expirado e ativa de em trial', () => {
    const vencida = produtor('a');
    vencida.assinatura!.dataFimAcesso = dia('2026-09-01');
    expect(situacaoDoProdutor(vencida, AGORA)).toBe('VENCIDA');

    const trialExpirado = produtor('b');
    trialExpirado.assinatura!.status = 'TRIAL';
    trialExpirado.assinatura!.dataFimAcesso = dia('2026-09-01');
    expect(situacaoDoProdutor(trialExpirado, AGORA)).toBe('TRIAL_EXPIRADO');

    const trial = produtor('c');
    trial.assinatura!.status = 'TRIAL';
    expect(situacaoDoProdutor(trial, AGORA)).toBe('EM_TRIAL');
    expect(situacaoDoProdutor(produtor('d'), AGORA)).toBe('ATIVA');
  });
});

describe('montarDashboard', () => {
  it('receita do mês compara com o mês anterior fechado (critério 4)', () => {
    const p = produtor('a', { pagamentos: [pagamento(89.9, '2026-08-20'), pagamento(89.9, '2026-09-10')] });
    const q = produtor('b', { pagamentos: [pagamento(49.9, '2026-09-12')] });
    const { resumo } = montarDashboard({ produtores: [p, q], pagamentosOrfaos: [] }, AGORA);
    expect(resumo.receitaMes).toBeCloseTo(139.8);
    expect(resumo.receitaMesAnterior).toBeCloseTo(89.9);
    expect(resumo.receitaTotal).toBeCloseTo(229.7);
  });

  it('plano anual entra inteiro no mês do pagamento e a recorrência divide por 12 (critério 5)', () => {
    const anual = produtor('a', { pagamentos: [pagamento(899, '2026-07-15', 365)] });
    const { resumo, receitaPorMes } = montarDashboard({ produtores: [anual], pagamentosOrfaos: [] }, AGORA);
    expect(receitaPorMes.find((m) => m.mes === '2026-07')!.valor).toBe(899);
    expect(resumo.recorrenciaMensal).toBeCloseTo(899 / 12);
  });

  it('cortesia não soma na receita nem na recorrência (critério 11)', () => {
    const p = produtor('a', { pagamentos: [pagamento(0, '2026-09-10', 30, 'MANUAL_CORTESIA')] });
    const { resumo, funil } = montarDashboard({ produtores: [p], pagamentosOrfaos: [] }, AGORA);
    expect(resumo.receitaMes).toBe(0);
    expect(resumo.recorrenciaMensal).toBe(0);
    expect(funil.pagaram).toBe(0);
  });

  it('pagamento de conta excluída conta na receita, mas não vira produtor (critério 6)', () => {
    const { resumo, produtores } = montarDashboard(
      { produtores: [], pagamentosOrfaos: [{ valor: 50, criadoEm: dia('2026-09-05') }] },
      AGORA
    );
    expect(resumo.receitaMes).toBe(50);
    expect(resumo.receitaMesContasExcluidas).toBe(50);
    expect(resumo.receitaTotalContasExcluidas).toBe(50);
    expect(resumo.cadastrados).toBe(0);
    expect(produtores).toHaveLength(0);
  });

  it('usa o fuso de Brasília na virada do mês', () => {
    // 2026-10-01 01:30 UTC ainda é 30/09 22:30 em Brasília
    const p = produtor('a', {
      pagamentos: [{ ...pagamento(10, '2026-09-30'), criadoEm: new Date('2026-10-01T01:30:00Z') }],
    });
    const { receitaPorMes } = montarDashboard({ produtores: [p], pagamentosOrfaos: [] }, AGORA);
    expect(receitaPorMes.find((m) => m.mes === '2026-09')!.valor).toBe(10);
  });

  it('devolve 5 meses e 20 semanas, com o funil coerente', () => {
    const pago = produtor('a', { pagamentos: [pagamento(89.9, '2026-09-10')] });
    const semPerfil = produtor('b');
    semPerfil.assinatura!.perfil = null;
    semPerfil.assinatura!.plano = null;
    const { receitaPorMes, crescimentoSemanal, funil } = montarDashboard({ produtores: [pago, semPerfil], pagamentosOrfaos: [] }, AGORA);
    expect(receitaPorMes).toHaveLength(5);
    expect(receitaPorMes[4].mes).toBe('2026-09');
    expect(crescimentoSemanal).toHaveLength(20);
    expect(crescimentoSemanal[19]).toMatchObject({ cadastrados: 2, pagantes: 1 });
    expect(funil).toEqual({ cadastraram: 2, responderamOnboarding: 1, escolheramPlano: 1, pagaram: 1 });
  });

  it('atenção: vencido, renovação manual, trial acabando e onboarding parado, nessa ordem', () => {
    const vencido = produtor('vencido');
    vencido.assinatura!.dataFimAcesso = dia('2026-09-05');

    const renovar = produtor('renovar');
    renovar.assinatura!.dataFimAcesso = dia('2026-09-22');

    const automatica = produtor('automatica');
    automatica.assinatura!.dataFimAcesso = dia('2026-09-22');
    automatica.assinatura!.renovacaoAutomatica = true;

    const trial = produtor('trial');
    trial.assinatura!.status = 'TRIAL';
    trial.assinatura!.dataFimAcesso = dia('2026-09-21');

    const parado = produtor('parado', { criadoEm: dia('2026-09-16') });
    parado.assinatura!.status = 'TRIAL';
    parado.assinatura!.dataFimAcesso = dia('2026-09-30');
    parado.assinatura!.perfil = null;

    const { atencao } = montarDashboard({ produtores: [vencido, renovar, automatica, trial, parado], pagamentosOrfaos: [] }, AGORA);
    expect(atencao.map((a) => [a.usuarioId, a.tipo])).toEqual([
      ['vencido', 'ACESSO_VENCIDO'],
      ['renovar', 'RENOVACAO_MANUAL'],
      ['trial', 'TRIAL_ACABANDO'],
      ['parado', 'ONBOARDING_PARADO'],
    ]);
  });
});
