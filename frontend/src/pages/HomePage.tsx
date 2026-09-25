import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BrandLockup } from '@/components/BrandMark';
import { PeriodToggle } from '@/components/PeriodToggle';
import { meRequest } from '@/services/auth';
import { criarSociedadeRequest } from '@/services/sociedades';
import { abrirSafraRequest, listarMinhasSafrasRequest } from '@/services/safras';
import { buscarResumoConsolidadoRequest } from '@/services/simulacao';
import { statusAssinaturaRequest } from '@/services/assinatura';
import { formatarMoeda } from '@/lib/utils';
import { ROTULO_STATUS_SAFRA } from '@/lib/rotulos';
import type { MinhaSafra } from '@/types/safra';
import type { PeriodoFiltro, ResumoConsolidado } from '@/types/simulacao';
import type { Usuario } from '@/types/usuario';

// Tela de entrada pós-login. Não existe mais uma "lista de sociedades" — o usuário pensa
// em safras, não em sociedades (docs/design/notas-de-design.md). Ela decide sozinha pra
// onde ir: 0 safras → formulário de criar a primeira; 1 safra → pula direto pro Início
// dela; 2+ → lista pra escolher. "Criar uma segunda propriedade/sociedade independente"
// fica fora do escopo por enquanto — não há hoje nenhum caminho na UI pra isso.
export default function HomePage() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [safras, setSafras] = useState<MinhaSafra[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [nomePropriedade, setNomePropriedade] = useState('');
  const [nomeSafra, setNomeSafra] = useState('');
  const [criando, setCriando] = useState(false);
  const [erroCriacao, setErroCriacao] = useState<string | null>(null);
  // Guarda além do estado `criando`: um duplo clique rápido pode dispara os dois onClick antes
  // do primeiro re-render desabilitar o botão, criando uma sociedade duplicada por clique
  // extra (mesmo bug encontrado e corrigido no mobile, 2026-08-26).
  const criandoRef = useRef(false);

  // Resumo consolidado ("quanto eu recebo somando todas as safras ativas") — só faz sentido
  // buscar quando há 2+ safras; com 1 só, o usuário já é redirecionado direto pra ela.
  const [periodoResumo, setPeriodoResumo] = useState<PeriodoFiltro>('mes');
  const [resumo, setResumo] = useState<ResumoConsolidado | null>(null);
  const [carregandoResumo, setCarregandoResumo] = useState(false);

  function carregar() {
    setCarregando(true);
    setErro(null);
    Promise.all([meRequest(), listarMinhasSafrasRequest()])
      .then(([me, res]) => {
        setUsuario(me.usuario);
        setSafras(res.safras);
      })
      .catch(() => setErro('Não foi possível carregar suas lavouras'))
      .finally(() => setCarregando(false));
  }

  useEffect(carregar, []);

  useEffect(() => {
    if (!carregando && !erro && safras.length === 1) {
      navigate(`/safras/${safras[0].id}`, { replace: true });
    }
  }, [carregando, erro, safras, navigate]);

  // Spec 25 — só manda pro formulário de qualificação quem é conta nova de verdade: 0
  // safras ainda, sem plano atribuído e sem ter respondido. Sem essas condições, toda
  // conta criada antes desta spec (sem faixa_meeiros preenchido) ficaria presa no
  // formulário pra sempre, mesmo já usando o app normalmente (bug encontrado pelo dev,
  // 2026-09-14) — e conta atribuída manualmente pelo admin (spec 18, caminho que continua
  // coexistindo) também não deve ser interrompida pelo formulário automático. Só roda
  // depois que `carregar()` resolve, pra já saber `safras.length`. Quem já respondeu mas
  // está em trial vê um banner com os dias restantes (sem pedir cartão). Ignora erro de
  // rede: o banner é informativo, não deve travar a Home se a checagem falhar.
  const [diasTrialRestantes, setDiasTrialRestantes] = useState<number | null>(null);
  // Enquanto isso não resolve, a tela de "criar primeira safra" fica em espera (ver o `if`
  // de loading mais abaixo) — sem isso, uma conta com lavoura só escondida por estar vencida
  // via aparecer por um instante como se nunca tivesse criado nada, antes do redirecionamento
  // pro bloqueio (confuso, dev relatou 2026-09-18: "achei que tinha perdido meus dados").
  const [checandoAssinatura, setChecandoAssinatura] = useState(true);
  useEffect(() => {
    if (carregando) return;
    statusAssinaturaRequest()
      .then((dados) => {
        if (!dados.onboardingRespondido && safras.length === 0 && !dados.plano) {
          navigate('/onboarding', { replace: true });
          return;
        }
        // Spec 27 — GET /safras filtra silenciosamente safra de titular vencido (nunca devolve
        // 402, pra não bloquear em bloco uma lista que pode abranger sociedades de titulares
        // diferentes), então lista vazia aqui pode ser "venceu e sumiram todas", não só "nunca
        // criou nenhuma". Só decide pelo bloqueio quando já existe plano atribuído (financiador
        // de verdade que deixou de pagar) — sem isso, quem ainda pode estar chegando pra entrar
        // como meeiro via código (trial pessoal vencido, mas nunca foi financiador de nada)
        // continua vendo o formulário normal (mesmo critério aplicado no mobile).
        if (dados.vencida && dados.plano && safras.length === 0) {
          navigate('/assinatura/bloqueio', { replace: true });
          return;
        }
        if (dados.status === 'TRIAL' && !dados.vencida) {
          const dias = Math.ceil((new Date(dados.dataFimAcesso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          setDiasTrialRestantes(Math.max(dias, 0));
        }
      })
      .catch(() => {})
      .finally(() => setChecandoAssinatura(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando]);

  useEffect(() => {
    if (safras.length < 2) return;
    setCarregandoResumo(true);
    buscarResumoConsolidadoRequest(periodoResumo)
      .then(setResumo)
      .catch(() => setResumo(null))
      .finally(() => setCarregandoResumo(false));
  }, [safras.length, periodoResumo]);

  async function criarPrimeiraSafra() {
    if (!nomePropriedade.trim() || !nomeSafra.trim() || criandoRef.current) return;
    criandoRef.current = true;
    setErroCriacao(null);
    setCriando(true);
    try {
      const { sociedade } = await criarSociedadeRequest(nomePropriedade.trim());
      const { safra } = await abrirSafraRequest(sociedade.id, nomeSafra.trim());
      navigate(`/safras/${safra.id}`, { replace: true });
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string } } }).response?.data;
      setErroCriacao(data?.error ?? 'Não foi possível criar a lavoura');
      criandoRef.current = false;
      setCriando(false);
    }
  }

  function sair() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  if (carregando || (!erro && safras.length === 1) || (!erro && safras.length === 0 && checandoAssinatura)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hf-cream-50">
        <BrandLockup />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-hf-cream-50 p-6 text-center">
        <p className="text-sm font-medium text-hf-red">{erro}</p>
        <Button onClick={carregar}>Tentar de novo</Button>
      </div>
    );
  }

  if (safras.length === 0) {
    return (
      <div className="min-h-screen bg-hf-cream-50 px-6 py-10">
        <div className="mx-auto flex max-w-sm flex-col gap-6">
          {diasTrialRestantes !== null && <BannerTrial dias={diasTrialRestantes} />}
          <BrandLockup />

          <div className="text-center">
            <h1 className="font-rounded text-[21px] font-extrabold text-hf-stone-900">
              {usuario ? `Bem-vindo, ${usuario.nome.split(' ')[0]}!` : 'Vamos começar'}
            </h1>
            <p className="mx-auto mt-1.5 max-w-[30ch] text-sm leading-relaxed text-hf-stone-600">
              Comece cadastrando a sua propriedade e a lavoura atual. Depois, se quiser, você
              adiciona um meeiro pra dividir a produção com você.
            </p>
          </div>

          <div className="flex flex-col gap-3.5 rounded-2xl border border-hf-line bg-white p-4">
            <div>
              <Label htmlFor="nome-propriedade">Nome da propriedade</Label>
              <Input
                id="nome-propriedade"
                placeholder="Sítio Boa Vista"
                value={nomePropriedade}
                onChange={(e) => setNomePropriedade(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="nome-safra">Nome da lavoura</Label>
              <Input
                id="nome-safra"
                placeholder="Lavoura 2026"
                value={nomeSafra}
                onChange={(e) => setNomeSafra(e.target.value)}
              />
            </div>

            {erroCriacao && <p className="text-sm font-medium text-hf-red">{erroCriacao}</p>}

            <Button
              size="lg"
              className="w-full bg-hf-green-800 hover:bg-hf-green-900"
              onClick={criarPrimeiraSafra}
              disabled={criando || !nomePropriedade.trim() || !nomeSafra.trim()}
            >
              {criando ? 'Criando...' : 'Começar'}
            </Button>
          </div>

          <button
            type="button"
            onClick={() => navigate('/sociedades/entrar')}
            className="text-center text-sm font-bold text-hf-green-700"
          >
            Já tenho um código de convite
          </button>

          <button
            type="button"
            onClick={sair}
            className="mt-2 flex items-center justify-center gap-2 text-sm text-hf-stone-600"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hf-cream-50 px-6 py-10">
      <div className="mx-auto flex max-w-sm flex-col gap-4">
        {diasTrialRestantes !== null && <BannerTrial dias={diasTrialRestantes} />}
        <div>
          <h1 className="font-rounded text-xl font-extrabold text-hf-stone-900">
            {usuario ? `Olá, ${usuario.nome.split(' ')[0]}` : 'Suas lavouras'}
          </h1>
          <p className="text-sm text-hf-stone-600">Resumo de tudo, ou escolha uma lavoura pra continuar</p>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-hf-green-800 to-hf-green-900 p-4 text-white">
          <div>
            <p className="m-0 mb-1 text-[12.5px] opacity-80">Você recebe (estimado) · todas as lavouras ativas</p>
            <p className="m-0 text-[26px] font-extrabold tabular-nums tracking-tight">
              {carregandoResumo && !resumo ? '...' : formatarMoeda(resumo?.totalReceber ?? 0)}
            </p>
          </div>
          <PeriodToggle value={periodoResumo} onChange={setPeriodoResumo} />
          <button
            type="button"
            onClick={() => navigate('/despesas/compartilhada')}
            className="text-left text-[12.5px] font-bold text-white/85 underline underline-offset-2"
          >
            Lançar despesa compartilhada entre lavouras
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {safras.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => navigate(`/safras/${s.id}`)}
              className="flex items-center gap-3 rounded-2xl border border-hf-line bg-white p-4 text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-hf-stone-900">{s.nome}</p>
                <p className="truncate text-xs text-hf-stone-600">{s.sociedade_nome}</p>
                {s.observacoes && (
                  <p className="truncate text-xs text-hf-stone-400">{s.observacoes}</p>
                )}
              </div>
              <span className="rounded-full bg-hf-green-100 px-2.5 py-1 text-[11px] font-bold text-hf-green-700">
                {ROTULO_STATUS_SAFRA[s.status]}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-hf-stone-400" />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={sair}
          className="mt-4 flex items-center justify-center gap-2 text-sm text-hf-stone-600"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  );
}

// Spec 25 — banner fixo de trial, sem pedir cartão em nenhum momento antes do fim dos 14 dias.
function BannerTrial({ dias }: { dias: number }) {
  return (
    <div className="rounded-2xl bg-hf-green-100 px-4 py-2.5 text-center text-[12.5px] font-bold text-hf-green-800">
      {dias === 0 ? 'Seu teste grátis termina hoje' : `Teste grátis · ${dias} ${dias === 1 ? 'dia restante' : 'dias restantes'}`}
    </div>
  );
}
