import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Phone, Lock, Eye, EyeOff, UserPlus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLockup } from '@/components/BrandMark';
import { loginRequest, registerRequest } from '@/services/auth';
import { formatarTelefone, somenteDigitos } from '@/lib/telefone';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  nome: z.string().optional(),
  telefone: z.string().min(1, 'Telefone obrigatório'),
  senha: z.string().min(1, 'Senha obrigatória'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<'login' | 'cadastro'>('login');
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const telefoneField = register('telefone');

  async function onSubmit(data: LoginForm) {
    setErro(null);
    const telefone = somenteDigitos(data.telefone);
    try {
      const response =
        modo === 'login'
          ? await loginRequest(telefone, data.senha)
          : await registerRequest(data.nome ?? '', telefone, data.senha);
      localStorage.setItem('token', response.token);
      navigate('/');
    } catch {
      setErro(modo === 'login' ? 'Telefone ou senha incorretos' : 'Não foi possível cadastrar');
    }
  }

  return (
    <div className="min-h-screen bg-hf-cream-50 flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col flex-1">
        <div className="mt-2">
          <BrandLockup />
        </div>

        <h1 className="font-rounded text-center text-[23px] font-extrabold text-hf-stone-900 mt-6 mb-1.5">
          {modo === 'login' ? 'Bem-vindo de volta!' : 'Crie sua conta'}
        </h1>
        <p className="text-center text-sm leading-relaxed text-hf-stone-600 max-w-[30ch] mx-auto">
          {modo === 'login'
            ? 'Faça login para acessar suas sociedades e acompanhar sua safra.'
            : 'Cadastre-se para começar a acompanhar sua parceria.'}
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-4">
          {modo === 'cadastro' && (
            <div>
              <label htmlFor="nome" className="mb-1.5 block text-[13px] font-bold text-hf-green-700">
                Nome
              </label>
              <div className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-hf-line px-4 py-3 focus-within:border-hf-green-500 focus-within:ring-2 focus-within:ring-hf-green-100">
                <UserPlus className="h-[18px] w-[18px] shrink-0 text-hf-green-700" />
                <input
                  id="nome"
                  placeholder="Seu nome"
                  autoComplete="name"
                  className="w-full border-0 bg-transparent text-[15px] text-hf-stone-900 outline-none placeholder:text-hf-stone-400"
                  {...register('nome')}
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="telefone" className="mb-1.5 block text-[13px] font-bold text-hf-green-700">
              Telefone
            </label>
            <div className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-hf-line px-4 py-3 focus-within:border-hf-green-500 focus-within:ring-2 focus-within:ring-hf-green-100">
              <Phone className="h-[18px] w-[18px] shrink-0 text-hf-green-700" />
              <input
                id="telefone"
                type="tel"
                placeholder="(35) 99730-2015"
                autoComplete="tel"
                maxLength={16}
                className="w-full border-0 bg-transparent text-[15px] text-hf-stone-900 outline-none placeholder:text-hf-stone-400"
                {...telefoneField}
                onChange={(e) => {
                  e.target.value = formatarTelefone(e.target.value);
                  telefoneField.onChange(e);
                }}
              />
            </div>
            {errors.telefone && (
              <p className="mt-1 text-sm text-hf-red">{errors.telefone.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="senha" className="mb-1.5 block text-[13px] font-bold text-hf-green-700">
              Senha
            </label>
            <div className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-hf-line px-4 py-3 focus-within:border-hf-green-500 focus-within:ring-2 focus-within:ring-hf-green-100">
              <Lock className="h-[18px] w-[18px] shrink-0 text-hf-green-700" />
              <input
                id="senha"
                type={mostrarSenha ? 'text' : 'password'}
                placeholder="Digite sua senha"
                autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
                className="w-full border-0 bg-transparent text-[15px] text-hf-stone-900 outline-none placeholder:text-hf-stone-400"
                {...register('senha')}
              />
              <button
                type="button"
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setMostrarSenha((v) => !v)}
                className="text-hf-green-700"
              >
                {mostrarSenha ? <EyeOff className="h-[19px] w-[19px]" /> : <Eye className="h-[19px] w-[19px]" />}
              </button>
            </div>
            {errors.senha && <p className="mt-1 text-sm text-hf-red">{errors.senha.message}</p>}
          </div>

          {erro && <p className="text-center text-sm font-medium text-hf-red">{erro}</p>}

          <Button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              'mt-1.5 h-auto rounded-2xl bg-hf-green-800 py-4 text-base font-bold text-white hover:bg-hf-green-900'
            )}
          >
            {isSubmitting ? 'Enviando...' : modo === 'login' ? 'Entrar' : 'Cadastrar'}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3.5 text-[13px] text-hf-stone-400">
          <span className="h-px flex-1 bg-hf-line" />
          ou
          <span className="h-px flex-1 bg-hf-line" />
        </div>

        <button
          type="button"
          onClick={() => {
            setErro(null);
            setModo(modo === 'login' ? 'cadastro' : 'login');
          }}
          className="flex items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-hf-green-700 py-[15px] text-[15px] font-bold text-hf-green-700 transition-colors hover:bg-hf-green-100"
        >
          <UserPlus className="h-[18px] w-[18px]" />
          {modo === 'login' ? 'Criar conta' : 'Já tenho conta'}
        </button>

        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-hf-cream-100 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-hf-green-700" />
          <div>
            <strong className="block text-[13.5px] font-bold text-hf-stone-900">
              Seguro e transparente
            </strong>
            <p className="m-0 text-[12.5px] leading-relaxed text-hf-stone-600">
              Seus dados são protegidos e suas informações financeiras ficam seguras.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
