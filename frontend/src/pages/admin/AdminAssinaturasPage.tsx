import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listarAssinaturasRequest,
  listarPlanosRequest,
  editarPlanoRequest,
  atribuirPlanoRequest,
  definirLimiteSafrasRequest,
  gerarCheckoutLinkRequest,
  registrarPagamentoManualRequest,
} from '@/services/admin';
import type { TitularAdmin, PlanoAdmin } from '@/types/assinatura';

const ROTULO_METODO: Record<string, string> = {
  GATEWAY_ASAAS: 'Cartão (Asaas)',
  MANUAL_PIX: 'PIX manual',
  MANUAL_DINHEIRO: 'Dinheiro manual',
};

function formatarData(data: string | null): string {
  return data ? new Date(data).toLocaleDateString('pt-BR') : '—';
}

// Spec 18 — painel interno (só admin=true) pra controlar assinaturas: editar valor/limite
// dos 3 planos, atribuir plano a um titular, ajustar override de limite, gerar link de
// checkout Asaas e registrar pagamento manual (PIX/dinheiro). Tela desktop-first de
// propósito (uso do desenvolvedor, não do produtor), diferente do resto do app.
export default function AdminAssinaturasPage() {
  const navigate = useNavigate();
  const [planos, setPlanos] = useState<PlanoAdmin[]>([]);
  const [titulares, setTitulares] = useState<TitularAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  function carregar() {
    setCarregando(true);
    Promise.all([listarPlanosRequest(), listarAssinaturasRequest()])
      .then(([p, t]) => {
        setPlanos(p);
        setTitulares(t);
      })
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvarPlano(plano: PlanoAdmin, valorMensal: number, limiteSafrasAtivas: number | null) {
    await editarPlanoRequest(plano.id, { valorMensal, limiteSafrasAtivas });
    setMensagem(`${plano.nome} atualizado`);
    carregar();
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-rounded text-2xl font-extrabold text-hf-stone-900">Assinaturas</h1>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('adminToken');
            navigate('/admin/login');
          }}
          className="text-xs font-bold text-hf-stone-400"
        >
          Sair
        </button>
      </div>

      {mensagem && (
        <p className="rounded-xl bg-hf-green-100 px-3 py-2 text-sm font-medium text-hf-green-800">{mensagem}</p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-hf-stone-900">Planos</h2>
        <div className="flex flex-col gap-2">
          {planos.map((p) => (
            <PlanoRow key={p.id} plano={p} onSalvar={salvarPlano} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-hf-stone-900">Titulares</h2>
        {carregando && <p className="text-sm text-hf-stone-400">Carregando...</p>}
        <div className="flex flex-col gap-2">
          {titulares.map((t) => (
            <TitularRow
              key={t.usuarioId}
              titular={t}
              planos={planos}
              expandido={expandido === t.usuarioId}
              onToggle={() => setExpandido(expandido === t.usuarioId ? null : t.usuarioId)}
              onAtualizado={() => {
                carregar();
              }}
              setMensagem={setMensagem}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function PlanoRow({
  plano,
  onSalvar,
}: {
  plano: PlanoAdmin;
  onSalvar: (plano: PlanoAdmin, valorMensal: number, limiteSafrasAtivas: number | null) => Promise<void>;
}) {
  const [valorMensal, setValorMensal] = useState(String(plano.valorMensal));
  const [limite, setLimite] = useState(plano.limiteSafrasAtivas === null ? '' : String(plano.limiteSafrasAtivas));
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await onSalvar(plano, Number(valorMensal), limite === '' ? null : Number(limite));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-hf-line p-3">
      <span className="w-24 shrink-0 text-sm font-bold text-hf-stone-900">{plano.nome}</span>
      <label className="flex items-center gap-1.5 text-xs text-hf-stone-400">
        R$/mês
        <input
          type="number"
          step="0.01"
          value={valorMensal}
          onChange={(e) => setValorMensal(e.target.value)}
          className="h-9 w-24 rounded-lg border border-hf-line px-2 text-sm"
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-hf-stone-400">
        Limite safras ativas (vazio = ilimitado)
        <input
          type="number"
          value={limite}
          onChange={(e) => setLimite(e.target.value)}
          placeholder="ilimitado"
          className="h-9 w-28 rounded-lg border border-hf-line px-2 text-sm"
        />
      </label>
      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="rounded-lg bg-hf-green-800 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
      >
        {salvando ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  );
}

function TitularRow({
  titular,
  planos,
  expandido,
  onToggle,
  onAtualizado,
  setMensagem,
}: {
  titular: TitularAdmin;
  planos: PlanoAdmin[];
  expandido: boolean;
  onToggle: () => void;
  onAtualizado: () => void;
  setMensagem: (msg: string) => void;
}) {
  const [planoId, setPlanoId] = useState(titular.plano?.id ?? '');
  const [override, setOverride] = useState(titular.limiteSafrasAtivas === null ? '' : String(titular.limiteSafrasAtivas));
  const [valorManual, setValorManual] = useState('');
  const [metodoManual, setMetodoManual] = useState<'MANUAL_PIX' | 'MANUAL_DINHEIRO'>('MANUAL_PIX');
  const [diasManual, setDiasManual] = useState('365');
  const [processando, setProcessando] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  async function salvarPlano() {
    if (!planoId) return;
    setProcessando(true);
    try {
      await atribuirPlanoRequest(titular.usuarioId, planoId);
      setMensagem(`Plano atribuído a ${titular.nome}`);
      onAtualizado();
    } finally {
      setProcessando(false);
    }
  }

  async function salvarOverride() {
    setProcessando(true);
    try {
      await definirLimiteSafrasRequest(titular.usuarioId, override === '' ? null : Number(override));
      setMensagem(`Override de limite salvo para ${titular.nome}`);
      onAtualizado();
    } finally {
      setProcessando(false);
    }
  }

  async function gerarLink() {
    setProcessando(true);
    try {
      const { checkoutUrl } = await gerarCheckoutLinkRequest(titular.usuarioId);
      setCheckoutUrl(checkoutUrl);
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string } } }).response?.data;
      setMensagem(data?.error ?? 'Não foi possível gerar o link');
    } finally {
      setProcessando(false);
    }
  }

  async function registrarManual() {
    setProcessando(true);
    try {
      await registrarPagamentoManualRequest(titular.usuarioId, {
        valor: Number(valorManual),
        metodo: metodoManual,
        dias: Number(diasManual),
      });
      setMensagem(`Pagamento manual registrado para ${titular.nome}`);
      setValorManual('');
      onAtualizado();
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="rounded-xl border border-hf-line">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-left">
        <div className="flex-1">
          <p className="m-0 text-sm font-bold text-hf-stone-900">{titular.nome}</p>
          <p className="m-0 text-xs text-hf-stone-400">{titular.telefone}</p>
        </div>
        <span className="text-xs text-hf-stone-400">{titular.plano?.nome ?? 'Sem plano'}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${titular.vencida ? 'bg-hf-red-bg text-hf-red' : 'bg-hf-green-100 text-hf-green-800'}`}>
          {titular.vencida ? 'Vencida' : titular.status ?? '—'}
        </span>
        <span className="w-24 text-right text-xs text-hf-stone-400">até {formatarData(titular.dataFimAcesso)}</span>
        <span className="w-24 text-right text-xs text-hf-stone-400">
          {titular.safrasAtivas}/{titular.limiteSafrasAtivas ?? '∞'} safras
        </span>
        <span className="w-28 text-right text-xs text-hf-stone-400">
          {titular.metodoUltimoPagamento ? ROTULO_METODO[titular.metodoUltimoPagamento] : '—'}
        </span>
      </button>

      {expandido && (
        <div className="flex flex-col gap-4 border-t border-hf-line p-4">
          <div className="flex items-center gap-2">
            <select value={planoId} onChange={(e) => setPlanoId(e.target.value)} className="h-9 rounded-lg border border-hf-line px-2 text-sm">
              <option value="">Selecione um plano</option>
              {planos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} — R$ {p.valorMensal.toFixed(2)}
                </option>
              ))}
            </select>
            <button type="button" onClick={salvarPlano} disabled={processando || !planoId} className="rounded-lg bg-hf-green-800 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
              Atribuir plano
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-hf-stone-400">
              Override de limite de safras ativas (vazio = usa o do plano)
              <input
                type="number"
                value={override}
                onChange={(e) => setOverride(e.target.value)}
                placeholder="usa o do plano"
                className="h-9 w-28 rounded-lg border border-hf-line px-2 text-sm"
              />
            </label>
            <button type="button" onClick={salvarOverride} disabled={processando} className="rounded-lg bg-hf-green-800 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
              Salvar override
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={gerarLink} disabled={processando} className="rounded-lg border border-hf-line px-3 py-1.5 text-xs font-bold text-hf-stone-900 disabled:opacity-50">
              Gerar link de checkout (Asaas)
            </button>
            {checkoutUrl && (
              <input readOnly value={checkoutUrl} onFocus={(e) => e.target.select()} className="h-9 flex-1 rounded-lg border border-hf-line px-2 text-xs" />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold text-hf-green-700">Registrar pagamento manual</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="Valor recebido"
                value={valorManual}
                onChange={(e) => setValorManual(e.target.value)}
                className="h-9 w-28 rounded-lg border border-hf-line px-2 text-sm"
              />
              <select value={metodoManual} onChange={(e) => setMetodoManual(e.target.value as typeof metodoManual)} className="h-9 rounded-lg border border-hf-line px-2 text-sm">
                <option value="MANUAL_PIX">PIX</option>
                <option value="MANUAL_DINHEIRO">Dinheiro</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-hf-stone-400">Libera por:</span>
              {[
                { rotulo: '1 mês', dias: 30 },
                { rotulo: '3 meses', dias: 90 },
                { rotulo: '1 ano', dias: 365 },
              ].map((opcao) => (
                <button
                  key={opcao.dias}
                  type="button"
                  onClick={() => setDiasManual(String(opcao.dias))}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${
                    diasManual === String(opcao.dias) ? 'border-hf-green-800 bg-hf-green-100 text-hf-green-800' : 'border-hf-line text-hf-stone-900'
                  }`}
                >
                  {opcao.rotulo}
                </button>
              ))}
              <input
                type="number"
                value={diasManual}
                onChange={(e) => setDiasManual(e.target.value)}
                className="h-8 w-20 rounded-lg border border-hf-line px-2 text-xs"
              />
              <span className="text-xs text-hf-stone-400">dias</span>
            </div>
            <button
              type="button"
              onClick={registrarManual}
              disabled={processando || !valorManual}
              className="w-fit rounded-lg bg-hf-green-800 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              Registrar pagamento
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
