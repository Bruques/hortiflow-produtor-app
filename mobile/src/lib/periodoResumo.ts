import type { PeriodoFiltro } from '../types/simulacao';

export interface IntervaloData {
  dataInicio: string;
  dataFim: string;
}

function paraIso(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// Calcula o intervalo de datas (calendário local do dispositivo) de um período do painel —
// usado só pra filtrar client-side a lista de vendas já em cache na tela de Resumo
// ("Vendas recentes" reaproveita a lista já carregada pela spec `06`, sem chamada nova, ver
// docs/specs/mobile/08-navegacao-resumo-e-menu.md). Os números do painel em si (receita,
// despesas, lucro líquido, divisão) continuam vindo só de GET /safras/:id/simulacao (spec
// `05`) — esta função nunca alimenta esse cálculo, é puramente um filtro de exibição de lista.
export function calcularIntervaloPeriodo(
  periodo: PeriodoFiltro | null,
  personalizado: IntervaloData | null
): IntervaloData | null {
  if (personalizado) return personalizado;
  const hoje = new Date();

  switch (periodo) {
    case 'dia': {
      const iso = paraIso(hoje);
      return { dataInicio: iso, dataFim: iso };
    }
    case 'semana': {
      const diaSemana = hoje.getDay();
      const deslocamento = diaSemana === 0 ? -6 : 1 - diaSemana;
      const inicio = new Date(hoje);
      inicio.setDate(inicio.getDate() + deslocamento);
      const fim = new Date(inicio);
      fim.setDate(fim.getDate() + 6);
      return { dataInicio: paraIso(inicio), dataFim: paraIso(fim) };
    }
    case 'mes': {
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      return { dataInicio: paraIso(inicio), dataFim: paraIso(fim) };
    }
    case 'safra':
    default:
      return null;
  }
}
