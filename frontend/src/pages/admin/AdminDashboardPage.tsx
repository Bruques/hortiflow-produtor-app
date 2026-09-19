import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandIcon } from '@/components/BrandMark';
import { dashboardRequest, listarPlanosRequest } from '@/services/admin';
import type { PlanoAdmin } from '@/types/assinatura';
import type { DashboardAdmin } from '@/types/adminDashboard';
import DetalheProdutor from './dashboard/DetalheProdutor';
import Funil from './dashboard/Funil';
import GraficoCrescimento from './dashboard/GraficoCrescimento';
import GraficoReceita from './dashboard/GraficoReceita';
import ListaAtencao from './dashboard/ListaAtencao';
import ResumoKpis from './dashboard/ResumoKpis';
import TabelaProdutores from './dashboard/TabelaProdutores';
import UltimosPagamentos from './dashboard/UltimosPagamentos';

const PAINEL = 'min-w-0 rounded-2xl border border-hf-line bg-white p-4';

function Painel({ titulo, subtitulo, extra, children }: { titulo: string; subtitulo: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={PAINEL}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div>
          <h2 className="m-0 font-rounded text-tituloSecao font-extrabold text-hf-stone-900">{titulo}</h2>
          <p className="mb-0 mt-0.5 text-legenda text-hf-stone-600">{subtitulo}</p>
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}

// Spec 28 — painel do dono: receita, assinantes, pagamentos e ações sobre cada produtor.
// Uso exclusivo do desenvolvedor (login de admin separado, spec 18), por isso é desktop-first,
// mas as seções empilham e a tabela rola de lado no celular.
export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [dados, setDados] = useState<DashboardAdmin | null>(null);
  const [planos, setPlanos] = useState<PlanoAdmin[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout>>();

  // Recarrega sem esvaziar a tela: quem está com a gaveta aberta não pode perder o lugar.
  const carregar = useCallback(() => {
    return Promise.all([dashboardRequest(), listarPlanosRequest()])
      .then(([d, p]) => {
        setDados(d);
        setPlanos(p);
        setErro(null);
      })
      .catch(() => setErro('Não foi possível carregar o painel'));
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const avisar = useCallback((mensagem: string) => {
    setAviso(mensagem);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAviso(null), 3500);
  }, []);

  const fechar = useCallback(() => setSelecionado(null), []);
  const produtor = dados?.produtores.find((p) => p.usuarioId === selecionado) ?? null;

  const agora = new Date();
  const mesAtual = dados?.receitaPorMes[dados.receitaPorMes.length - 1]?.mes ?? '';
  const mesAnterior = dados?.receitaPorMes[dados.receitaPorMes.length - 2]?.mes ?? '';

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-12 sm:px-7">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 pb-3.5 pt-[18px]">
        <div className="mr-auto flex items-center gap-2.5">
          <BrandIcon className="h-[34px] w-[34px] text-hf-green-800" />
          <div>
            <h1 className="m-0 font-rounded text-[19px] font-extrabold leading-none text-hf-stone-900">Central HortiFlow</h1>
            <small className="mt-0.5 block text-auxiliar text-hf-stone-600">Painel do dono · só você acessa</small>
          </div>
        </div>
        <span className="text-auxiliar text-hf-stone-400">Atualizado às {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        <Link to="/admin/assinaturas" className="text-legenda font-bold text-hf-green-700 underline">Planos e limites</Link>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('adminToken');
            navigate('/admin/login');
          }}
          className="border-0 bg-transparent p-0 text-legenda font-bold text-hf-stone-400"
        >
          Sair
        </button>
      </header>

      {erro && !dados && (
        <div className={PAINEL}>
          <p className="mt-0 text-corpo font-medium text-hf-red">{erro}</p>
          <button type="button" onClick={() => void carregar()} className="rounded-xl bg-hf-green-700 px-4 py-2.5 text-textoPequeno font-bold text-white">Tentar de novo</button>
        </div>
      )}

      {!dados && !erro && <p className="py-16 text-center text-corpo text-hf-stone-400">Carregando...</p>}

      {dados && (
        <div className="flex flex-col gap-3">
          <ResumoKpis resumo={dados.resumo} mesAtual={mesAtual} mesAnterior={mesAnterior} />

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <Painel titulo="Receita por mês" subtitulo="Pagamentos confirmados, com plano anual inteiro no mês em que entrou">
              <GraficoReceita dados={dados.receitaPorMes} />
            </Painel>
            <Painel titulo="Precisa da sua atenção" subtitulo="Quem está perto de perder o acesso ou travou no caminho">
              <ListaAtencao itens={dados.atencao} produtores={dados.produtores} onAbrir={setSelecionado} />
            </Painel>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <Painel
              titulo="Crescimento"
              subtitulo="Acumulado por semana"
              extra={
                <div className="flex gap-3.5 text-auxiliar text-hf-stone-600">
                  <span><i className="mr-1.5 inline-block h-[3px] w-3.5 rounded-sm align-middle" style={{ background: '#5f84ad' }} />Cadastrados</span>
                  <span><i className="mr-1.5 inline-block h-[3px] w-3.5 rounded-sm align-middle" style={{ background: '#1e6b3e' }} />Já pagaram</span>
                </div>
              }
            >
              <GraficoCrescimento dados={dados.crescimentoSemanal} />
            </Painel>
            <Painel titulo="Do cadastro ao pagamento" subtitulo="Onde os produtores ficam pelo caminho">
              <Funil funil={dados.funil} />
            </Painel>
          </div>

          <Painel titulo="Últimos pagamentos" subtitulo="Quem pagou, quanto, por qual meio e até quando o plano vai">
            <UltimosPagamentos pagamentos={dados.ultimosPagamentos} onAbrir={setSelecionado} />
          </Painel>

          <Painel titulo="Produtores" subtitulo="Toque em um nome para ver o histórico e gerar cobrança, liberar, cancelar ou bloquear">
            <TabelaProdutores produtores={dados.produtores} onAbrir={setSelecionado} />
          </Painel>
        </div>
      )}

      {produtor && <DetalheProdutor produtor={produtor} planos={planos} onFechar={fechar} onAtualizar={() => void carregar()} avisar={avisar} />}

      {aviso && (
        <div role="status" aria-live="polite" className="fixed bottom-5 left-1/2 z-50 max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl bg-hf-stone-900 px-[18px] py-[11px] text-corpo font-semibold text-white shadow-xl">
          {aviso}
        </div>
      )}
    </div>
  );
}
