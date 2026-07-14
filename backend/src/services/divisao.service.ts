// Cálculo de divisão de lucro entre sócios. Service puro (sem Prisma/Express) para
// que trocar a fórmula depois — ex: reembolsar quem bancou antes de dividir o
// restante — seja mudança em um arquivo só, sem tocar em rotas/controllers.

interface DespesaInput {
  valor: number;
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

export function calcularDivisao(
  despesas: DespesaInput[],
  vendas: VendaInput[],
  socios: SocioInput[]
): ResultadoDivisao {
  const receita = vendas.reduce((acc, v) => acc + v.total, 0);
  const despesasTotal = despesas.reduce((acc, d) => acc + d.valor, 0);
  const lucroLiquido = receita - despesasTotal;

  const divisao = socios.map((s) => ({
    socio_id: s.socio_id,
    nome: s.nome,
    percentual: s.percentual_lucro,
    valor: lucroLiquido * (s.percentual_lucro / 100),
  }));

  return { receita, despesas: despesasTotal, lucroLiquido, divisao };
}
