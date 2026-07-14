import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { criarSociedadeRequest } from '@/services/sociedades';

const schema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
});

type FormData = z.infer<typeof schema>;

export default function CriarSociedadePage() {
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const [criada, setCriada] = useState<{ id: string; nome: string; codigo_convite: string } | null>(
    null
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setErro(null);
    try {
      const response = await criarSociedadeRequest(data.nome);
      setCriada(response.sociedade);
    } catch {
      setErro('Não foi possível criar a sociedade');
    }
  }

  if (criada) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center space-y-1">
            <CardTitle>Sociedade criada!</CardTitle>
            <CardDescription>Compartilhe o código abaixo com os demais sócios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <p className="text-4xl font-bold tracking-widest">{criada.codigo_convite}</p>
            <Button size="lg" className="w-full" onClick={() => navigate('/')}>
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
          <CardTitle>Criar sociedade</CardTitle>
          <CardDescription>Nome da parceria ou da propriedade</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" placeholder="Sítio Boa Vista" {...register('nome')} />
              {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
            </div>

            {erro && <p className="text-sm text-destructive text-center font-medium">{erro}</p>}

            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Criando...' : 'Criar'}
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
