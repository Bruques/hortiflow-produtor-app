import type { PeriodoFiltro } from '@/types/simulacao';

// Mesma definição de período usada pelo backend (docs/specs/05-calculo-e-painel-simulacao.md,
// resolverPeriodo em simulacao.controller.ts): semana de segunda a domingo contendo hoje, mês
// corrente. GET /safras/:id/despesas não aceita filtro de período (spec 03), então listas que
// precisam desse recorte filtram no cliente sobre os dados já carregados — mas a regra de qual
// dia cai em qual período tem que ser a mesma dos dois lados, daí replicar aqui em vez de cada
// tela inventar a própria.
function inicioDoDiaUTC(iso: string): Date {
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function inicioDaSemanaUTC(data: Date): Date {
  const diaSemana = data.getUTCDay(); // 0 = domingo
  const deslocamento = diaSemana === 0 ? -6 : 1 - diaSemana;
  const d = new Date(data);
  d.setUTCDate(d.getUTCDate() + deslocamento);
  return d;
}

export function dataEstaNoPeriodo(dataISO: string, periodo: PeriodoFiltro): boolean {
  if (periodo === 'safra') return true;

  const data = inicioDoDiaUTC(dataISO);
  const hoje = inicioDoDiaUTC(new Date().toISOString());

  if (periodo === 'dia') return data.getTime() === hoje.getTime();

  if (periodo === 'semana') {
    const inicioSemana = inicioDaSemanaUTC(hoje);
    const fimSemana = new Date(inicioSemana);
    fimSemana.setUTCDate(fimSemana.getUTCDate() + 6);
    return data >= inicioSemana && data <= fimSemana;
  }

  return data.getUTCFullYear() === hoje.getUTCFullYear() && data.getUTCMonth() === hoje.getUTCMonth();
}

// Rótulo relativo pro cabeçalho de grupo de uma lista agrupada por dia (wireframe: "Hoje, 15
// de julho" / "Ontem, 14 de julho"). Sem depender de biblioteca de datas: só os dois casos
// relativos mais úteis pro produtor, o resto cai no formato dd/mm/aaaa já usado no app.
export function rotuloDia(dataISO: string, formatarData: (iso: string) => string): string {
  const data = inicioDoDiaUTC(dataISO);
  const hoje = inicioDoDiaUTC(new Date().toISOString());
  const diffDias = Math.round((hoje.getTime() - data.getTime()) / 86_400_000);

  if (diffDias === 0) return 'Hoje';
  if (diffDias === 1) return 'Ontem';
  return formatarData(dataISO);
}

// Usado pela tela de Acertos pra calcular o início do período "ainda não dividido": o dia
// seguinte ao data_fim do último Acerto (o próprio data_fim já foi coberto por ele).
export function adicionarDias(dataISO: string, dias: number): string {
  const data = inicioDoDiaUTC(dataISO);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}
