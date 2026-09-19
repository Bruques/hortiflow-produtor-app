import { useEffect, useRef, useState } from 'react';

// Os gráficos do painel são SVG desenhados na largura real do container (o texto do eixo não
// pode encolher junto com um viewBox fixo no celular), então precisam saber essa largura.
export function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(600);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setLargura(el.clientWidth || 600);
    const observador = new ResizeObserver(([entrada]) => setLargura(Math.round(entrada.contentRect.width) || 600));
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  return [ref, largura] as const;
}
