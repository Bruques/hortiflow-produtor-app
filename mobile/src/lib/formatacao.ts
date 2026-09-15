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

// Spec 25 — máscara visual do CPF pedido no checkout Pix (000.000.000-00). O valor guardado
// no state continua só dígitos; essa função só formata o que é exibido no campo.
export function formatarCpf(digitos: string): string {
  const d = digitos.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
