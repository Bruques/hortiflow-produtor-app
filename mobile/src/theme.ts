import { Platform } from 'react-native';

// Paleta portada 1:1 de frontend/tailwind.config.ts (bloco `hf`) — mesmos valores hex, só
// traduzidos de classes Tailwind pra um objeto usável em StyleSheet.create do React Native.
// Qualquer mudança de cor deve ser feita nos dois lugares (web e mobile não compartilham
// código de estilo — só o valor da decisão de design).
export const cores = {
  cream: { 50: '#faf9f4', 100: '#f2f0e7' },
  stone: { 900: '#202821', 700: '#3c463e', 600: '#5c6b5e', 400: '#96a092' },
  linha: '#dde1d8',
  green: {
    900: '#123a24',
    800: '#17482d',
    700: '#1e6b3e',
    600: '#278049',
    500: '#3b9b5e',
    100: '#e3eee3',
  },
  red: { padrao: '#d64545', fundo: '#fbe4e4' },
  blue: { padrao: '#2f6fd6', fundo: '#e2edfb' },
  amber: { padrao: '#c98a1f', fundo: '#faedd0' },
} as const;

// Espaçamento em múltiplos de 4 (mesma escala do Tailwind) — usar em vez de números soltos
// nos estilos, pra manter o mesmo ritmo visual do web.
export const espacamento = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const raio = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

// A web usa a pilha `ui-rounded`/`SF Pro Rounded` (peso 800) pra títulos e wordmark — não
// existe um equivalente nativo direto e cross-platform sem carregar uma fonte customizada
// (expo-font). Por ora, títulos usam a fonte de sistema em negrito máximo; portar a fonte
// rounded de verdade fica registrado como pendência (ver docs/design/notas-de-design.md).
export const fontes = {
  titulo: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  corpo: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
} as const;

// Escala tipográfica nomeada por papel semântico (docs/specs/14-design-system-tipografia.md)
// — equivalente ao bloco `fontSize` de `frontend/tailwind.config.ts`, mesmos nomes. Valor
// numérico igual ao do web quando o papel já é visualmente o mesmo nas duas plataformas; onde
// já divergiam antes desta task (ex: `tituloSecao`, `corpo`), o valor de cada lado foi mantido
// como estava — ver notas-de-design.md para a lista dessas divergências pré-existentes.
export const fonte = {
  miniEtiqueta: 10, // selo secundário muito pequeno (ex: tag de papel do sócio)
  miniLegenda: 10.5, // legenda ínfima abaixo de um valor (ex: "A receber")
  etiqueta: 11, // selo de status e percentuais em destaque pequeno
  auxiliar: 12, // texto auxiliar pequeno dentro de cards (labels, notas)
  legenda: 12.5, // texto secundário padrão (rótulos, datas, links auxiliares)
  textoPequeno: 13, // texto pequeno para avatares/iniciais e mensagens de status
  corpo: 13.5, // texto padrão de conteúdo (nomes, títulos de item, mensagens)
  valorSecundario: 14, // valor monetário de destaque médio (itens de lista)
  destaqueMedio: 15, // texto em destaque médio (ex: percentual dentro do anel)
  tituloSecao: 15, // título de seção dentro de uma tela
  valorDestaque: 17, // valor monetário em destaque (cards de resumo)
  tituloTela: 20, // título principal da tela
  hero: 26, // valor monetário principal, maior destaque da tela
} as const;
