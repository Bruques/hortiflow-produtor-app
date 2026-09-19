import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { gerarCobrancaRequest, verificarPixRequest } from '@/services/admin';
import type { PlanoAdmin } from '@/types/assinatura';
import type { CobrancaGerada, NovaCobranca, ProdutorDashboard } from '@/types/adminDashboard';
import { brl, data, linkWhatsApp } from './formatos';

interface Props {
  produtor: ProdutorDashboard;
  planos: PlanoAdmin[];
  avisar: (mensagem: string) => void;
  onAtualizar: () => void;
}

type TipoDesconto = 'NENHUM' | 'PERCENTUAL' | 'VALOR';

const CHIP = 'rounded-full border px-3 py-1.5 text-legenda font-semibold';
const chip = (ativo: boolean) => cn(CHIP, ativo ? 'border-hf-green-700 bg-hf-green-700 text-white' : 'border-hf-line bg-white text-hf-stone-600');

// Mesma regra do backend (src/lib/desconto.ts), só pra mostrar o valor final antes de gerar.
// Quem decide de verdade é o backend, que valida de novo.
function calcularFinal(base: number, tipo: TipoDesconto, valor: number): { final: number } | { erro: string } {
  const baseC = Math.round(base * 100);
  let descC = 0;
  if (tipo === 'PERCENTUAL') {
    if (!(valor > 0 && valor < 100)) return { erro: 'Use uma porcentagem entre 0 e 100' };
    descC = Math.round((baseC * valor) / 100);
  } else if (tipo === 'VALOR') {
    descC = Math.round(valor * 100);
    if (!(descC > 0 && descC < baseC)) return { erro: 'O desconto precisa ser maior que zero e menor que o preço' };
  }
  if (baseC - descC < 100) return { erro: 'O valor final não pode ser menor que R$ 1,00' };
  return { final: (baseC - descC) / 100 };
}

// Uma cobrança em aberto por vez: o ciclo gravado na assinatura decide quantos dias o webhook
// libera. Guardamos na sessão do navegador a última cobrança gerada pra avisar quando uma nova
// troca o ciclo antes da anterior ser paga.
const chavePendente = (id: string) => `hf-admin-cobranca-${id}`;
interface Pendente { ciclo: string; metodo: string; valorFinal: number; geradaEm: string; fimAntes: string | null }

function lerPendente(id: string): Pendente | null {
  try {
    const bruto = sessionStorage.getItem(chavePendente(id));
    return bruto ? (JSON.parse(bruto) as Pendente) : null;
  } catch {
    return null;
  }
}

function gravarPendente(id: string, p: Pendente) {
  try {
    sessionStorage.setItem(chavePendente(id), JSON.stringify(p));
  } catch {
    /* sem storage: só perde o aviso */
  }
}

