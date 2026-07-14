import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { loginRequest, registerRequest } from '@/services/auth';
import { formatarTelefone, somenteDigitos } from '@/lib/telefone';

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold tracking-tight">HortiFlow Produtor</CardTitle>
          <CardDescription>
            {modo === 'login' ? 'Entre com telefone e senha' : 'Crie sua conta'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {modo === 'cadastro' && (
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" placeholder="Seu nome" autoComplete="name" {...register('nome')} />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                type="tel"
                placeholder="(35) 99730-2015"
                autoComplete="tel"
                maxLength={16}
                {...telefoneField}
                onChange={(e) => {
                  e.target.value = formatarTelefone(e.target.value);
                  telefoneField.onChange(e);
                }}
              />
              {errors.telefone && (
                <p className="text-sm text-destructive">{errors.telefone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                placeholder="••••••••"
                autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
                {...register('senha')}
              />
              {errors.senha && (
                <p className="text-sm text-destructive">{errors.senha.message}</p>
              )}
            </div>

            {erro && <p className="text-sm text-destructive text-center font-medium">{erro}</p>}

            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? 'Enviando...'
                : modo === 'login'
                  ? 'Entrar'
                  : 'Cadastrar'}
            </Button>
          </form>

          <button
            type="button"
            className="mt-4 w-full text-center text-sm text-muted-foreground underline"
            onClick={() => {
              setErro(null);
              setModo(modo === 'login' ? 'cadastro' : 'login');
            }}
          >
            {modo === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar'}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
