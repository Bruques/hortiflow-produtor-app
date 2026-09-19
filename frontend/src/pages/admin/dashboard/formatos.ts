import type { MetodoPagamento, SituacaoProdutor } from '@/types/adminDashboard';

// Spec 28 — formatação e rótulos do painel do dono. Datas são sempre exibidas no fuso de
// Brasília, que é o mesmo usado pelo backend pra decidir "em que mês caiu" um pagamento.
const FUSO = 'America/Sao_Paulo';
const DIA_MS = 24 * 60 * 60 * 1000;

export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const brl0 = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function data(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: FUSO });
}

export function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: FUSO }).replace('.', '').replace(' de ', ' ');
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const nomeDoMes = (chave: string) => MESES[Number(chave.slice(5, 7)) - 1];

// "em 12 dias" / "venceu há 3 dias", com o tom pra destacar o que está perto ou já passou.
export function prazoDoAcesso(iso: string | null): { texto: string; tom: 'atrasado' | 'perto' | 'normal' } {
  if (!iso) return { texto: '', tom: 'normal' };
  const dias = Math.ceil((new Date(iso).getTime() - Date.now()) / DIA_MS);
  const plural = (n: number) => (n === 1 ? 'dia' : 'dias');
  if (dias === 0) return { texto: 'vence hoje', tom: 'perto' };
  if (dias > 0) return { texto: `em ${dias} ${plural(dias)}`, tom: dias <= 5 ? 'perto' : 'normal' };
  return { texto: `venceu há ${-dias} ${plural(-dias)}`, tom: 'atrasado' };
}

export type Tom = 'bom' | 'info' | 'aviso' | 'critico' | 'neutro';

export const SITUACAO: Record<SituacaoProdutor, { rotulo: string; tom: Tom }> = {
  ATIVA: { rotulo: 'Ativa', tom: 'bom' },
  EM_TRIAL: { rotulo: 'Em trial', tom: 'info' },
  VENCIDA: { rotulo: 'Vencida', tom: 'aviso' },
  TRIAL_EXPIRADO: { rotulo: 'Trial expirado', tom: 'aviso' },
  CANCELADA: { rotulo: 'Cancelada', tom: 'neutro' },
  BLOQUEADA: { rotulo: 'Bloqueada', tom: 'critico' },
};

export const CLASSE_TOM: Record<Tom, string> = {
  bom: 'bg-hf-green-100 text-hf-green-800',
  info: 'bg-hf-blue-bg text-hf-blue',
  aviso: 'bg-hf-amber-bg text-[#7a5000]',
  critico: 'bg-hf-red-bg text-[#9c2727]',
  neutro: 'bg-hf-cream-100 text-hf-stone-600',
};

export const ROTULO_METODO: Record<MetodoPagamento, string> = {
  GATEWAY_ASAAS: 'Cartão (Asaas)',
  GATEWAY_MP_CARTAO: 'Cartão de crédito',
  GATEWAY_MP_PIX: 'Pix',
  MANUAL_PIX: 'Pix direto',
  MANUAL_DINHEIRO: 'Dinheiro',
  MANUAL_CORTESIA: 'Cortesia',
};

export const ROTULO_FAIXA_MEEIROS: Record<string, string> = {
  UM_A_TRES: '1 a 3 meeiros',
  QUATRO_A_DEZ: '4 a 10 meeiros',
  DEZ_OU_MAIS: '10 ou mais meeiros',
};

export function rotuloLocalizacao(loc: string | null, outra?: string | null): string {
  if (loc === 'BOM_REPOUSO') return 'Bom Repouso';
  if (loc === 'OUTRA_CIDADE') return outra ? `Outra cidade: ${outra}` : 'Outra cidade';
  return '—';
}

export function linkWhatsApp(telefone: string, mensagem?: string): string {
  const numero = telefone.replace(/\D/g, '');
  const base = `https://wa.me/${numero.startsWith('55') ? numero : `55${numero}`}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}

// Menor múltiplo "redondo" de 4 que comporta o valor, pra o eixo do gráfico ter 4 divisões limpas.
export function maximoDoEixo(v: number): number {
  if (v <= 0) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v / 4)));
  for (const passo of [1, 2, 2.5, 5, 10]) if (passo * p * 4 >= v) return passo * p * 4;
  return 10 * p * 4;
}