export default function CobrancaPainel({ produtor, planos, avisar, onAtualizar }: Props) {
  const [planoId, setPlanoId] = useState(produtor.plano?.id ?? planos[1]?.id ?? planos[0]?.id ?? '');
  const [ciclo, setCiclo] = useState<'MENSAL' | 'ANUAL'>(produtor.ciclo ?? 'MENSAL');
  const [metodo, setMetodo] = useState<'PIX' | 'CARTAO'>('PIX');
  const [tipoDesconto, setTipoDesconto] = useState<TipoDesconto>('NENHUM');
  const [textoDesconto, setTextoDesconto] = useState('');
  const [gerando, setGerando] = useState(false);
  const [cobranca, setCobranca] = useState<CobrancaGerada | null>(null);
  const [pago, setPago] = useState(false);
  const [verificando, setVerificando] = useState(false);

  const plano = planos.find((p) => p.id === planoId);
  const precoBase = plano ? (ciclo === 'ANUAL' ? plano.valorAnual : plano.valorMensal) : 0;
  const valorDesconto = Number(textoDesconto.replace(',', '.')) || 0;
  const calculo = useMemo(() => calcularFinal(precoBase, tipoDesconto, valorDesconto), [precoBase, tipoDesconto, valorDesconto]);

  const pendente = lerPendente(produtor.usuarioId);
  const pendenteEmAberto = pendente && pendente.fimAntes === produtor.dataFimAcesso;
  const avisoCiclo = pendenteEmAberto && pendente.ciclo !== ciclo && !cobranca;

  const idPix = cobranca?.tipo === 'PIX' ? cobranca.mpOrderId : null;

  async function verificar(silencioso = false) {
    if (!idPix) return;
    setVerificando(true);
    try {
      const r = await verificarPixRequest(produtor.usuarioId, idPix);
      if (r.pago) {
        setPago(true);
        avisar('Pagamento confirmado, acesso liberado');
        onAtualizar();
      } else if (!silencioso) {
        avisar('Ainda não caiu. O acesso libera sozinho quando o Pix for pago');
      }
    } catch {
      if (!silencioso) avisar('Não foi possível verificar agora');
    } finally {
      setVerificando(false);
    }
  }

  // O webhook do Mercado Pago libera o acesso sozinho; isso só atualiza a tela enquanto o
  // dono está com o Pix aberto, sem ele precisar clicar em nada.
  useEffect(() => {
    if (!idPix || pago) return;
    const intervalo = setInterval(() => void verificar(true), 10000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idPix, pago]);

  async function gerar() {
    if ('erro' in calculo) return;
    const corpo: NovaCobranca = {
      planoId,
      ciclo,
      metodo,
      ...(tipoDesconto !== 'NENHUM' ? { desconto: { tipo: tipoDesconto, valor: valorDesconto } } : {}),
    };
    setGerando(true);
    try {
      const resultado = await gerarCobrancaRequest(produtor.usuarioId, corpo);
      setCobranca(resultado);
      setPago(false);
      gravarPendente(produtor.usuarioId, {
        ciclo,
        metodo,
        valorFinal: resultado.valorFinal,
        geradaEm: new Date().toISOString(),
        fimAntes: produtor.dataFimAcesso,
      });
      onAtualizar();
    } catch (err) {
      const erro = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      avisar(erro ?? 'Não foi possível gerar a cobrança');
    } finally {
      setGerando(false);
    }
  }

  async function copiar(texto: string, mensagem: string) {
    try {
      await navigator.clipboard.writeText(texto);
      avisar(mensagem);
    } catch {
      avisar('Não foi possível copiar. Selecione o texto e copie manualmente');
    }
  }

  const rotuloCiclo = ciclo === 'ANUAL' ? 'anual' : 'mensal';
  const textoZap =
    cobranca?.tipo === 'PIX'
      ? `Olá, ${produtor.nome.split(' ')[0]}! Segue o Pix do seu plano HortiFlow (${plano?.nome}, ${rotuloCiclo}): ${brl(cobranca.valorFinal)}.\n\nPix copia e cola:\n${cobranca.qrCode}`
      : cobranca?.tipo === 'CARTAO'
        ? `Olá, ${produtor.nome.split(' ')[0]}! Segue o link para pagar o plano HortiFlow (${plano?.nome}, ${rotuloCiclo}) no cartão: ${brl(cobranca.valorFinal)}.\n\n${cobranca.linkPagamento}`
        : '';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hf-line bg-hf-cream-50 p-3.5">
      {!cobranca && (
        <>
          <div>
            <label htmlFor="cobranca-plano" className="mb-1.5 block text-legenda font-semibold text-hf-stone-600">Plano</label>
            <select
              id="cobranca-plano"
              value={planoId}
              onChange={(e) => setPlanoId(e.target.value)}
              className="h-10 w-full rounded-[10px] border border-hf-line bg-white px-3 text-corpo"
            >
              {planos.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <span className="mb-1.5 block text-legenda font-semibold text-hf-stone-600">Ciclo</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ciclo da cobrança">
              <button type="button" aria-pressed={ciclo === 'MENSAL'} className={chip(ciclo === 'MENSAL')} onClick={() => setCiclo('MENSAL')}>Mensal</button>
              <button type="button" aria-pressed={ciclo === 'ANUAL'} className={chip(ciclo === 'ANUAL')} onClick={() => setCiclo('ANUAL')}>Anual</button>
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-legenda font-semibold text-hf-stone-600">Como vai pagar</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Forma de pagamento">
              <button type="button" aria-pressed={metodo === 'PIX'} className={chip(metodo === 'PIX')} onClick={() => setMetodo('PIX')}>Pix</button>
              <button type="button" aria-pressed={metodo === 'CARTAO'} className={chip(metodo === 'CARTAO')} onClick={() => setMetodo('CARTAO')}>Cartão de crédito</button>
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-legenda font-semibold text-hf-stone-600">Desconto</span>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tipo de desconto">
              <button type="button" aria-pressed={tipoDesconto === 'NENHUM'} className={chip(tipoDesconto === 'NENHUM')} onClick={() => setTipoDesconto('NENHUM')}>Sem desconto</button>
              <button type="button" aria-pressed={tipoDesconto === 'PERCENTUAL'} className={chip(tipoDesconto === 'PERCENTUAL')} onClick={() => setTipoDesconto('PERCENTUAL')}>Em %</button>
              <button type="button" aria-pressed={tipoDesconto === 'VALOR'} className={chip(tipoDesconto === 'VALOR')} onClick={() => setTipoDesconto('VALOR')}>Em R$</button>
              {tipoDesconto !== 'NENHUM' && (
                <input
                  id="cobranca-desconto"
                  inputMode="decimal"
                  value={textoDesconto}
                  onChange={(e) => setTextoDesconto(e.target.value)}
                  placeholder={tipoDesconto === 'PERCENTUAL' ? '10' : '20,00'}
                  aria-label={tipoDesconto === 'PERCENTUAL' ? 'Desconto em porcentagem' : 'Desconto em reais'}
                  className="h-9 w-28 rounded-[10px] border border-hf-line bg-white px-3 text-corpo tabular-nums"
                />
              )}
            </div>
          </div>

          <div className="rounded-[10px] bg-white px-3 py-2.5 text-corpo">
            {'erro' in calculo ? (
              <span className="font-medium text-hf-red">{calculo.erro}</span>
            ) : (
              <>
                {tipoDesconto !== 'NENHUM' && <span className="mr-2 text-hf-stone-400 line-through tabular-nums">{brl(precoBase)}</span>}
                <b className="font-rounded text-valorDestaque font-extrabold tabular-nums text-hf-stone-900">{brl(calculo.final)}</b>
                <span className="ml-2 text-legenda text-hf-stone-600">a cobrar ({rotuloCiclo})</span>
              </>
            )}
          </div>

          {avisoCiclo && pendente && (
            <p className="m-0 rounded-[10px] bg-hf-amber-bg px-3 py-2 text-legenda font-medium text-[#7a5000]">
              Você já gerou uma cobrança {pendente.ciclo === 'ANUAL' ? 'anual' : 'mensal'} de {brl(pendente.valorFinal)} em {data(pendente.geradaEm)} e ela ainda não foi paga. Gerar outra troca o ciclo gravado: se a antiga for paga depois, os dias liberados ficam errados.
            </p>
          )}

          <button
            type="button"
            onClick={gerar}
            disabled={gerando || 'erro' in calculo || !plano}
            className="rounded-xl bg-hf-green-700 px-4 py-2.5 text-textoPequeno font-bold text-white disabled:opacity-50"
          >
            {gerando ? 'Gerando...' : `Gerar cobrança no ${metodo === 'PIX' ? 'Pix' : 'cartão'}`}
          </button>
        </>
      )}

      {cobranca && (
        <div className="flex flex-col gap-3">
          <div className="text-corpo">
            <b className="font-rounded text-valorDestaque font-extrabold tabular-nums">{brl(cobranca.valorFinal)}</b>
            {cobranca.valorFinal < cobranca.valorBase && <span className="ml-2 text-hf-stone-400 line-through tabular-nums">{brl(cobranca.valorBase)}</span>}
            <span className="ml-2 text-legenda text-hf-stone-600">{plano?.nome} · {rotuloCiclo}</span>
          </div>

          {pago ? (
            <p className="m-0 rounded-[10px] bg-hf-green-100 px-3 py-2.5 text-corpo font-semibold text-hf-green-800">Pago. O acesso do produtor já está liberado.</p>
          ) : cobranca.tipo === 'PIX' ? (
            <>
              {cobranca.qrCodeBase64 && (
                <img src={`data:image/png;base64,${cobranca.qrCodeBase64}`} alt="QR Code do Pix" className="h-44 w-44 self-center rounded-lg border border-hf-line bg-white p-1" />
              )}
              <div>
                <label htmlFor="pix-copia-cola" className="mb-1.5 block text-legenda font-semibold text-hf-stone-600">Pix copia e cola</label>
                <input id="pix-copia-cola" readOnly value={cobranca.qrCode} onFocus={(e) => e.currentTarget.select()} className="h-10 w-full rounded-[10px] border border-hf-line bg-white px-3 text-auxiliar" />
                {cobranca.dataExpiracao && <p className="mb-0 mt-1.5 text-auxiliar text-hf-stone-400">Vale até {new Date(cobranca.dataExpiracao).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => copiar(cobranca.qrCode, 'Código Pix copiado')} className="rounded-xl bg-hf-green-700 px-4 py-2.5 text-textoPequeno font-bold text-white">Copiar código</button>
                <a href={linkWhatsApp(produtor.telefone, textoZap)} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-hf-line bg-white px-4 py-2.5 text-textoPequeno font-semibold text-hf-stone-900">Enviar por WhatsApp</a>
                <button type="button" onClick={() => void verificar()} disabled={verificando} className="rounded-xl border border-hf-line bg-white px-4 py-2.5 text-textoPequeno font-semibold text-hf-stone-900 disabled:opacity-50">
                  {verificando ? 'Verificando...' : 'Verificar pagamento'}
                </button>
              </div>
              <p className="m-0 text-auxiliar text-hf-stone-400">O acesso libera sozinho quando o Pix for pago. Esta tela também confere a cada 10 segundos enquanto estiver aberta.</p>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="cartao-link" className="mb-1.5 block text-legenda font-semibold text-hf-stone-600">Link de pagamento no cartão</label>
                <input id="cartao-link" readOnly value={cobranca.linkPagamento} onFocus={(e) => e.currentTarget.select()} className="h-10 w-full rounded-[10px] border border-hf-line bg-white px-3 text-auxiliar" />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => copiar(cobranca.linkPagamento, 'Link copiado')} className="rounded-xl bg-hf-green-700 px-4 py-2.5 text-textoPequeno font-bold text-white">Copiar link</button>
                <a href={linkWhatsApp(produtor.telefone, textoZap)} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-hf-line bg-white px-4 py-2.5 text-textoPequeno font-semibold text-hf-stone-900">Enviar por WhatsApp</a>
              </div>
              <p className="m-0 text-auxiliar text-hf-stone-400">O acesso libera sozinho quando o pagamento for aprovado. O cartão é uma cobrança única: no mês seguinte, gere outra.</p>
            </>
          )}

          <button type="button" onClick={() => { setCobranca(null); setPago(false); }} className="self-start border-0 bg-transparent p-0 text-legenda font-semibold text-hf-green-700 underline">
            Gerar outra cobrança
          </button>
        </div>
      )}
    </div>
  );
}
