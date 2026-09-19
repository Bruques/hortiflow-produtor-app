import { useEffect, useRef, useState } from 'react';
import { atribuirPlanoRequest, cancelarAssinaturaRequest, definirBloqueioRequest } from '@/services/admin';
import type { PlanoAdmin } from '@/types/assinatura';
import type { ProdutorDashboard } from '@/types/adminDashboard';
import CobrancaPainel from './CobrancaPainel';
import LiberarAcessoPainel from './LiberarAcessoPainel';
import { brl, data, dataCurta, linkWhatsApp, prazoDoAcesso, ROTULO_FAIXA_MEEIROS, ROTULO_METODO, rotuloLocalizacao } from './formatos';
import Pilula from './Pilula';

interface Props {
  produtor: ProdutorDashboard;
  planos: PlanoAdmin[];
  onFechar: () => void;
  onAtualizar: () => void;
  avisar: (mensagem: string) => void;
}

const BOTAO_PERIGO = 'rounded-xl border border-hf-red bg-white px-4 py-2.5 text-textoPequeno font-semibold text-[#9c2727]';

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h4 className="m-0 mb-2 text-etiqueta font-bold uppercase tracking-wider text-hf-stone-400">{titulo}</h4>
      {children}
    </section>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-auxiliar text-hf-stone-400">{rotulo}</dt>
      <dd className="m-0 mt-0.5 font-semibold text-hf-stone-900">{children}</dd>
    </div>
  );
}

