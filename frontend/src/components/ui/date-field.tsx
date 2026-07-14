import * as React from 'react';
import { Input } from './input';

export interface DateFieldProps {
  id?: string;
  value: string; // yyyy-mm-dd ou ''
  onChange: (value: string) => void;
}

function isoParaExibicao(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  if (!ano || !mes || !dia) return '';
  return `${dia}/${mes}/${ano}`;
}

function aplicarMascara(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 8);
  const partes = [digitos.slice(0, 2), digitos.slice(2, 4), digitos.slice(4, 8)];
  return partes.filter(Boolean).join('/');
}

// Input de texto mascarado dd/mm/aaaa, em vez do <input type="date"> nativo — o formato nativo
// segue a configuração regional do aparelho (frequentemente mm/dd/yyyy), o que inverte dia e mês
// pra quem sempre leu data como dia/mês/ano.
export function DateField({ id, value, onChange }: DateFieldProps) {
  const [texto, setTexto] = React.useState(() => isoParaExibicao(value));

  React.useEffect(() => {
    setTexto(isoParaExibicao(value));
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const mascarado = aplicarMascara(e.target.value);
    setTexto(mascarado);

    const match = mascarado.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    onChange(match ? `${match[3]}-${match[2]}-${match[1]}` : '');
  }

  return (
    <Input
      id={id}
      inputMode="numeric"
      placeholder="dd/mm/aaaa"
      value={texto}
      onChange={handleChange}
      maxLength={10}
    />
  );
}
