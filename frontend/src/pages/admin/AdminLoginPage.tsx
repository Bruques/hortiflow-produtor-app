import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginAdminRequest } from '@/services/admin';

// Spec 18 — login do painel administrativo, separado do login de produtor. Não tem link
// nenhum apontando pra cá dentro do app comum — só quem sabe a URL (/admin/login) entra.
export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar() {
    setErro(null);
    setEntrando(true);
    try {
      const { token } = await loginAdminRequest(email, senha);
      localStorage.setItem('adminToken', token);
      navigate('/admin/assinaturas');
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string } } }).response?.data;
      setErro(data?.error ?? 'Não foi possível entrar');
    } finally {
      setEntrando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="font-rounded text-xl font-extrabold text-hf-stone-900">Painel admin</h1>

        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && entrar()}
              className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-base outline-none focus:border-hf-green-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-bold text-hf-green-700">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && entrar()}
              className="h-11 w-full rounded-xl border border-hf-line bg-white px-3 text-base outline-none focus:border-hf-green-500"
            />
          </div>

          {erro && <p className="m-0 text-center text-sm font-medium text-hf-red">{erro}</p>}

          <button
            type="button"
            onClick={entrar}
            disabled={entrando || !email || !senha}
            className="w-full rounded-xl bg-hf-green-800 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
          >
            {entrando ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
