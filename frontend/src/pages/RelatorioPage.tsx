import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, FileDown } from 'lucide-react';
import { useSafraAtiva } from '@/lib/SafraContext';
import { PeriodToggle } from '@/components/PeriodToggle';
import { PeriodoAvancadoButton, type PeriodoPersonalizado } from '@/components/PeriodoAvancadoButton';
import { baixarRelatorioRequest, type FiltroRelatorio } from '@/services/relatorio';
import type { PeriodoFiltro } from '@/types/simulacao';

// Reaproveita o mesmo seletor de período do Resumo/Acerto (docs/specs/15-relatorio-pdf.md).
// Só financiador/misto chegam aqui — o link fica escondido pra meeiro em ResumoPage/MenuPage,
// mas o backend também recusa (403) se alguém tentar acessar direto pela URL.
export default function RelatorioPage() {
  const { safraId, safra } = useSafraAtiva();
  const navigate = useNavigate();

  const [periodo, setPeriodo] = useState<PeriodoFiltro | null>('mes');
  const [periodoPersonalizado, setPeriodoPersonalizado] = useState<PeriodoPersonalizado | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function selecionarPeriodo(valor: PeriodoFiltro) {
    setPeriodoPersonalizado(null);
    setPeriodo(valor);
  }

  function selecionarPeriodoPersonalizado(valor: PeriodoPersonalizado | null) {
    setPeriodoPersonalizado(valor);
    setPeriodo(valor ? null : 'mes');
  }

  async function gerar() {
    setErro(null);
    setGerando(true);
    try {
      const filtro: FiltroRelatorio = periodoPersonalizado
        ? { data_inicio: periodoPersonalizado.dataInicio, data_fim: periodoPersonalizado.dataFim }
        : { periodo: periodo ?? 'mes' };
      const nomeArquivo = `relatorio-${safra.nome.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      await baixarRelatorioRequest(safraId, filtro, nomeArquivo);
    } catch (e) {
      const status = axios.isAxiosError(e) ? e.response?.status : null;
      setErro(
        status === 403
          ? 'Só o financiador pode gerar esse relatório'
          : 'Não foi possível gerar o relatório'
      );
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-10 bg-white px-[18px] pb-1 pt-2.5">
        <div className="mx-auto grid w-full max-w-sm grid-cols-[auto_1fr_auto] items-center gap-3">
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => navigate(-1)}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-cream-100 text-hf-stone-900"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
          </button>
          <h2 className="truncate text-center font-rounded text-[17px] font-extrabold text-hf-stone-900">Gerar relatório</h2>
          <div className="h-[38px] w-[38px]" />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-[22px] py-[18px]">
        <p className="text-[13px] leading-relaxed text-hf-stone-600">
          Escolha o período e baixe um PDF com as despesas, vendas e a divisão de lucro entre
          sócios da {safra.nome} — pronto pra levar pra contadora.
        </p>

        <div>
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Período</label>
          <div className="flex gap-2">
            <PeriodToggle value={periodo} onChange={selecionarPeriodo} incluirSafra={false} />
            <PeriodoAvancadoButton
              periodo={periodo}
              periodoPersonalizado={periodoPersonalizado}
              onSelecionarPeriodo={selecionarPeriodo}
              onSelecionarPeriodoPersonalizado={selecionarPeriodoPersonalizado}
            />
          </div>
        </div>

        {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}
      </div>

      <div className="flex flex-col gap-1 border-t border-hf-cream-100 bg-white px-[22px] py-4">
        <button
          type="button"
          onClick={gerar}
          disabled={gerando}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-hf-green-800 py-4 text-base font-bold text-white disabled:opacity-50"
        >
          <FileDown className="h-[18px] w-[18px]" strokeWidth={2.3} />
          {gerando ? 'Gerando...' : 'Baixar PDF'}
        </button>
      </div>
    </div>
  );
}
