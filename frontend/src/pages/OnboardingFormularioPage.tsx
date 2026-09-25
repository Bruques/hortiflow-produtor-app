import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { onboardingRequest, type FaixaMeeiros, type LocalizacaoProducao } from '@/services/assinatura';
import { logoutRequest } from '@/services/auth';
import { cn } from '@/lib/utils';

const OPCOES_MEEIROS: { valor: FaixaMeeiros; rotulo: string }[] = [
  { valor: 'UM_A_TRES', rotulo: '1 a 3' },
  { valor: 'QUATRO_A_DEZ', rotulo: '4 a 10' },
  { valor: 'DEZ_OU_MAIS', rotulo: '10 ou mais' },
];

const OPCOES_LOCALIZACAO: { valor: LocalizacaoProducao; rotulo: string }[] = [
  { valor: 'BOM_REPOUSO', rotulo: 'Bom Repouso' },
  { valor: 'OUTRA_CIDADE', rotulo: 'Outra cidade' },
];

// Máscara visual só (separador de milhar pt-BR) — o valor guardado no state continua só
// dígitos, sem pontuação; a conversão pra número no envio (`Number(quantidadePes)`) nunca
// vê o ponto.
function formatarMilhar(digitos: string): string {
  return digitos === '' ? '' : Number(digitos).toLocaleString('pt-BR');
}

// Spec 25 — formulário de qualificação (Fluxo A), equivalente ao
// mobile/src/screens/OnboardingFormularioScreen.tsx. Aparece uma vez, logo após o
// cadastro, antes de qualquer outra tela.
export default function OnboardingFormularioPage() {
  const navigate = useNavigate();
  const [faixaMeeiros, setFaixaMeeiros] = useState<FaixaMeeiros | null>(null);
  const [quantidadePes, setQuantidadePes] = useState('');
  const [localizacao, setLocalizacao] = useState<LocalizacaoProducao | null>(null);
  const [outraCidadeNome, setOutraCidadeNome] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Sem esse botão, quem cai aqui (formulário obrigatório de conta nova) ficava preso sem
  // jeito de trocar de conta — mesmo gap que existia em AssinaturaBloqueadaPage antes do
  // dev relatar (2026-09-15), encontrado agora aqui também (dev relatou, 2026-09-18).
  function sair() {
    logoutRequest(false);
    localStorage.removeItem('token');
    navigate('/login');
  }

  const precisaNomeCidade = localizacao === 'OUTRA_CIDADE';
  const preenchido =
    faixaMeeiros !== null &&
    quantidadePes.trim().length > 0 &&
    localizacao !== null &&
    (!precisaNomeCidade || outraCidadeNome.trim().length > 0);

  async function enviar() {
    if (!preenchido || !faixaMeeiros || !localizacao) return;
    setEnviando(true);
    setErro(null);
    try {
      await onboardingRequest({
        faixaMeeiros,
        quantidadePes: Number(quantidadePes),
        localizacaoProducao: localizacao,
        localizacaoProducaoOutra: precisaNomeCidade ? outraCidadeNome.trim() : undefined,
      });
      // Spec 32: sem tela de plano — o plano recomendado já fica gravado no backend e o
      // produtor só escolhe/paga quando o teste acabar.
      navigate('/', { replace: true });
    } catch {
      setErro('Não foi possível enviar o formulário');
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-hf-cream-50 px-6 py-10">
      <div className="mx-auto flex max-w-sm flex-col gap-6">
        <div className="text-center">
          <h1 className="font-rounded text-[20px] font-extrabold text-hf-stone-900">Conte sobre sua produção</h1>
          <p className="mx-auto mt-1.5 max-w-[30ch] text-sm leading-relaxed text-hf-stone-600">
            Assim preparamos o app pro tamanho da sua sociedade.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Quantos sócios meeiros você tem hoje?</Label>
          <div className="flex gap-2">
            {OPCOES_MEEIROS.map((opcao) => (
              <button
                key={opcao.valor}
                type="button"
                onClick={() => setFaixaMeeiros(opcao.valor)}
                className={cn(
                  'flex-1 rounded-xl border-[1.5px] border-hf-line bg-white py-3 text-[13px] font-bold text-hf-stone-600',
                  faixaMeeiros === opcao.valor && 'border-hf-green-700 bg-hf-green-100 text-hf-green-800'
                )}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="quantidade-pes">Número de pés de morango</Label>
          <Input
            id="quantidade-pes"
            inputMode="numeric"
            placeholder="Ex: 5.000"
            value={formatarMilhar(quantidadePes)}
            onChange={(e) => setQuantidadePes(e.target.value.replace(/\D/g, ''))}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Onde fica a produção?</Label>
          <div className="flex gap-2">
            {OPCOES_LOCALIZACAO.map((opcao) => (
              <button
                key={opcao.valor}
                type="button"
                onClick={() => setLocalizacao(opcao.valor)}
                className={cn(
                  'flex-1 rounded-xl border-[1.5px] border-hf-line bg-white py-3 text-[13px] font-bold text-hf-stone-600',
                  localizacao === opcao.valor && 'border-hf-green-700 bg-hf-green-100 text-hf-green-800'
                )}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
          {precisaNomeCidade && (
            <Input
              autoFocus
              placeholder="Nome da cidade"
              value={outraCidadeNome}
              onChange={(e) => setOutraCidadeNome(e.target.value)}
            />
          )}
        </div>

        {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}

        <Button
          size="lg"
          className="w-full bg-hf-green-800 hover:bg-hf-green-900"
          onClick={enviar}
          disabled={!preenchido || enviando}
        >
          {enviando ? 'Enviando...' : 'Começar teste grátis de 14 dias'}
        </Button>

        <button
          type="button"
          onClick={sair}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-hf-red py-3.5 text-sm font-bold text-hf-red"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sair
        </button>
      </div>
    </div>
  );
}
