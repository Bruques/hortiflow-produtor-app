import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Datas de despesa/venda são só "dia", sem hora relevante — usar new Date(iso).toLocaleDateString()
// aplicaria o fuso local e voltaria um dia (ex: "2026-07-10" virando 09/07 em UTC-3). Formata direto
// a partir da string ISO, sem passar por conversão de fuso.
export function formatarData(dataISO: string): string {
  const [ano, mes, dia] = dataISO.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
