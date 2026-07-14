export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

// Formata progressivamente enquanto o usuário digita: (35) 99730-2015 (celular) ou (35) 3773-2015 (fixo)
export function formatarTelefone(valor: string): string {
  const digitos = somenteDigitos(valor).slice(0, 11);
  const ddd = digitos.slice(0, 2);

  if (digitos.length <= 2) {
    return digitos.length ? `(${ddd}` : '';
  }

  const ehCelular = digitos.length > 10;
  const meio = ehCelular ? digitos.slice(2, 7) : digitos.slice(2, 6);
  const fim = ehCelular ? digitos.slice(7) : digitos.slice(6);

  return fim ? `(${ddd}) ${meio}-${fim}` : `(${ddd}) ${meio}`;
}
