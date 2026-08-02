// Reescrita de formatarData de frontend/src/lib/utils.ts — datas de safra são só "dia", sem
// hora relevante; formata direto a partir da string ISO, sem passar por conversão de fuso
// (new Date(iso).toLocaleDateString() aplicaria o fuso local e voltaria um dia).
export function formatarData(dataISO: string): string {
  const [ano, mes, dia] = dataISO.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}
