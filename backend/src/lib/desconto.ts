// Spec 28 — cálculo do valor de uma cobrança gerada pelo dono no painel admin, com desconto
// opcional. Função pura (sem banco nem gateway) pra ficar fácil de testar e pra a regra de
// desconto existir num lugar só. Tudo é calculado em centavos inteiros pra evitar erro de
// ponto flutuante (89,90 × 0,9 dá 80.91000000000001 em número decimal).

export type Desconto = { tipo: 'PERCENTUAL' | 'VALOR'; valor: number };

// Menor valor que o Mercado Pago aceita cobrar (Pix e cartão).
export const VALOR_MINIMO_COBRANCA = 1;

export type ResultadoCobranca =
  | { valorBase: number; valorFinal: number }
  | { erro: 'DESCONTO_INVALIDO' | 'VALOR_FINAL_ABAIXO_DO_MINIMO' };

export function calcularValorCobranca(valorBase: number, desconto?: Desconto): ResultadoCobranca {
  const baseCentavos = Math.round(valorBase * 100);
  let descontoCentavos = 0;

  if (desconto) {
    if (!Number.isFinite(desconto.valor) || desconto.valor <= 0) return { erro: 'DESCONTO_INVALIDO' };

    if (desconto.tipo === 'PERCENTUAL') {
      if (desconto.valor >= 100) return { erro: 'DESCONTO_INVALIDO' };
      descontoCentavos = Math.round((baseCentavos * desconto.valor) / 100);
    } else {
      descontoCentavos = Math.round(desconto.valor * 100);
      if (descontoCentavos >= baseCentavos) return { erro: 'DESCONTO_INVALIDO' };
    }
  }

  const finalCentavos = baseCentavos - descontoCentavos;
  if (finalCentavos < VALOR_MINIMO_COBRANCA * 100) return { erro: 'VALOR_FINAL_ABAIXO_DO_MINIMO' };

  return { valorBase: baseCentavos / 100, valorFinal: finalCentavos / 100 };
}
