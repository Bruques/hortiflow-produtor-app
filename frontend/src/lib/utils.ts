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

// Iniciais pro avatar circular usado em listas com nome de sócio (Resumo, Despesas, Vendas).
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}