// Gaveta com tudo sobre um produtor: assinatura, histórico de pagamentos e as ações do dono
// (gerar cobrança, liberar acesso, trocar plano, cancelar, bloquear). No celular abre quase em
// tela cheia; no desktop, como painel lateral.
export default function DetalheProdutor({ produtor, planos, onFechar, onAtualizar, avisar }: Props) {
  const [confirmar, setConfirmar] = useState<'cancelar' | 'bloqueio' | 'plano' | null>(null);
  // Plano escolhido no seletor, ainda não aplicado: só vale depois do botão e da confirmação.
  const [planoNovo, setPlanoNovo] = useState(produtor.plano?.id ?? '');
  const [trabalhando, setTrabalhando] = useState(false);
  const botaoFechar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    botaoFechar.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  // Trocar de produtor com a gaveta aberta não pode herdar uma confirmação pendente do anterior.
  useEffect(() => setConfirmar(null), [produtor.usuarioId]);

  // Depois de aplicar (ou ao trocar de produtor), o seletor volta a refletir o plano real.
  useEffect(() => setPlanoNovo(produtor.plano?.id ?? ''), [produtor.usuarioId, produtor.plano?.id]);

  const prazo = prazoDoAcesso(produtor.dataFimAcesso);
  const nomePlanoNovo = planos.find((p) => p.id === planoNovo)?.nome ?? '';
  const planoAlterado = planoNovo !== '' && planoNovo !== (produtor.plano?.id ?? '');
  const ultimo = produtor.pagamentos[0];

  async function executar(acao: () => Promise<void>, sucesso: string) {
    setTrabalhando(true);
    try {
      await acao();
      avisar(sucesso);
      setConfirmar(null);
      onAtualizar();
    } catch (err) {
      const erro = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      avisar(erro ?? 'Não foi possível concluir a ação');
    } finally {
      setTrabalhando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/50" onClick={onFechar} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalhe-titulo"
        className="absolute inset-x-0 bottom-0 top-[6vh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-8 pt-5 shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:w-[480px] md:rounded-l-2xl md:rounded-tr-none md:px-6"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <h3 id="detalhe-titulo" className="m-0 font-rounded text-tituloTela font-extrabold leading-tight text-hf-stone-900">{produtor.nome}</h3>
            <p className="mb-2 mt-1 text-corpo text-hf-stone-600">
              {produtor.telefone} · cadastro em {data(produtor.criadoEm)} ·{' '}
              <a href={linkWhatsApp(produtor.telefone)} target="_blank" rel="noopener noreferrer" className="font-semibold text-hf-green-700 underline">WhatsApp</a>
            </p>
            <Pilula situacao={produtor.situacao} />
          </div>
          <button ref={botaoFechar} type="button" onClick={onFechar} aria-label="Fechar detalhes" className="ml-auto h-9 w-9 shrink-0 rounded-[10px] border border-hf-line bg-white text-lg leading-none">
            ✕
          </button>
        </div>

        <Secao titulo="Assinatura">
          <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 text-corpo">
            <Dado rotulo="Plano">{produtor.plano ? `${produtor.plano.nome}${produtor.ciclo ? ` · ${produtor.ciclo.toLowerCase()}` : ''}` : 'Sem plano'}</Dado>
            <Dado rotulo="Acesso até">
              <span className="tabular-nums">{produtor.dataFimAcesso ? data(produtor.dataFimAcesso) : '—'}</span>{' '}
              <span className="font-normal text-hf-stone-400">({prazo.texto})</span>
            </Dado>
            <Dado rotulo="Total já pago"><span className="tabular-nums">{brl(produtor.totalPago)}</span></Dado>
            <Dado rotulo="Lavouras ativas"><span className="tabular-nums">{produtor.limiteSafras === null ? produtor.safrasAtivas : `${produtor.safrasAtivas} de ${produtor.limiteSafras}`}</span></Dado>
            <Dado rotulo="Última forma de pagamento">{ultimo ? ROTULO_METODO[ultimo.metodo] : '—'}</Dado>
            <Dado rotulo="Renovação">{produtor.renovacaoAutomatica ? 'Automática' : 'Manual, você cobra'}</Dado>
          </dl>
        </Secao>

        <Secao titulo="Histórico de pagamentos">
          {produtor.pagamentos.length === 0 ? (
            <p className="m-0 text-legenda text-hf-stone-400">Nenhum pagamento ainda.</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {produtor.pagamentos.map((p, i) => (
                <li key={`${p.data}-${i}`} className="flex justify-between gap-3 border-t border-hf-line/60 py-2 text-textoPequeno first:border-t-0">
                  <div>
                    <b className="tabular-nums">{p.valor > 0 ? brl(p.valor) : 'Cortesia'}</b>{' '}
                    <span className="text-hf-stone-400">{ROTULO_METODO[p.metodo]}</span>
                  </div>
                  <span className="whitespace-nowrap tabular-nums text-hf-stone-400">{dataCurta(p.periodoInicio)} → {dataCurta(p.periodoFim)}</span>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        {produtor.perfil && (
          <Secao titulo="Perfil respondido no onboarding">
            <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 text-corpo">
              <Dado rotulo="Meeiros">{ROTULO_FAIXA_MEEIROS[produtor.perfil.faixaMeeiros] ?? produtor.perfil.faixaMeeiros}</Dado>
              <Dado rotulo="Pés de morango"><span className="tabular-nums">{produtor.perfil.quantidadePes?.toLocaleString('pt-BR') ?? '—'}</span></Dado>
              <div className="col-span-2"><Dado rotulo="Onde produz">{rotuloLocalizacao(produtor.perfil.localizacao, produtor.perfil.localizacaoOutra)}</Dado></div>
            </dl>
          </Secao>
        )}

        <Secao titulo="Gerar cobrança">
          <CobrancaPainel key={produtor.usuarioId} produtor={produtor} planos={planos} avisar={avisar} onAtualizar={onAtualizar} />
        </Secao>

        <Secao titulo="Liberar acesso">
          <LiberarAcessoPainel key={produtor.usuarioId} produtor={produtor} avisar={avisar} onAtualizar={onAtualizar} />
        </Secao>

        <Secao titulo="Outras ações">
          {confirmar ? (
            <div className="rounded-xl border border-hf-red bg-hf-red-bg p-3.5">
              <p className="mb-3 mt-0 text-corpo text-hf-stone-900">
                {confirmar === 'plano'
                  ? `Trocar o plano de ${produtor.nome} de ${produtor.plano?.nome ?? 'sem plano'} para ${nomePlanoNovo}? O limite de lavouras ativas passa a valer o do novo plano. O acesso e os pagamentos já feitos não mudam.`
                  : confirmar === 'cancelar'
                  ? `Cancelar a assinatura de ${produtor.nome}? A cobrança recorrente é interrompida e o acesso segue até ${produtor.dataFimAcesso ? data(produtor.dataFimAcesso) : 'o fim do que já pagou'}.`
                  : produtor.bloqueado
                    ? `Desbloquear ${produtor.nome}? O produtor volta a conseguir entrar no app.`
                    : `Bloquear ${produtor.nome}? O login é impedido agora, mesmo com o plano pago.`}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={trabalhando}
                  onClick={() =>
                    confirmar === 'plano'
                      ? executar(() => atribuirPlanoRequest(produtor.usuarioId, planoNovo), `Plano trocado para ${nomePlanoNovo}`)
                      : confirmar === 'cancelar'
                      ? executar(() => cancelarAssinaturaRequest(produtor.usuarioId), 'Assinatura cancelada')
                      : executar(() => definirBloqueioRequest(produtor.usuarioId, !produtor.bloqueado), produtor.bloqueado ? 'Conta desbloqueada' : 'Conta bloqueada')
                  }
                  className="rounded-xl bg-hf-red px-4 py-2.5 text-textoPequeno font-bold text-white disabled:opacity-50"
                >
                  {confirmar === 'plano' ? `Sim, trocar para ${nomePlanoNovo}` : confirmar === 'cancelar' ? 'Sim, cancelar assinatura' : produtor.bloqueado ? 'Sim, desbloquear' : 'Sim, bloquear'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirmar === 'plano') setPlanoNovo(produtor.plano?.id ?? '');
                    setConfirmar(null);
                  }}
                  className="rounded-xl border border-hf-line bg-white px-4 py-2.5 text-textoPequeno font-semibold"
                >
                  Voltar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Trocar plano"
                  value={planoNovo}
                  onChange={(e) => setPlanoNovo(e.target.value)}
                  className="h-10 rounded-[10px] border border-hf-line bg-white px-3 text-corpo"
                >
                  {!produtor.plano && <option value="">Sem plano</option>}
                  {planos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
                {planoAlterado && (
                  <button type="button" className="rounded-xl bg-hf-green-700 px-4 py-2.5 text-textoPequeno font-bold text-white" onClick={() => setConfirmar('plano')}>
                    Trocar plano
                  </button>
                )}
                {produtor.situacao !== 'CANCELADA' && (
                  <button type="button" className={BOTAO_PERIGO} onClick={() => setConfirmar('cancelar')}>Cancelar assinatura</button>
                )}
                <button type="button" className={BOTAO_PERIGO} onClick={() => setConfirmar('bloqueio')}>{produtor.bloqueado ? 'Desbloquear conta' : 'Bloquear conta'}</button>
              </div>
              <p className="mb-0 mt-2 text-auxiliar text-hf-stone-400">Escolher outro plano só prepara a troca: ela só vale depois de "Trocar plano" e da confirmação. Cancelar encerra a cobrança e o produtor usa até o fim do que já pagou. Bloquear impede o login na hora.</p>
            </>
          )}
        </Secao>
      </aside>
    </div>
  );
}
