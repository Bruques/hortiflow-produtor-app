import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Sprout, AlertTriangle, Info, Users, User, Minus, Plus, X, Check } from 'lucide-react';
import { abrirSafraRequest, listarSafrasRequest, type SocioSafraInput } from '@/services/safras';
import { listarSociosCatalogoRequest } from '@/services/sociedades';
import { statusAssinaturaRequest } from '@/services/assinatura';
import { meRequest } from '@/services/auth';
import { cn } from '@/lib/utils';
import type { Safra } from '@/types/safra';
import type { PapelSocio, SocioCatalogo } from '@/types/sociedade';

function nomeSugerido(): string {
  const ano = new Date().getFullYear();
  return `Safra ${ano}/${ano + 1}`;
}

const TOLERANCIA_SOMA_PERCENTUAL = 0.01;

// Task 23 — sócio/percentual em edição na tela Nova Safra, antes de virar o payload de
// `SocioSafraInput`. `key` é só de controle de lista no React (id do catálogo quando
// reaproveitado, ou um id gerado quando é sócio novo).
interface EdicaoSocioSafra {
  key: string;
  socio_sociedade_id?: string;
  nome: string;
  papel: PapelSocio;
  percentual_lucro: number;
}

export default function NovaSafraPage() {
  const { id: sociedadeId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [nome, setNome] = useState(nomeSugerido());
  const [observacoes, setObservacoes] = useState('');
  const [safraEmAndamento, setSafraEmAndamento] = useState<Safra | null>(null);
  const [limiteAtingido, setLimiteAtingido] = useState<{ safrasAtivas: number; limite: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Task 23 — sócios são definidos aqui, na criação, e não herdam mais o que foi
  // configurado numa safra anterior (era exatamente essa herança que estava causando
  // divisão errada pra quem tem lavouras/parceiros diferentes na mesma sociedade).
  const [temSocios, setTemSocios] = useState<boolean | null>(null);
  const [catalogo, setCatalogo] = useState<SocioCatalogo[]>([]);
  const [meuUsuarioId, setMeuUsuarioId] = useState<string | null>(null);
  const [socios, setSocios] = useState<EdicaoSocioSafra[]>([]);
  const [novoAberto, setNovoAberto] = useState(false);
  const [modoNovo, setModoNovo] = useState<'existente' | 'novo'>('existente');
  const [socioExistenteId, setSocioExistenteId] = useState('');
  const [nomeNovo, setNomeNovo] = useState('');
  const [papelNovo, setPapelNovo] = useState<PapelSocio>('MEEIRO');

  useEffect(() => {
    if (!sociedadeId) return;
    listarSafrasRequest(sociedadeId)
      .then((res) => {
        const emAndamento = res.safras.find((s) => s.status === 'EM_ANDAMENTO');
        setSafraEmAndamento(emAndamento ?? null);
      })
      .catch(() => {});

    listarSociosCatalogoRequest(sociedadeId)
      .then((res) => setCatalogo(res.socios))
      .catch(() => {});

    meRequest()
      .then((res) => setMeuUsuarioId(res.usuario.id))
      .catch(() => {});

    // Spec 18 — avisa e já desabilita o botão antes de tentar, em vez de só deixar o erro
    // aparecer depois de clicar "Criar" (a checagem de verdade continua sendo feita no
    // backend, isso aqui é só pra não surpreender o produtor sem explicação).
    statusAssinaturaRequest()
      .then((status) => {
        const limite = status.plano?.limiteSafrasAtivas ?? null;
        if (limite !== null && status.safrasAtivas >= limite) {
          setLimiteAtingido({ safrasAtivas: status.safrasAtivas, limite });
        }
      })
      .catch(() => {});
  }, [sociedadeId]);

  // Pré-adiciona quem está criando a safra assim que escolhe "vai ter sócios" — ele nunca
  // abre uma safra sem ser um dos sócios (financiador), então pedir pra ele se adicionar
  // manualmente pelo catálogo era um passo supérfluo. Só roda uma vez (ref), pra permitir
  // que ele se remova depois se realmente quiser sem a tela reinserir sozinha.
  const jaPreencheuSozinho = useRef(false);
  useEffect(() => {
    if (temSocios !== true || jaPreencheuSozinho.current || socios.length > 0) return;
    const meuSocio = catalogo.find((c) => c.usuario_id === meuUsuarioId);
    if (!meuSocio) return;
    jaPreencheuSozinho.current = true;
    setSocios([
      { key: meuSocio.id, socio_sociedade_id: meuSocio.id, nome: meuSocio.nome, papel: meuSocio.papel, percentual_lucro: 100 },
    ]);
  }, [temSocios, catalogo, meuUsuarioId, socios.length]);

  const somaPct = socios.reduce((acc, s) => acc + s.percentual_lucro, 0);
  const pctOk = Math.abs(somaPct - 100) < TOLERANCIA_SOMA_PERCENTUAL;
  const catalogoDisponivel = catalogo.filter((c) => !socios.some((s) => s.socio_sociedade_id === c.id));

  function ajustarPct(key: string, delta: number) {
    setSocios((atual) =>
      atual.map((s) => (s.key === key ? { ...s, percentual_lucro: Math.max(0, Math.min(100, s.percentual_lucro + delta)) } : s))
    );
  }

  function removerSocio(key: string) {
    setSocios((atual) => atual.filter((s) => s.key !== key));
  }

  function adicionarSocio() {
    if (modoNovo === 'existente') {
      const escolhido = catalogoDisponivel.find((c) => c.id === socioExistenteId);
      if (!escolhido) return;
      setSocios((atual) => [
        ...atual,
        { key: escolhido.id, socio_sociedade_id: escolhido.id, nome: escolhido.nome, papel: escolhido.papel, percentual_lucro: 0 },
      ]);
      setSocioExistenteId('');
    } else {
      if (!nomeNovo.trim()) return;
      setSocios((atual) => [
        ...atual,
        { key: crypto.randomUUID(), nome: nomeNovo.trim(), papel: papelNovo, percentual_lucro: 0 },
      ]);
      setNomeNovo('');
      setPapelNovo('MEEIRO');
    }
    setNovoAberto(false);
  }

  async function criar() {
    if (!sociedadeId || !nome.trim() || temSocios === null) return;
    if (temSocios && (socios.length === 0 || !pctOk)) return;

    setErro(null);
    setSalvando(true);
    try {
      const sociosPayload: SocioSafraInput[] | undefined = temSocios
        ? socios.map((s) =>
            s.socio_sociedade_id
              ? { socio_sociedade_id: s.socio_sociedade_id, percentual_lucro: s.percentual_lucro }
              : { nome: s.nome, papel: s.papel, percentual_lucro: s.percentual_lucro }
          )
        : undefined;

      const { safra } = await abrirSafraRequest(sociedadeId, nome.trim(), observacoes.trim() || undefined, sociosPayload);
      navigate(`/safras/${safra.id}`);
    } catch (err) {
      // Mostra a mensagem real do backend (ex: limite de safras ativas do plano, spec 18) —
      // antes isso ficava sempre com um texto genérico, escondendo o motivo real do bloqueio.
      const data = (err as { response?: { data?: { error?: string } } }).response?.data;
      setErro(data?.error ?? 'Não foi possível criar a safra');
      setSalvando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-10 bg-white px-[18px] pb-1 pt-2.5">
        <div className="mx-auto grid w-full max-w-sm grid-cols-[auto_1fr_auto] items-center gap-3">
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => navigate(`/sociedades/${sociedadeId}/safras`)}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-cream-100 text-hf-stone-900"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
          </button>
          <h2 className="truncate text-center font-rounded text-[17px] font-extrabold text-hf-stone-900">Nova safra</h2>
          <div className="h-[38px] w-[38px]" />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-[22px] py-[18px]">
        {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}

        {limiteAtingido && (
          <div className="flex items-start gap-2.5 rounded-xl bg-hf-red-bg px-3.5 py-3">
            <AlertTriangle className="mt-0.5 h-[17px] w-[17px] shrink-0 text-hf-red" strokeWidth={2} />
            <div>
              <p className="m-0 text-[12.5px] font-bold text-hf-red">
                Limite de safras ativas do seu plano atingido ({limiteAtingido.safrasAtivas}/{limiteAtingido.limite})
              </p>
              <p className="m-0 mt-0.5 text-[11.5px] text-hf-red">
                Encerre uma safra em andamento ou fale com a gente sobre um plano com mais espaço.
              </p>
            </div>
          </div>
        )}

        {safraEmAndamento && (
          <div className="flex items-start gap-2.5 rounded-xl bg-hf-amber-bg px-3.5 py-3">
            <AlertTriangle className="mt-0.5 h-[17px] w-[17px] shrink-0 text-hf-amber" strokeWidth={2} />
            <div>
              <p className="m-0 text-[12.5px] font-bold text-[#5a3f0e]">
                Você já tem a {safraEmAndamento.nome} em andamento
              </p>
              <p className="m-0 mt-0.5 text-[11.5px] text-hf-amber">
                Criar uma nova safra não fecha a atual sozinha — registre um acerto final nela antes, ou os
                dois períodos vão ficar em andamento ao mesmo tempo.
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Nome da safra</label>
          <div className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-hf-line px-4 py-3 focus-within:border-hf-green-500 focus-within:ring-2 focus-within:ring-hf-green-100">
            <Sprout className="h-[18px] w-[18px] shrink-0 text-hf-green-700" />
            <input
              type="text"
              placeholder="Ex: Safra 2026/2027"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full bg-transparent text-[15px] text-hf-stone-900 outline-none placeholder:text-hf-stone-400"
            />
          </div>
          <p className="mt-1.5 text-[11.5px] text-hf-stone-400">
            Sugerido a partir da data de hoje — pode editar livremente
          </p>
        </div>

        <div>
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">Observações (opcional)</label>
          <textarea
            placeholder="Ex: Estufa | Córrego do Bom Jesus | 20 mil pés | meeiro: João"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full resize-none rounded-2xl border-[1.5px] border-hf-line px-4 py-3 text-[14px] text-hf-stone-900 outline-none placeholder:text-hf-stone-400 focus:border-hf-green-500 focus:ring-2 focus:ring-hf-green-100"
          />
          <p className="mt-1.5 text-[11.5px] text-hf-stone-400">
            Texto livre, só pra ajudar a identificar a safra — não entra em nenhum cálculo
          </p>
        </div>

        <div>
          <label className="mb-2 block text-[12.5px] font-bold text-hf-green-700">
            Esta safra vai ter sócios ou meeiros?
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setTemSocios(false)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-2xl border-[1.5px] px-3 py-3.5 text-center',
                temSocios === false ? 'border-hf-green-500 bg-hf-green-100' : 'border-hf-line'
              )}
            >
              <User className="h-5 w-5 text-hf-green-800" strokeWidth={2} />
              <span className="text-[12.5px] font-bold text-hf-stone-900">Vou trabalhar sozinho</span>
            </button>
            <button
              type="button"
              onClick={() => setTemSocios(true)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-2xl border-[1.5px] px-3 py-3.5 text-center',
                temSocios === true ? 'border-hf-green-500 bg-hf-green-100' : 'border-hf-line'
              )}
            >
              <Users className="h-5 w-5 text-hf-green-800" strokeWidth={2} />
              <span className="text-[12.5px] font-bold text-hf-stone-900">Vai ter sócios/meeiros</span>
            </button>
          </div>
          <p className="mt-1.5 text-[11.5px] text-hf-stone-400">
            Cada safra tem seus próprios sócios e percentuais — não precisa ser igual a outra safra.
          </p>
        </div>

        {temSocios && (
          <div className="flex flex-col gap-3">
            {socios.length > 0 && (
              <>
                <div className="flex h-3 overflow-hidden rounded-full bg-hf-cream-100">
                  {socios.map((s) => (
                    <div key={s.key} className="bg-hf-green-700" style={{ width: `${s.percentual_lucro}%` }} />
                  ))}
                </div>
                <div
                  className={cn(
                    'inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold',
                    pctOk ? 'bg-hf-green-100 text-hf-green-700' : 'bg-hf-red-bg text-hf-red'
                  )}
                >
                  {pctOk ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.4} />}
                  Total: {somaPct.toFixed(somaPct % 1 === 0 ? 0 : 2)}%
                </div>

                <div>
                  {socios.map((s) => (
                    <div key={s.key} className="flex items-center justify-between gap-2 border-b border-hf-cream-100 py-2.5 last:border-b-0">
                      <div className="min-w-0">
                        <p className="m-0 truncate text-sm font-bold text-hf-stone-900">{s.nome}</p>
                        <span className="inline-block rounded-full bg-hf-green-100 px-1.5 py-0.5 text-[10px] font-bold text-hf-green-700">
                          {s.papel === 'FINANCIADOR' ? 'Financiador' : s.papel === 'MEEIRO' ? 'Meeiro' : 'Misto'}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Diminuir percentual de ${s.nome}`}
                          onClick={() => ajustarPct(s.key, -5)}
                          className="flex h-[27px] w-[27px] items-center justify-center rounded-full border-[1.5px] border-hf-line text-hf-green-800"
                        >
                          <Minus className="h-3.5 w-3.5" strokeWidth={2.4} />
                        </button>
                        <span className="min-w-[38px] text-center text-[14px] font-extrabold tabular-nums text-hf-stone-900">
                          {s.percentual_lucro}%
                        </span>
                        <button
                          type="button"
                          aria-label={`Aumentar percentual de ${s.nome}`}
                          onClick={() => ajustarPct(s.key, 5)}
                          className="flex h-[27px] w-[27px] items-center justify-center rounded-full border-[1.5px] border-hf-line text-hf-green-800"
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remover ${s.nome}`}
                          onClick={() => removerSocio(s.key)}
                          className="flex h-[27px] w-[27px] items-center justify-center rounded-full text-hf-red"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2.4} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!novoAberto && (
              <button
                type="button"
                onClick={() => setNovoAberto(true)}
                className="flex items-center justify-center gap-2 rounded-2xl border-[1.5px] border-hf-green-700 py-3 text-[13.5px] font-bold text-hf-green-700"
              >
                <Plus className="h-4 w-4" strokeWidth={2.4} />
                Adicionar sócio
              </button>
            )}

            {novoAberto && (
              <div className="flex flex-col gap-3 rounded-2xl border border-hf-line p-3.5">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModoNovo('existente')}
                    disabled={catalogoDisponivel.length === 0}
                    className={cn(
                      'flex-1 rounded-xl border-[1.5px] py-2 text-[12px] font-bold disabled:opacity-40',
                      modoNovo === 'existente' ? 'border-hf-green-500 bg-hf-green-100 text-hf-green-800' : 'border-hf-line text-hf-stone-700'
                    )}
                  >
                    Sócio já cadastrado
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoNovo('novo')}
                    className={cn(
                      'flex-1 rounded-xl border-[1.5px] py-2 text-[12px] font-bold',
                      modoNovo === 'novo' ? 'border-hf-green-500 bg-hf-green-100 text-hf-green-800' : 'border-hf-line text-hf-stone-700'
                    )}
                  >
                    Sócio novo
                  </button>
                </div>

                {modoNovo === 'existente' ? (
                  catalogoDisponivel.length === 0 ? (
                    <p className="m-0 text-xs text-hf-stone-400">
                      Nenhum outro sócio cadastrado nessa sociedade ainda — cadastre um novo.
                    </p>
                  ) : (
                    <div>
                      <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">Sócio</label>
                      <select
                        className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-base"
                        value={socioExistenteId}
                        onChange={(e) => setSocioExistenteId(e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        {catalogoDisponivel.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                ) : (
                  <>
                    <div>
                      <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">Nome do sócio</label>
                      <input
                        type="text"
                        value={nomeNovo}
                        onChange={(e) => setNomeNovo(e.target.value)}
                        placeholder="Ex: João"
                        className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-base outline-none focus:border-hf-green-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">Papel</label>
                      <select
                        className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-base"
                        value={papelNovo}
                        onChange={(e) => setPapelNovo(e.target.value as PapelSocio)}
                      >
                        <option value="MEEIRO">Meeiro</option>
                        <option value="FINANCIADOR">Financiador</option>
                        <option value="MISTO">Misto</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNovoAberto(false)}
                    className="flex-1 rounded-xl border border-hf-line py-2.5 text-[13px] font-bold text-hf-stone-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={adicionarSocio}
                    disabled={modoNovo === 'existente' ? !socioExistenteId : !nomeNovo.trim()}
                    className="flex-1 rounded-xl bg-hf-green-800 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            )}

            {socios.length > 0 && !pctOk && (
              <p className="m-0 text-center text-[11.5px] font-medium text-hf-red">
                A soma dos percentuais precisa fechar em 100% pra criar a safra
              </p>
            )}
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-xl bg-hf-cream-100 px-3.5 py-3.5">
          <Info className="mt-0.5 h-[17px] w-[17px] shrink-0 text-hf-stone-600" strokeWidth={2} />
          <p className="m-0 text-[11.5px] leading-relaxed text-hf-stone-600">
            A partir da criação, todo lançamento novo de despesa ou venda passa a pertencer a essa safra.
          </p>
        </div>
      </div>

      <div className="border-t border-hf-cream-100 bg-white px-[22px] py-4">
        <button
          type="button"
          onClick={criar}
          disabled={
            !nome.trim() ||
            salvando ||
            !!limiteAtingido ||
            temSocios === null ||
            (temSocios === true && (socios.length === 0 || !pctOk))
          }
          className="w-full rounded-2xl bg-hf-green-800 py-4 text-base font-bold text-white disabled:opacity-50"
        >
          {salvando ? 'Criando...' : 'Criar e iniciar safra'}
        </button>
      </div>
    </div>
  );
}
