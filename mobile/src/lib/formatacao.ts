// Reescrita de formatarMoeda/iniciais de frontend/src/lib/utils.ts — mesmo comportamento,
// arquivo próprio porque mobile/ e frontend/ não compartilham código (docs/specs/mobile/
// 00-setup-e-infra.md).
export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}
