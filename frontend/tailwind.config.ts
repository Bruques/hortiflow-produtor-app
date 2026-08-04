import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        // Paleta do wireframe (docs/design/notas-de-design.md) — usar em todas as telas
        // redesenhadas para manter consistência visual entre elas.
        hf: {
          cream: { 50: '#faf9f4', 100: '#f2f0e7' },
          stone: { 900: '#202821', 700: '#3c463e', 600: '#5c6b5e', 400: '#96a092' },
          line: '#dde1d8',
          green: {
            900: '#123a24',
            800: '#17482d',
            700: '#1e6b3e',
            600: '#278049',
            500: '#3b9b5e',
            100: '#e3eee3',
          },
          red: { DEFAULT: '#d64545', bg: '#fbe4e4' },
          blue: { DEFAULT: '#2f6fd6', bg: '#e2edfb' },
          amber: { DEFAULT: '#c98a1f', bg: '#faedd0' },
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        // Usada em títulos e wordmark (peso 800) — dá o tom "amigável" do wireframe.
        rounded: ['ui-rounded', '"SF Pro Rounded"', '"Segoe UI Rounded"', '-apple-system', 'sans-serif'],
      },
      // Escala tipográfica nomeada por papel semântico (docs/specs/14-design-system-tipografia.md)
      // — não por valor de pixel. Objetivo: mudar o tamanho de "todo valor monetário em destaque"
      // ou "todo título de seção" vira 1 linha aqui, em vez de caçar `text-[Npx]` solto em cada
      // tela. Equivalente no mobile: `fonte` em `mobile/src/theme.ts` (mesmos nomes; valor numérico
      // igual quando o papel já é visualmente o mesmo nas duas plataformas — ver notas-de-design.md
      // para os casos, hoje pré-existentes, em que web e mobile ainda divergem no mesmo papel).
      // Migração incremental: só telas novas/redesenhadas são obrigadas a usar estes tokens.
      fontSize: {
        miniEtiqueta: '10px', // selo secundário muito pequeno (ex: tag de papel do sócio)
        miniLegenda: '10.5px', // legenda ínfima abaixo de um valor (ex: "A receber")
        etiqueta: '11.5px', // selo de status e percentuais em destaque pequeno
        auxiliar: '12px', // texto auxiliar pequeno dentro de cards (labels, notas)
        legenda: '12.5px', // texto secundário padrão (rótulos, datas, links auxiliares)
        textoPequeno: '13px', // texto pequeno para avatares/iniciais e mensagens de status
        corpo: '14px', // texto padrão de conteúdo (nomes, títulos de item, mensagens)
        valorSecundario: '14.5px', // valor monetário de destaque médio (itens de lista)
        destaqueMedio: '15px', // texto em destaque médio (ex: percentual dentro do anel)
        tituloSecao: '16px', // título de seção dentro de uma tela
        valorDestaque: '17px', // valor monetário em destaque (cards de resumo)
        tituloTela: '21px', // título principal da tela
        hero: '26px', // valor monetário principal, maior destaque da tela
      },
    },
  },
  plugins: [],
} satisfies Config;
