// Reescrita de formatarData de frontend/src/lib/utils.ts — datas de safra são só "dia", sem
// hora relevante; formata direto a partir da string ISO, sem passar por conversão de fuso
// (new Date(iso).toLocaleDateString() aplicaria o fuso local e voltaria um dia).
export function formatarData(dataISO: string): string {
  const [ano, mes, dia] = dataISO.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

// Hora local (não UTC) de um timestamp completo, usada pra "Atualizado às HH:MM" no painel
// offline (docs/specs/mobile/05-painel-e-acerto.md) — diferente de formatarData acima, aqui o
// fuso local é o comportamento certo (é hora de relógio, não uma data de calendário).
export function formatarHora(timestampISO: string): string {
  const data = new Date(timestampISO);
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Mesma máscara "DD/MM/AAAA" já usada (localmente) em NovaDespesaScreen.tsx, extraída aqui
// pra ser reaproveitada pelos dois campos de data novos da spec `05` (painel personalizado e
// criação de acerto), sem duplicar a lógica de conversão entre exibição e ISO duas vezes.
export function dataIsoParaExibicao(iso: string): string {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function exibicaoParaDataIso(texto: string): string | null {
  const digitos = texto.replace(/\D/g, '');
  if (digitos.length !== 8) return null;
  const dia = digitos.slice(0, 2);
  const mes = digitos.slice(2, 4);
  const ano = digitos.slice(4, 8);
  return `${ano}-${mes}-${dia}`;
}

// Reescrita de adicionarDias de frontend/src/lib/periodo.ts — usa UTC de propósito, pra somar
// dias de calendário sem risco de o fuso local empurrar pro dia anterior/seguinte. Usada só
// pra sugerir a data de início de um novo Acerto a partir do fim do último (spec `05` mobile).
export function adicionarDias(dataISO: string, dias: number): string {
  const [ano, mes, dia] = dataISO.slice(0, 10).split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}
