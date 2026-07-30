// Cálculo de divisão de lucro entre sócios. Service puro (sem Prisma/Express) para
// que trocar a fórmula depois — ex: reembolsar quem bancou antes de dividir o
// restante — seja mudança em um arquivo só, sem tocar em rotas/controllers.

interface DespesaInput {
  valor: number;
  // Ausente = rateio padrão (segue o percentual_lucro vigente de cada sócio, igual ao
  // comportamento histórico). Presente = rateio próprio dessa despesa, que substitui o
  // percentual_lucro só pra essa despesa (docs/specs/13-rateio-de-despesas.md). Sócios
  // fora da lista ficam com 0% dela.
  rateio?: { socio_id: string; percentual: number }[];
}

interface VendaInput {
  total: number;
}

interface SocioInput {
  socio_id: string;
  nome: string;
  percentual_lucro: number;
}

export interface DivisaoSocio {
  socio_id: string;
  nome: string;
  percentual: number;
  valor: number;
}

export interface ResultadoDivisao {
  receita: number;
  despesas: number;
  lucroLiquido: number;
  divisao: DivisaoSocio[];
}

// Traduz as linhas de RateioDespesa (vindas do Prisma, percentual como Decimal) pro formato
// que `calcularDivisao` espera. Sem linhas, retorna undefined (rateio padrão) em vez de
// array vazio, pra não confundir com "rateado 0% pra todo mundo".
export function mapearRateioParaDivisao(
  rateios: { socio_sociedade_id: string; percentual: unknown }[]
): { socio_id: string; percentual: number }[] | undefined {
  if (rateios.length === 0) return undefined;
  return rateios.map((r) => ({ socio_id: r.socio_sociedade_id, percentual: Number(r.percentual) }));
}

export function calcularDivisao(
  despesas: DespesaInput[],
  vendas: VendaInput[],
  socios: SocioInput[]
): ResultadoDivisao {
  const receita = vendas.reduce((acc, v) => acc + v.total, 0);
  const despesasTotal = despesas.reduce((acc, d) => acc + d.valor, 0);
  const lucroLiquido = receita - despesasTotal;

  // Por sócio: parte da receita pelo percentual de lucro, menos a parte das despesas —
  // que segue o rateio próprio de cada despesa quando existe, ou o mesmo percentual de
  // lucro quando a despesa não tem rateio customizado. Sem nenhum rateio customizado em
  // nenhuma despesa, o resultado é idêntico a `lucroLiquido × percentual_lucro/100`.
  const divisao = socios.map((s) => {
    const parteDespesas = despesas.reduce((acc, d) => {
      const percentualDespesa = d.rateio
        ? d.rateio.find((r) => r.socio_id === s.socio_id)?.percentual ?? 0
        : s.percentual_lucro;
      return acc + d.valor * (percentualDespesa / 100);
    }, 0);

    return {
      socio_id: s.socio_id,
      nome: s.nome,
      percentual: s.percentual_lucro,
      valor: receita * (s.percentual_lucro / 100) - parteDespesas,
    };
  });

  return { receita, despesas: despesasTotal, lucroLiquido, divisao };
}
