import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Calendar, ChevronRight, ShoppingCart, Wallet, TrendingUp, Package, CirclePlus, CircleMinus, PiggyBank, FileText } from 'lucide-react';
import { Topbar } from '@/components/Topbar';
import { PeriodToggle } from '@/components/PeriodToggle';
import { useSafraAtiva } from '@/lib/SafraContext';
import { meRequest } from '@/services/auth';
import { buscarSimulacaoRequest } from '@/services/simulacao';
import { listarSociosRequest } from '@/services/sociedades';
import { formatarData, formatarMoeda } from '@/lib/utils';
import { ROTULO_STATUS_SAFRA, ROTULO_PAPEL_SOCIO } from '@/lib/rotulos';
import type { PeriodoFiltro, Simulacao } from '@/types/simulacao';
import type { Socio } from '@/types/sociedade';

const RAIO_ANEL = 31;
const CIRCUNFERENCIA_ANEL = 2 * Math.PI * RAIO_ANEL;

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

export default function ResumoPage() {
  const { safraId, sociedadeId, safra } = useSafraAtiva();
  const navigate = useNavigate();

  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('semana');
  const [simulacao, setSimulacao] = useState<Simulacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    meRequest().then((res) => setUsuarioId(res.usuario.id)).catch(() => {});
    listarSociosRequest(sociedadeId).then((res) => setSocios(res.socios)).catch(() => {});
  }, [sociedadeId]);

  useEffect(() => {
    setCarregando(true);
    setErro(null);
    buscarSimulacaoRequest(safraId, periodo)
      .then(setSimulacao)
      .catch(() => setErro('Não foi possível carregar o resumo'))
      .finally(() => setCarregando(false));
  }, [safraId, periodo]);

  const meuDivisao = simulacao?.divisao.find((d) => d.socio_id === usuarioId) ?? null;
  const percentualAnel = Math.min(100, Math.max(0, meuDivisao?.percentual ?? 0));
  const offsetAnel = CIRCUNFERENCIA_ANEL * (1 - percentualAnel / 100);

  return (
    <div>
      <Topbar safraId={safraId} />

      <div className="mx-auto flex max-w-sm flex-col gap-[22px] px-[22px] pb-6 pt-3.5">
        <button
          type="button"
          onClick={() => navigate(`/sociedades/${sociedadeId}/safras`)}
          className="flex flex-col items-start gap-0.5 text-left"
        >
          <span className="text-[12.5px] text-hf-stone-600">Safra atual</span>
          <span className="flex items-center gap-1.5">
            <h2 className="font-rounded text-[21px] font-extrabold text-hf-stone-900">{safra.nome}</h2>
            <ChevronRight className="h-4 w-4 text-hf-stone-600" />
          </span>
          <span className="mt-1 flex w-full items-center justify-between">
            <span className="flex items-center gap-1.5 text-[12.5px] text-hf-stone-600">
              <Calendar className="h-3.5 w-3.5" />
              {safra.data_inicio && safra.data_fim
                ? `${formatarData(safra.data_inicio)} a ${formatarData(safra.data_fim)}`
                : 'Datas não definidas'}
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-hf-green-100 px-2.5 py-1 text-[11.5px] font-bold text-hf-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-hf-green-600" />
              {ROTULO_STATUS_SAFRA[safra.status]}
            </span>
          </span>
        </button>

        <PeriodToggle value={periodo} onChange={setPeriodo} />

        {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}

        {carregando && !simulacao && (
          <p className="text-center text-sm text-hf-stone-600">Calculando...</p>
        )}

        {simulacao && (
          <>
            <div className="flex items-center justify-between gap-3.5 rounded-[18px] bg-gradient-to-br from-hf-green-800 to-hf-green-900 p-5 text-white">
              <div>
                <p className="m-0 mb-1 text-[12.5px] opacity-80">Você recebe (estimado)</p>
                <p className="m-0 text-[26px] font-extrabold tabular-nums tracking-tight">
                  {formatarMoeda(meuDivisao?.valor ?? 0)}
                </p>
                <p className="m-0 mt-1.5 text-xs opacity-85">
                  Seu percentual: {meuDivisao?.percentual ?? 0}%
                </p>
              </div>
              <div className="relative h-[74px] w-[74px] shrink-0">
                <svg width="74" height="74" viewBox="0 0 74 74" className="-rotate-90">
                  <circle cx="37" cy="37" r={RAIO_ANEL} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="7" />
                  <circle
                    cx="37"
                    cy="37"
                    r={RAIO_ANEL}
                    fill="none"
                    stroke="#8fe6a0"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={CIRCUNFERENCIA_ANEL}
                    strokeDashoffset={offsetAnel}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[15px] font-extrabold">
                  {percentualAnel}%
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2.5 text-base font-extrabold text-hf-stone-900">Resumo do período</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2 rounded-2xl border border-hf-line p-3.5">
                  <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-hf-blue-bg">
                    <ShoppingCart className="h-[17px] w-[17px] text-hf-blue" />
                  </div>
                  <span className="text-xs text-hf-stone-600">Receita (Vendas)</span>
                  <span className="-mt-1.5 text-[17px] font-extrabold tabular-nums">{formatarMoeda(simulacao.receita)}</span>
                </div>
                <div className="flex flex-col gap-2 rounded-2xl border border-hf-line p-3.5">
                  <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-hf-red-bg">
                    <Wallet className="h-[17px] w-[17px] text-hf-red" />
                  </div>
                  <span className="text-xs text-hf-stone-600">Despesas</span>
                  <span className="-mt-1.5 text-[17px] font-extrabold tabular-nums">{formatarMoeda(simulacao.despesas)}</span>
                </div>
                <div className="flex flex-col gap-2 rounded-2xl border border-hf-line p-3.5">
                  <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-hf-green-100">
                    <TrendingUp className="h-[17px] w-[17px] text-hf-green-600" />
                  </div>
                  <span className="text-xs text-hf-stone-600">Lucro líquido</span>
                  <span
                    className={
                      '-mt-1.5 text-[17px] font-extrabold tabular-nums ' +
                      (simulacao.lucroLiquido < 0 ? 'text-hf-red' : '')
                    }
                  >
                    {formatarMoeda(simulacao.lucroLiquido)}
                  </span>
                </div>
                <div className="flex flex-col gap-2 rounded-2xl border border-hf-line p-3.5">
                  <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-hf-amber-bg">
                    <Package className="h-[17px] w-[17px] text-hf-amber" />
                  </div>
                  <span className="text-xs text-hf-stone-600">Caixas vendidas</span>
                  <span className="-mt-1.5 text-[17px] font-extrabold tabular-nums">{simulacao.caixasVendidas}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2.5 flex items-baseline justify-between">
                <h3 className="text-base font-extrabold text-hf-stone-900">Divisão do lucro</h3>
                <Link
                  to={`/sociedades/${sociedadeId}/socios`}
                  className="flex items-center gap-0.5 text-[12.5px] font-bold text-hf-green-700"
                >
                  Ver sócios
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <div>
                {simulacao.divisao.map((d) => {
                  const socio = socios.find((s) => s.usuario_id === d.socio_id);
                  const souEu = d.socio_id === usuarioId;
                  return (
                    <div
                      key={d.socio_id}
                      className="flex items-center justify-between border-b border-hf-cream-100 py-3 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-hf-green-100 text-[13px] font-extrabold text-hf-green-800">
                          {iniciais(d.nome)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-hf-stone-900">
                              {d.nome}
                              {souEu ? ' (Você)' : ''}
                            </span>
                            {socio && (
                              <span className="rounded-full bg-hf-green-100 px-1.5 py-0.5 text-[10px] font-bold text-hf-green-700">
                                {ROTULO_PAPEL_SOCIO[socio.papel]}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[11.5px] text-hf-stone-400">Percentual: {d.percentual}%</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={
                            'text-[14.5px] font-extrabold tabular-nums ' + (d.valor < 0 ? 'text-hf-red' : '')
                          }
                        >
                          {formatarMoeda(d.valor)}
                        </div>
                        <div className="text-[10.5px] text-hf-stone-400">A receber</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="mb-2.5 text-base font-extrabold text-hf-stone-900">Atalhos rápidos</h3>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/safras/${safraId}/vendas`)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-hf-green-100">
                    <CirclePlus className="h-[21px] w-[21px] text-hf-green-600" />
                  </div>
                  <span className="text-center text-[10.5px] font-bold leading-tight text-hf-stone-700">
                    Nova venda
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/safras/${safraId}/despesas`)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-hf-red-bg">
                    <CircleMinus className="h-[21px] w-[21px] text-hf-red" />
                  </div>
                  <span className="text-center text-[10.5px] font-bold leading-tight text-hf-stone-700">
                    Nova despesa
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/safras/${safraId}/despesas-pessoais`)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-hf-blue-bg">
                    <PiggyBank className="h-[21px] w-[21px] text-hf-blue" />
                  </div>
                  <span className="text-center text-[10.5px] font-bold leading-tight text-hf-stone-700">
                    Despesas pessoais
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/safras/${safraId}/acertos`)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-hf-amber-bg">
                    <FileText className="h-[21px] w-[21px] text-hf-amber" />
                  </div>
                  <span className="text-center text-[10.5px] font-bold leading-tight text-hf-stone-700">
                    Registrar acerto
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
