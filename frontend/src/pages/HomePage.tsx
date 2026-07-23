import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BrandLockup } from '@/components/BrandMark';
import { meRequest } from '@/services/auth';
import { criarSociedadeRequest } from '@/services/sociedades';
import { abrirSafraRequest, listarMinhasSafrasRequest } from '@/services/safras';
import { ROTULO_STATUS_SAFRA } from '@/lib/rotulos';
import type { MinhaSafra } from '@/types/safra';
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

  function carregar() {
    setCarregando(true);
    setErro(null);
    Promise.all([meRequest(), listarMinhasSafrasRequest()])
      .then(([me, res]) => {
        setUsuario(me.usuario);
        setSafras(res.safras);
      })
      .catch(() => setErro('Não foi possível carregar suas safras'))
      .finally(() => setCarregando(false));
  }

  useEffect(carregar, []);

  useEffect(() => {
    if (!carregando && !erro && safras.length === 1) {
      navigate(`/safras/${safras[0].id}`, { replace: true });
    }
  }, [carregando, erro, safras, navigate]);

  async function criarPrimeiraSafra() {
    if (!nomePropriedade.trim() || !nomeSafra.trim()) return;
    setErroCriacao(null);
    setCriando(true);
    try {
      const { sociedade } = await criarSociedadeRequest(nomePropriedade.trim());
      const { safra } = await abrirSafraRequest(sociedade.id, nomeSafra.trim());
      navigate(`/safras/${safra.id}`, { replace: true });
    } catch {
      setErroCriacao('Não foi possível criar a safra');
    } finally {
      setCriando(false);
    }
  }

  function sair() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  if (carregando || (!erro && safras.length === 1)) {
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
          <BrandLockup />

          <div className="text-center">
            <h1 className="font-rounded text-[21px] font-extrabold text-hf-stone-900">
              {usuario ? `Bem-vindo, ${usuario.nome.split(' ')[0]}!` : 'Vamos começar'}
            </h1>
            <p className="mx-auto mt-1.5 max-w-[30ch] text-sm leading-relaxed text-hf-stone-600">
              Comece cadastrando a sua propriedade e a safra atual. Depois, se quiser, você
              convida um meeiro pra dividir a produção com você.
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
              <Label htmlFor="nome-safra">Nome da safra</Label>
              <Input
                id="nome-safra"
                placeholder="Safra 2026"
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
        <div>
          <h1 className="font-rounded text-xl font-extrabold text-hf-stone-900">
            {usuario ? `Olá, ${usuario.nome.split(' ')[0]}` : 'Suas safras'}
          </h1>
          <p className="text-sm text-hf-stone-600">Escolha uma safra pra continuar</p>
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
