import { Check, ChevronDown, Circle, Clock } from 'lucide-react';
import { DropdownSheet } from '@/components/ui/dropdown-sheet';
import { cn } from '@/lib/utils';

export type StatusPagamento = 'todas' | 'pagas' | 'a_receber';

const OPCOES: { valor: StatusPagamento; label: string; icone: typeof Circle }[] = [
  { valor: 'todas', label: 'Todas', icone: Circle },
  { valor: 'pagas', label: 'Pagas', icone: Check },
  { valor: 'a_receber', label: 'A receber', icone: Clock },
];

// Cor do chip fechado por valor selecionado — dá pra "ler" o filtro ativo sem abrir a folha.
const COR_CHIP: Record<StatusPagamento, string> = {
  todas: 'bg-hf-cream-100 text-hf-stone-700',
  pagas: 'bg-hf-green-100 text-hf-green-800',
  a_receber: 'bg-hf-amber-bg text-hf-amber',
};

interface FiltroStatusPagamentoDropdownProps {
  value: StatusPagamento;
  onChange: (valor: StatusPagamento) => void;
  className?: string;
}

// Substitui a 3ª linha de abas (Todas/Pagas/A receber) da tela de Vendas. O gatilho é um chip
// compacto colorido (não uma pílula de largura cheia) — decisão do dev, 2026-08-04 — e a folha
// que abre mostra cada opção como um cartão com contorno (estilo "B" validado nas propostas).
export function FiltroStatusPagamentoDropdown({ value, onChange, className }: FiltroStatusPagamentoDropdownProps) {
  const opcaoAtual = OPCOES.find((o) => o.valor === value) ?? OPCOES[0];
  const IconeAtual = opcaoAtual.icone;

  return (
    <DropdownSheet
      className={cn('w-fit self-start', className)}
      renderTrigger={(abrir) => (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-hf-stone-400">Status da venda</span>
          <button
            type="button"
            onClick={abrir}
            aria-label="Filtrar por status de pagamento"
            className={cn(
              'inline-flex items-center gap-1.5 self-start rounded-full px-3 py-2 text-[12px] font-bold transition-colors',
              COR_CHIP[value]
            )}
          >
            <IconeAtual className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
            {opcaoAtual.label}
            <ChevronDown className="h-3 w-3 shrink-0 opacity-60" strokeWidth={2.5} />
          </button>
        </div>
      )}
    >
      {(fechar) => (
        <>
          <h3 className="mb-0.5 text-[15px] font-extrabold text-hf-stone-900">Status de pagamento</h3>
          <p className="mb-3.5 text-[11.5px] text-hf-stone-600">O que você quer ver na lista</p>

          <div className="flex flex-col gap-2">
            {OPCOES.map((opcao) => {
              const Icone = opcao.icone;
              const selecionado = value === opcao.valor;
              return (
                <button
                  key={opcao.valor}
                  type="button"
                  onClick={() => {
                    onChange(opcao.valor);
                    fechar();
                  }}
                  className={cn(
                    'flex items-center justify-between gap-2.5 rounded-2xl border-[1.5px] px-3.5 py-3 text-left transition-colors',
                    selecionado ? 'border-hf-green-700 bg-hf-green-100' : 'border-hf-line bg-white'
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                        selecionado
                          ? 'border-hf-green-700 bg-hf-green-700 text-white'
                          : 'border-hf-line bg-white text-hf-stone-600'
                      )}
                    >
                      <Icone className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                    <span className="text-[13px] font-bold text-hf-stone-900">{opcao.label}</span>
                  </span>
                  {selecionado && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-hf-green-700 text-white">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </DropdownSheet>
  );
}
