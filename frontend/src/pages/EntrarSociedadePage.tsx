import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { entrarSociedadeRequest } from '@/services/sociedades';

const schema = z.object({
  codigo_convite: z.string().min(6, 'Código de 6 dígitos').max(6, 'Código de 6 dígitos'),
});

type FormData = z.infer<typeof schema>;

export default function EntrarSociedadePage() {
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setErro(null);
    try {
      await entrarSociedadeRequest(data.codigo_convite);
      navigate('/');
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 404) {
        setErro('Código de convite não encontrado');
      } else if (status === 409) {
        setErro('Você já é sócio dessa sociedade');
      } else {
        setErro('Não foi possível entrar na sociedade');
      }
    }
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
