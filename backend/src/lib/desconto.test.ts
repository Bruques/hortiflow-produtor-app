import { calcularValorCobranca } from './desconto';

describe('calcularValorCobranca', () => {
  it('sem desconto devolve o valor base', () => {
    expect(calcularValorCobranca(89.9)).toEqual({ valorBase: 89.9, valorFinal: 89.9 });
  });

  it('aplica desconto percentual sem erro de ponto flutuante (critério 7 da spec 28)', () => {
    expect(calcularValorCobranca(89.9, { tipo: 'PERCENTUAL', valor: 10 })).toEqual({ valorBase: 89.9, valorFinal: 80.91 });
  });

  it('aplica desconto em reais', () => {
    expect(calcularValorCobranca(899, { tipo: 'VALOR', valor: 99 })).toEqual({ valorBase: 899, valorFinal: 800 });
  });

  it.each([
    [{ tipo: 'PERCENTUAL', valor: 0 }],
    [{ tipo: 'PERCENTUAL', valor: -5 }],
    [{ tipo: 'PERCENTUAL', valor: 100 }],
    [{ tipo: 'PERCENTUAL', valor: 150 }],
    [{ tipo: 'VALOR', valor: 0 }],
    [{ tipo: 'VALOR', valor: 89.9 }],
    [{ tipo: 'VALOR', valor: 120 }],
    [{ tipo: 'VALOR', valor: Number.NaN }],
  ] as const)('recusa desconto inválido %j', (desconto) => {
    expect(calcularValorCobranca(89.9, { ...desconto })).toEqual({ erro: 'DESCONTO_INVALIDO' });
  });

  it('recusa valor final abaixo de R$ 1,00', () => {
    expect(calcularValorCobranca(89.9, { tipo: 'VALOR', valor: 89.2 })).toEqual({ erro: 'VALOR_FINAL_ABAIXO_DO_MINIMO' });
  });

  it('aceita valor final de exatamente R$ 1,00', () => {
    expect(calcularValorCobranca(89.9, { tipo: 'VALOR', valor: 88.9 })).toEqual({ valorBase: 89.9, valorFinal: 1 });
  });
});
