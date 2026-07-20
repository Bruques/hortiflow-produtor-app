import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { entrarSociedadeRequest, previewConviteRequest } from '@/services/sociedades';
import type { SocioSemConta } from '@/types/sociedade';

const schema = z.object({
  codigo_convite: z.string().min(6, 'Código de 6 dígitos').max(6, 'Código de 6 dígitos'),
});

type FormData = z.infer<typeof schema>;

export default function EntrarSociedadePage() {
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  // Quando o convite tem sócios sem conta cadastrados, a tela pergunta se a pessoa é
  // um deles antes de confirmar — assim ela vincula a conta ao registro já existente
  // (mesmo percentual/histórico) em vez de virar um sócio novo duplicado.
  const [codigo, setCodigo] = useState<string | null>(null);
  const [sociosSemConta, setSociosSemConta] = useState<SocioSemConta[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function confirmarEntrada(codigoConvite: string, vincularSocioId?: string) {
    setErro(null);
    setEntrando(true);
    try {
      await entrarSociedadeRequest(codigoConvite, vincularSocioId);
      navigate('/');
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 404) {
        setErro('Código de convite ou sócio não encontrado');
      } else if (status === 409) {
        setErro('Você já é sócio dessa sociedade, ou esse sócio já está vinculado a uma conta');
      } else {
        setErro('Não foi possível entrar na sociedade');
      }
      setCodigo(null);
    } finally {
      setEntrando(false);
    }
  }

  async function onSubmit(data: FormData) {
    setErro(null);
    try {
      const preview = await previewConviteRequest(data.codigo_convite);
      if (preview.socios_sem_conta.length === 0) {
        await confirmarEntrada(data.codigo_convite);
        return;
      }
      setCodigo(data.codigo_convite);
      setSociosSemConta(preview.socios_sem_conta);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setErro(status === 404 ? 'Código de convite não encontrado' : 'Não foi possível entrar na sociedade');
    }
  }

  if (codigo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle>É algum desses sócios?</CardTitle>
            <CardDescription>
              Essa sociedade já tem sócios cadastrados sem conta — se um deles é você, sua conta
              assume o percentual e o histórico já registrados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sociosSemConta.map((s) => (
              <Button
                key={s.id}
                type="button"
                variant="outline"
                size="lg"
                className="w-full justify-start"
                disabled={entrando}
                onClick={() => confirmarEntrada(codigo, s.id)}
              >
                {s.nome}
              </Button>
            ))}

            {erro && <p className="text-sm text-destructive text-center font-medium">{erro}</p>}

            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={entrando}
              onClick={() => confirmarEntrada(codigo)}
            >
              Não, sou novo sócio
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="w-full"
              disabled={entrando}
              onClick={() => setCodigo(null)}
            >
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Entrar em uma sociedade</CardTitle>
          <CardDescription>Informe o código de 6 dígitos recebido</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="codigo_convite">Código</Label>
              <Input
                id="codigo_convite"
                inputMode="numeric"
                maxLength={6}
                placeholder="482913"
                {...register('codigo_convite')}
              />
              {errors.codigo_convite && (
                <p className="text-sm text-destructive">{errors.codigo_convite.message}</p>
              )}
            </div>

            {erro && <p className="text-sm text-destructive text-center font-medium">{erro}</p>}

            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="w-full"
              onClick={() => navigate('/')}
            >
              Cancelar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
