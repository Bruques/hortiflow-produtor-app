import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, RefreshCw, PhoneCall, Mail, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  checkoutRequest,
  escolherPlanoRequest,
  listarPlanosRequest,
  statusAssinaturaRequest,
  verificarPedidoPixRequest,
  type PlanoCatalogo,
} from '@/services/assinatura';
import { logoutRequest } from '@/services/auth';
import { cn, formatarMoeda } from '@/lib/utils';
import type { AssinaturaStatus } from '@/types/assinatura';

// Contato fixo: mesmo dado de AssinaturaBloqueadaPage.tsx — manter em sincronia com
// WHATSAPP_CONTATO/EMAIL_CONTATO no backend (backend/.env), duplicado aqui pelo mesmo
// motivo (frontend sem acesso a envs do backend).
const WHATSAPP_CONTATO = '(35) 99730-2015';
const EMAIL_CONTATO = 'contato.hortiflow@gmail.com';

interface PixGerado {
  orderId: string;
  qrCode: string;
  qrCodeBase64: string;
  dataExpiracao: string;
}

// Spec 25 — checkout pós-trial, equivalente ao mobile/src/screens/CheckoutScreen.tsx.
//
// Cartão: "abrir o checkout hospedado" é simplesmente redirecionar a aba pro `initPoint`.
// Pix: NÃO redireciona — usa a API de Orders do Mercado Pago (ver backend/src/services/
// mercadopago.service.ts), mostrando o QR Code direto nesta página. Botão "Já paguei —
// verificar" é uma rede de segurança enquanto o formato do webhook de pedidos não foi
// validado contra um evento real.
//
// Troca de plano no checkout (2026-09-15): o produtor só via a opção de assinar o plano já
// atribuído a ele, sem poder mudar pra outro na hora de pagar (gap encontrado durante o uso
// real, fora do escopo original da spec 25 — "Fica de fora: upgrade/downgrade automático").
// Reaproveita o mesmo cartão de plano da tela de onboarding (OnboardingPlanoPage). Se o
// produtor trocar de plano aqui, confirma via PATCH /assinatura/plano antes do checkout.
export default function CheckoutPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<AssinaturaStatus | null>(null);
  const [planos, setPlanos] = useState<PlanoCatalogo[]>([]);
  const [planoSelecionadoId, setPlanoSelecionadoId] = useState('');
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ciclo, setCiclo] = useState<'MENSAL' | 'ANUAL'>('ANUAL');
  const [metodo, setMetodo] = useState<'CARTAO' | 'PIX'>('CARTAO');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pix, setPix] = useState<PixGerado | null>(null);
  const [pixStatus, setPixStatus] = useState('action_required');
  const [copiado, setCopiado] = useState(false);
  const [verificando, setVerificando] = useState(false);

  // Bug relatado pelo dev (2026-09-15): o pagamento confirma via webhook, mas se o produtor
  // só der F5 nesta tela (em vez de navegar de volta manualmente), ela recarregava do zero e
  // mostrava o formulário de checkout de novo, como se ainda estivesse pendente — mesmo já
  // pago. Corrigido checando `vencida` aqui: se o acesso já está liberado, redireciona pra
  // Início em vez de renderizar o checkout.
  useEffect(() => {
    Promise.all([statusAssinaturaRequest(), listarPlanosRequest()])
      .then(([dados, catalogo]) => {
        if (!dados.vencida) {
          navigate('/', { replace: true });
          return;
        }
        setStatus(dados);
        setPlanos(catalogo);
        if (dados.plano) setPlanoSelecionadoId(dados.plano.id);
        if (dados.ciclo) setCiclo(dados.ciclo);
      })
      .catch(() => setErro('Não foi possível carregar sua assinatura'))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function alternarExpandido(id: string) {
    setExpandidoId((atual) => (atual === id ? null : id));
    setPlanoSelecionadoId(id);
  }

  async function irParaPagamento() {
    if (!planoSelecionadoId) return;
    setProcessando(true);
    setErro(null);
    try {
      if (planoSelecionadoId !== status?.plano?.id) {
        await escolherPlanoRequest(planoSelecionadoId, ciclo);
      }
      const resultado = await checkoutRequest({ planoId: planoSelecionadoId, ciclo, metodo });

      if (resultado.tipo === 'PIX') {
        setPix({
          orderId: resultado.mpOrderId,
          qrCode: resultado.qrCode,
          qrCodeBase64: resultado.qrCodeBase64,
          dataExpiracao: resultado.dataExpiracao,
        });
        setPixStatus('action_required');
        return;
      }

      window.location.href = resultado.initPoint;
    } catch {
      setErro('Não foi possível iniciar o pagamento');
      setProcessando(false);
    }
  }

  async function copiarCodigoPix() {
    if (!pix) return;
    await navigator.clipboard.writeText(pix.qrCode);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  // Sem esse botão, quem cai no checkout (acesso vencido) ficava preso sem jeito de trocar
  // de conta — mesmo motivo da AssinaturaBloqueadaPage.tsx.
  function sair() {
    logoutRequest(false);
    localStorage.removeItem('token');
    navigate('/login');
  }

  async function jaPagueiVerificar() {
    if (!pix) return;
    setVerificando(true);
    setErro(null);
    try {
      const resultado = await verificarPedidoPixRequest(pix.orderId);
      setPixStatus(resultado.pedidoStatus);
      if (!resultado.vencida) {
        window.location.href = '/';
      }
    } catch {
      setErro('Não foi possível verificar o pagamento');
    } finally {
      setVerificando(false);
    }
  }

  if (pix) {
    const horaExpiracao = pix.dataExpiracao
      ? new Date(pix.dataExpiracao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '—';
    return (
      <div className="min-h-screen bg-hf-cream-50 px-6 py-10">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-4 text-center">
          <h1 className="font-rounded text-[19px] font-extrabold text-hf-stone-900">Escaneie pra pagar</h1>
          <p className="text-[13px] leading-relaxed text-hf-stone-600">
            Abra o app do seu banco, escaneie o QR Code ou cole o código copia-e-cola.
          </p>

          <img
            src={`data:image/png;base64,${pix.qrCodeBase64}`}
            alt="QR Code Pix"
            className="h-60 w-60 rounded-2xl border border-hf-line bg-white"
          />

          <button
            type="button"
            onClick={copiarCodigoPix}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-hf-green-700 py-3 text-sm font-bold text-hf-green-700"
          >
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiado ? 'Código copiado' : 'Copiar código Pix'}
          </button>

          <div className="w-full rounded-2xl border border-hf-line p-3">
            <p className="m-0 text-[13px] text-hf-stone-600">Vence em: {horaExpiracao}</p>
            <p className="m-0 text-[13px] text-hf-stone-600">
              Status: {pixStatus === 'action_required' ? 'aguardando pagamento' : pixStatus}
            </p>
          </div>

          <button
            type="button"
            onClick={jaPagueiVerificar}
            disabled={verificando}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-hf-green-100 py-3 text-sm font-bold text-hf-green-800 disabled:opacity-60"
          >
            <RefreshCw className={cn('h-4 w-4', verificando && 'animate-spin')} />
            {verificando ? 'Verificando...' : 'Já paguei — verificar'}
          </button>

          {erro && <p className="text-sm font-medium text-hf-red">{erro}</p>}

          <p className="text-[12.5px] leading-relaxed text-hf-stone-600">
            A confirmação é automática assim que o Mercado Pago aprovar.
          </p>

          <a href="/" className="text-sm font-bold text-hf-green-700">
            Voltar pro início
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hf-cream-50 px-6 py-10">
      <div className="mx-auto flex max-w-sm flex-col gap-5">
        <div className="text-center">
          <h1 className="font-rounded text-[19px] font-extrabold text-hf-stone-900">
            Assinar {planos.find((p) => p.id === planoSelecionadoId)?.nome ?? ''}
          </h1>
          <p className="mt-1 text-[13px] leading-relaxed text-hf-stone-600">
            Escolha o plano, o ciclo e a forma de pagamento pra continuar usando o HortiFlow.
          </p>
        </div>

        {carregando && <p className="text-center text-sm text-hf-stone-400">Carregando...</p>}

        {!carregando && (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-bold text-hf-stone-900">Plano</span>
              <div className="flex flex-col gap-2.5">
                {planos.map((plano) => {
                  const expandido = expandidoId === plano.id;
                  const selecionado = planoSelecionadoId === plano.id;
                  return (
                    <button
                      key={plano.id}
                      type="button"
                      onClick={() => alternarExpandido(plano.id)}
                      className={cn(
                        'flex flex-col rounded-2xl border-[1.5px] border-hf-line bg-white p-4 text-left',
                        selecionado && 'border-hf-green-700 bg-hf-green-100'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="m-0 text-[15px] font-extrabold text-hf-stone-900">{plano.nome}</p>
                          {ciclo === 'MENSAL' ? (
                            <p className="m-0 mt-0.5 text-[17px] font-extrabold text-hf-green-800">{formatarMoeda(plano.valorMensal)}/mês</p>
                          ) : (
                            <>
                              <p className="m-0 mt-0.5 text-[17px] font-extrabold text-hf-green-800">
                                {formatarMoeda(plano.valorAnualExibidoPorMes)}/mês
                              </p>
                              <p className="m-0 text-[11.5px] text-hf-stone-600">{formatarMoeda(plano.valorAnualTotal)}/ano</p>
                            </>
                          )}
                        </div>
                        {selecionado && (
                          <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-hf-green-700">
                            <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                          </span>
                        )}
                      </div>

                      {expandido && (
                        <div className="mt-3 flex flex-col gap-2 border-t border-hf-line pt-3">
                          <LinhaRecurso rotulo="Safras ativas" valor={plano.limiteSafrasAtivas === null ? 'Ilimitado' : `Até ${plano.limiteSafrasAtivas}`} />
                          <LinhaRecurso rotulo="Importação por IA" valor={`Até ${plano.limiteImportacaoIAMes}/mês`} />
                          <LinhaRecurso rotulo="Despesas pessoais" valor={plano.despesasPessoais ? 'Incluso' : 'Não incluso'} />
                          <LinhaRecurso rotulo="Suporte prioritário" valor={plano.suportePrioritario ? 'Incluso' : 'Não incluso'} />
                          <LinhaRecurso
                            rotulo="Implantação assistida"
                            valor={ciclo === 'ANUAL' || plano.implantacaoAssistidaMensal ? 'Incluso' : 'Não incluso'}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-bold text-hf-stone-900">Ciclo</span>
              <div className="flex gap-2">
                <Opcao rotulo="Mensal" ativo={ciclo === 'MENSAL'} onClick={() => setCiclo('MENSAL')} />
                <Opcao rotulo="Anual" ativo={ciclo === 'ANUAL'} onClick={() => setCiclo('ANUAL')} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-bold text-hf-stone-900">Forma de pagamento</span>
              <div className="flex gap-2">
                <Opcao rotulo="Cartão de crédito" ativo={metodo === 'CARTAO'} onClick={() => setMetodo('CARTAO')} />
                <Opcao rotulo="Pix" ativo={metodo === 'PIX'} onClick={() => setMetodo('PIX')} />
              </div>
            </div>

            {ciclo === 'MENSAL' && metodo === 'PIX' && (
              <p className="rounded-xl bg-hf-amber-bg p-3 text-[12px] leading-relaxed text-hf-amber">
                No Pix mensal não há débito automático — você recebe um novo código todo mês e precisa pagar manualmente.
              </p>
            )}

            {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}

            <Button
              size="lg"
              className="w-full bg-hf-green-800 hover:bg-hf-green-900"
              onClick={irParaPagamento}
              disabled={processando}
            >
              {processando ? 'Processando...' : metodo === 'PIX' ? 'Gerar QR Code' : 'Ir para pagamento'}
            </Button>

            <div className="mt-1 flex w-full flex-col gap-3 rounded-2xl border border-hf-line p-4">
              <p className="m-0 text-center text-xs font-bold text-hf-stone-400">Prefere ser atendido diretamente?</p>
              <a
                href={`https://wa.me/55${WHATSAPP_CONTATO.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-hf-green-800 py-2.5 text-[13px] font-bold text-white"
              >
                <PhoneCall className="h-4 w-4" strokeWidth={2.3} />
                WhatsApp {WHATSAPP_CONTATO}
              </a>
              <a
                href={`mailto:${EMAIL_CONTATO}`}
                className="flex items-center justify-center gap-2 rounded-xl border border-hf-line py-2.5 text-[13px] font-bold text-hf-stone-900"
              >
                <Mail className="h-4 w-4" strokeWidth={2.3} />
                {EMAIL_CONTATO}
              </a>
            </div>

            <button
              type="button"
              onClick={sair}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-hf-red py-3.5 text-sm font-bold text-hf-red"
            >
              <LogOut className="h-[18px] w-[18px]" />
              Sair
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Opcao({ rotulo, ativo, onClick }: { rotulo: string; ativo: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded-xl border-[1.5px] border-hf-line bg-white py-3 text-[13px] font-bold text-hf-stone-600',
        ativo && 'border-hf-green-700 bg-hf-green-100 text-hf-green-800'
      )}
    >
      {rotulo}
    </button>
  );
}

function LinhaRecurso({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[12.5px] text-hf-stone-600">{rotulo}</span>
      <span className="text-[12.5px] font-bold text-hf-stone-900">{valor}</span>
    </div>
  );
}
