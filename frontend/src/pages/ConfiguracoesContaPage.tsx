import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { excluirContaRequest, trocarSenhaRequest } from '@/services/auth';

export default function ConfiguracoesContaPage() {
  const { id: sociedadeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Volta de verdade no histórico do navegador (chegou aqui a partir do Menu) — só cai
  // numa rota fixa quando não há histórico (link direto, refresh).
  function voltar() {
    if (location.key !== 'default') navigate(-1);
    else navigate(`/sociedades/${sociedadeId}/safras`);
  }

  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaNovaConfirmacao, setSenhaNovaConfirmacao] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [sucessoSenha, setSucessoSenha] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [senhaExclusao, setSenhaExclusao] = useState('');
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  async function excluirConta() {
    setErroExclusao(null);
    setExcluindo(true);
    try {
      await excluirContaRequest(senhaExclusao);
      localStorage.removeItem('token');
      navigate('/login');
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string } } }).response?.data;
      setErroExclusao(data?.error ?? 'Não foi possível excluir a conta');
    } finally {
      setExcluindo(false);
    }
  }

  async function trocarSenha() {
    setErroSenha(null);
    setSucessoSenha(false);

    if (senhaNova.length < 6) {
      setErroSenha('A nova senha precisa ter no mínimo 6 caracteres');
      return;
    }
    if (senhaNova !== senhaNovaConfirmacao) {
      setErroSenha('A confirmação não bate com a nova senha');
      return;
    }

    setSalvandoSenha(true);
    try {
      await trocarSenhaRequest(senhaAtual, senhaNova);
      setSenhaAtual('');
      setSenhaNova('');
      setSenhaNovaConfirmacao('');
      setSucessoSenha(true);
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string } } }).response?.data;
      setErroSenha(data?.error ?? 'Não foi possível trocar a senha');
    } finally {
      setSalvandoSenha(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-10 bg-white px-[18px] pb-1 pt-2.5">
        <div className="mx-auto grid w-full max-w-sm grid-cols-[auto_1fr_auto] items-center gap-3">
          <button
            type="button"
            aria-label="Voltar"
            onClick={voltar}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-cream-100 text-hf-stone-900"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
          </button>
          <h2 className="truncate text-center font-rounded text-[17px] font-extrabold text-hf-stone-900">Conta e Senha</h2>
          <div className="h-[38px] w-[38px]" />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-7 px-[22px] py-[18px]">
        <div className="flex flex-col gap-3.5">
          <div>
            <h3 className="m-0 text-[15px] font-extrabold text-hf-stone-900">Trocar senha</h3>
            <p className="m-0 -mt-0.5 text-xs text-hf-stone-400">Confirme a senha atual para definir uma nova</p>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-hf-line p-3.5">
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">Senha atual</label>
              <div className="relative">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 pr-11 text-base outline-none focus:border-hf-green-500"
                />
                <button
                  type="button"
                  aria-label={mostrarSenha ? 'Ocultar senhas' : 'Mostrar senhas'}
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-hf-stone-400"
                >
                  {mostrarSenha ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={2} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={2} />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">Nova senha</label>
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={senhaNova}
                onChange={(e) => setSenhaNova(e.target.value)}
                className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-base outline-none focus:border-hf-green-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">Confirmar nova senha</label>
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={senhaNovaConfirmacao}
                onChange={(e) => setSenhaNovaConfirmacao(e.target.value)}
                className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-base outline-none focus:border-hf-green-500"
              />
            </div>

            {erroSenha && <p className="m-0 text-center text-sm font-medium text-hf-red">{erroSenha}</p>}
            {sucessoSenha && <p className="m-0 text-center text-sm font-medium text-hf-green-700">Senha atualizada!</p>}

            <button
              type="button"
              onClick={trocarSenha}
              disabled={salvandoSenha || !senhaAtual || !senhaNova || !senhaNovaConfirmacao}
              className="w-full rounded-xl bg-hf-green-800 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
            >
              {salvandoSenha ? 'Salvando...' : 'Trocar senha'}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <div>
            <h3 className="m-0 text-[15px] font-extrabold text-hf-red">Excluir conta</h3>
            <p className="m-0 -mt-0.5 text-xs text-hf-stone-400">
              Ação definitiva e imediata. Se você é o titular de uma sociedade, ela é apagada por completo — safras,
              despesas, vendas e acertos, inclusive despesas pessoais de outros sócios lançadas nela.
            </p>
          </div>

          {!confirmandoExclusao ? (
            <button
              type="button"
              onClick={() => setConfirmandoExclusao(true)}
              className="w-full rounded-xl border border-hf-red py-2.5 text-[13px] font-bold text-hf-red"
            >
              Excluir minha conta
            </button>
          ) : (
            <div className="flex flex-col gap-3 rounded-2xl border border-hf-red p-3.5">
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-hf-red">Sua senha</label>
                <input
                  type="password"
                  value={senhaExclusao}
                  onChange={(e) => setSenhaExclusao(e.target.value)}
                  className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-base outline-none focus:border-hf-red"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-hf-red">
                  Digite EXCLUIR para confirmar
                </label>
                <input
                  type="text"
                  value={confirmacaoExclusao}
                  onChange={(e) => setConfirmacaoExclusao(e.target.value)}
                  className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-base outline-none focus:border-hf-red"
                />
              </div>

              {erroExclusao && <p className="m-0 text-center text-sm font-medium text-hf-red">{erroExclusao}</p>}

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmandoExclusao(false);
                    setSenhaExclusao('');
                    setConfirmacaoExclusao('');
                    setErroExclusao(null);
                  }}
                  className="flex-1 rounded-xl border border-hf-line py-2.5 text-[13px] font-bold text-hf-stone-900"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={excluirConta}
                  disabled={excluindo || !senhaExclusao || confirmacaoExclusao !== 'EXCLUIR'}
                  className="flex-1 rounded-xl bg-hf-red py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
                >
                  {excluindo ? 'Excluindo...' : 'Excluir para sempre'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
