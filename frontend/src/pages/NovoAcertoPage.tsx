import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useSafraAtiva } from '@/lib/SafraContext';
import { criarAcertoRequest, listarAcertosRequest } from '@/services/acertos';
import { buscarSimulacaoPersonalizadaRequest } from '@/services/simulacao';
import { listarDespesasRequest } from '@/services/despesas';
import { listarSociosRequest } from '@/services/sociedades';
import { adicionarDias } from '@/lib/periodo';
import { DateField } from '@/components/ui/date-field';
import { cn, formatarData, formatarMoeda, iniciais } from '@/lib/utils';
import type { TipoAcerto } from '@/types/acerto';
import type { Simulacao } from '@/types/simulacao';
import type { Despesa } from '@/types/despesa';
import type { Socio } from '@/types/sociedade';

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NovoAcertoPage() {
  const { safraId, sociedadeId, safra } = useSafraAtiva();
  const navigate = useNavigate();

  const [tipo, setTipo] = useState<TipoAcerto>('PARCIAL');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState(hojeISO());
  const [sugestaoLabel, setSugestaoLabel] = useState<string | null>(null);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [simulacao, setSimulacao] = useState<Simulacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listarAcertosRequest(safraId)
      .then((acertos) => {
        if (acertos.length > 0) {
          const inicioSugerido = adicionarDias(acertos[0].data_fim, 1);
          setDataInicio(inicioSugerido);
          setSugestaoLabel(`Sugerido a partir do último acerto (${formatarData(acertos[0].data_fim)})`);
        } else if (safra.data_inicio) {
          setDataInicio(safra.data_inicio.slice(0, 10));
        }
      })
      .catch(() => {});
    listarDespesasRequest(safraId)
      .then((res) => setDespesas(res.despesas))
      .catch(() => {});
    listarSociosRequest(sociedadeId)
      .then((res) => setSocios(res.socios))
      .catch(() => {});
  }, [safraId, sociedadeId, safra.data_inicio]);

  useEffect(() => {
    if (!dataInicio || !dataFim || dataInicio > dataFim) {
      setSimulacao(null);
      return;
    }
    buscarSimulacaoPersonalizadaRequest(safraId, dataInicio, dataFim)
      .then(setSimulacao)
      .catch(() => setErro('Não foi possível calcular a prévia do período'));
  }, [safraId, dataInicio, dataFim]);

  const despesasBancadasPorSocio = useMemo(() => {
    // Despesa.socio_id referencia o usuário; a divisão trabalha com o id do vínculo
    // sócio-sociedade, então traduz um pro outro antes de agregar.
    const socioSociedadeIdPorUsuario = new Map(
      socios.filter((s) => s.usuario_id).map((s) => [s.usuario_id as string, s.id])
    );
    const mapa = new Map<string, number>();
    if (!dataInicio || !dataFim) return mapa;
    for (const d of despesas) {
      const dataChave = d.data.slice(0, 10);
      const socioSociedadeId = socioSociedadeIdPorUsuario.get(d.socio_id);
      if (dataChave >= dataInicio && dataChave <= dataFim && socioSociedadeId) {
        mapa.set(socioSociedadeId, (mapa.get(socioSociedadeId) ?? 0) + Number(d.valor));
      }
    }
    return mapa;
  }, [despesas, socios, dataInicio, dataFim]);

  const formValido = !!dataInicio && !!dataFim && dataInicio <= dataFim;

  async function confirmar() {
    if (!formValido) return;
    setErro(null);
    setSalvando(true);
    try {
      const acerto = await criarAcertoRequest(safraId, { data_inicio: dataInicio, data_fim: dataFim, tipo });
      navigate(`/acertos/${acerto.id}`);
    } catch (e) {
      const mensagem = axios.isAxiosError(e) ? e.response?.data?.error : null;
      setErro(mensagem ?? 'Não foi possível registrar o acerto');
      setSalvando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-3 px-[18px] pb-1 pt-2.5">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => navigate(`/safras/${safraId}/acertos`)}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-cream-100 text-hf-stone-900"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
        </button>
        <h2 className="font-rounded text-[17px] font-extrabold text-hf-stone-900">Registrar acerto</h2>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-[22px] py-[18px]">
        {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}

        <div>
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Tipo de acerto</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTipo('PARCIAL')}
              className={cn(
                'whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-2 text-[12.5px] font-bold',
                tipo === 'PARCIAL' ? 'border-hf-green-800 bg-hf-green-800 text-white' : 'border-hf-line bg-white text-hf-stone-700'
              )}
            >
              Parcial
            </button>
            <button
              type="button"
              onClick={() => setTipo('FINAL')}
              className={cn(
                'whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-2 text-[12.5px] font-bold',
                tipo === 'FINAL' ? 'border-hf-green-800 bg-hf-green-800 text-white' : 'border-hf-line bg-white text-hf-stone-700'
              )}
            >
              Final (encerra a safra)
            </button>
          </div>
        </div>

        {tipo === 'FINAL' && (
          <div className="flex items-start gap-2.5 rounded-xl bg-hf-amber-bg px-3.5 py-3">
            <AlertTriangle className="mt-0.5 h-[17px] w-[17px] shrink-0 text-hf-amber" strokeWidth={2} />
            <div>
              <p className="m-0 text-[12.5px] font-bold text-[#5a3f0e]">Isso também encerra a {safra.nome}</p>
              <p className="m-0 mt-0.5 text-[11.5px] text-hf-amber">
                Depois de um acerto final, não é mais possível lançar despesas ou vendas nessa safra.
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Período</label>
          <div className="flex gap-2.5">
            <DateField value={dataInicio} onChange={setDataInicio} />
            <DateField value={dataFim} onChange={setDataFim} />
          </div>
          {sugestaoLabel && <p className="mt-1.5 text-[11.5px] text-hf-stone-400">{sugestaoLabel}</p>}
          {dataInicio && dataFim && dataInicio > dataFim && (
            <p className="mt-1.5 text-[11.5px] font-medium text-hf-red">
              A data de início precisa ser antes (ou igual) à data de fim
            </p>
          )}
        </div>

        {simulacao && (
          <>
            <div>
              <h3 className="mb-2.5 text-base font-extrabold text-hf-stone-900">Prévia do cálculo</h3>
              <div className="rounded-2xl bg-hf-cream-100 px-4 py-4">
                <p className="m-0 mb-1 text-xs text-hf-stone-600">Lucro líquido do período</p>
                <p
                  className={cn(
                    'm-0 text-[24px] font-extrabold tabular-nums',
                    simulacao.lucroLiquido < 0 ? 'text-hf-red' : 'text-hf-stone-900'
                  )}
                >
                  {formatarMoeda(simulacao.lucroLiquido)}
                </p>
                <div className="mt-2 flex gap-4 text-[11.5px] text-hf-stone-600">
                  <span>Receita: {formatarMoeda(simulacao.receita)}</span>
                  <span>Despesas: {formatarMoeda(simulacao.despesas)}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2.5 text-base font-extrabold text-hf-stone-900">Divisão por sócio</h3>
              <div className="flex flex-col gap-3">
                {simulacao.divisao.map((d) => (
                  <div key={d.socio_id} className="flex flex-col gap-3 rounded-2xl border border-hf-line p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-hf-green-100 text-[13px] font-extrabold text-hf-green-800">
                          {iniciais(d.nome)}
                        </div>
                        <span className="text-sm font-bold text-hf-stone-900">{d.nome}</span>
                      </div>
                      <div className="text-right">
                        <div
                          className={cn(
                            'text-[16px] font-extrabold tabular-nums',
                            d.valor < 0 ? 'text-hf-red' : 'text-hf-green-800'
                          )}
                        >
                          {formatarMoeda(d.valor)}
                        </div>
                        <div className="text-[10px] text-hf-stone-400">A receber</div>
                      </div>
                    </div>
                    <div className="flex gap-5 border-t border-dashed border-hf-cream-100 pt-2.5">
                      <div>
                        <div className="text-[10.5px] text-hf-stone-400">Despesas bancadas</div>
                        <div className="text-[13.5px] font-bold tabular-nums text-hf-stone-900">
                          {formatarMoeda(despesasBancadasPorSocio.get(d.socio_id) ?? 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10.5px] text-hf-stone-400">Percentual aplicado</div>
                        <div className="text-[13.5px] font-bold tabular-nums text-hf-stone-900">{d.percentual}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex items-start gap-2.5 rounded-xl bg-hf-cream-100 px-3.5 py-3.5">
          <ShieldCheck className="mt-0.5 h-[17px] w-[17px] shrink-0 text-hf-stone-600" strokeWidth={2} />
          <p className="m-0 text-[11.5px] leading-relaxed text-hf-stone-600">
            Ao confirmar, esses valores ficam congelados para esse período. Despesas e vendas lançadas depois
            não vão alterar esse extrato.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1 border-t border-hf-cream-100 bg-white px-[22px] py-4">
        <button
          type="button"
          onClick={confirmar}
          disabled={!formValido || salvando}
          className="w-full rounded-2xl bg-hf-green-800 py-4 text-base font-bold text-white disabled:opacity-50"
        >
          {salvando ? 'Registrando...' : `Confirmar acerto ${tipo === 'FINAL' ? 'final' : 'parcial'}`}
        </button>
        <button
          type="button"
          onClick={() => navigate(`/safras/${safraId}/acertos`)}
          className="w-full py-2 text-center text-[12.5px] font-bold text-hf-stone-600"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
