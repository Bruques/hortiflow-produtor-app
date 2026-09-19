import { useState } from 'react';
import { cn } from '@/lib/utils';
import { registrarPagamentoManualRequest } from '@/services/admin';
import type { ProdutorDashboard } from '@/types/adminDashboard';
import { data } from './formatos';

type Metodo = 'MANUAL_PIX' | 'MANUAL_DINHEIRO' | 'MANUAL_CORTESIA';

const DIAS = [7, 30, 90, 365];
const METODOS: { id: Metodo; rotulo: string }[] = [
  { id: 'MANUAL_PIX', rotulo: 'Pix direto' },
  { id: 'MANUAL_DINHEIRO', rotulo: 'Dinheiro' },
  { id: 'MANUAL_CORTESIA', rotulo: 'Cortesia' },
];

const chip = (ativo: boolean) =>
  cn('rounded-full border px-3 py-1.5 text-legenda font-semibold', ativo ? 'border-hf-green-700 bg-hf-green-700 text-white' : 'border-hf-line bg-white text-hf-stone-600');

interface Props {
  produtor: ProdutorDashboard;
  avisar: (mensagem: string) => void;
  onAtualizar: () => void;
}

// "Liberar acesso" = pagamento manual da spec 18. Pix direto e dinheiro registram o valor
// recebido (entra na receita); cortesia libera sem cobrar (valor 0, não entra na receita).
export default function LiberarAcessoPainel({ produtor, avisar, onAtualizar }: Props) {
  const [dias, setDias] = useState(produtor.ciclo === 'ANUAL' ? 365 : 30);
  const [metodo, setMetodo] = useState<Metodo>('MANUAL_CORTESIA');
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);

  const cortesia = metodo === 'MANUAL_CORTESIA';
  const valor = cortesia ? 0 : Number(texto.replace(/\./g, '').replace(',', '.')) || 0;
  const invalido = !cortesia && valor <= 0;
  const rotuloDias = dias === 365 ? '1 ano' : `${dias} dias`;

  async function liberar() {
    setSalvando(true);
    try {
      const { dataFimAcesso } = await registrarPagamentoManualRequest(produtor.usuarioId, { valor, metodo, dias });
      avisar(`Acesso liberado até ${data(dataFimAcesso)}`);
      setTexto('');
      onAtualizar();
    } catch (err) {
      const erro = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      avisar(erro ?? 'Não foi possível liberar o acesso');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hf-line bg-hf-cream-50 p-3.5">
      <div>
        <span className="mb-1.5 block text-legenda font-semibold text-hf-stone-600">Quantos dias</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dias de acesso">
          {DIAS.map((d) => (
            <button key={d} type="button" aria-pressed={dias === d} className={chip(dias === d)} onClick={() => setDias(d)}>
              {d === 365 ? '1 ano' : `${d} dias`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-legenda font-semibold text-hf-stone-600">Como foi</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Como o acesso foi liberado">
          {METODOS.map((m) => (
            <button key={m.id} type="button" aria-pressed={metodo === m.id} className={chip(metodo === m.id)} onClick={() => setMetodo(m.id)}>
              {m.rotulo}
            </button>
          ))}
        </div>
      </div>

      {!cortesia && (
        <div>
          <label htmlFor="liberar-valor" className="mb-1.5 block text-legenda font-semibold text-hf-stone-600">Valor recebido (R$)</label>
          <input
            id="liberar-valor"
            inputMode="decimal"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="89,90"
            className="h-10 w-full rounded-[10px] border border-hf-line bg-white px-3 text-corpo tabular-nums"
          />
        </div>
      )}

      <button type="button" onClick={liberar} disabled={salvando || invalido} className="rounded-xl bg-hf-green-700 px-4 py-2.5 text-textoPequeno font-bold text-white disabled:opacity-50">
        {salvando ? 'Liberando...' : `Liberar ${rotuloDias}${cortesia ? ' como cortesia' : ''}`}
      </button>
      <p className="m-0 text-auxiliar text-hf-stone-400">
        A contagem parte do fim do acesso atual, se ele ainda não venceu: ninguém perde dias já pagos.
        {!produtor.plano && ' Este produtor está sem plano: escolha um em "Outras ações" para o limite de lavouras valer.'}
        {produtor.bloqueado && ' A conta está bloqueada: liberar não desbloqueia, use "Desbloquear conta".'}
      </p>
    </div>
  );
}
