import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { meRequest } from '@/services/auth';
import { listarSociedadesRequest } from '@/services/sociedades';
import type { Usuario } from '@/types/usuario';
import type { Sociedade } from '@/types/sociedade';

export default function HomePage() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [sociedades, setSociedades] = useState<Sociedade[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    meRequest()
      .then((data) => setUsuario(data.usuario))
      .catch(() => setErro('Não foi possível carregar os dados do usuário'));

    listarSociedadesRequest()
      .then((data) => setSociedades(data.sociedades))
      .catch(() => setErro('Não foi possível carregar suas sociedades'));
  }, []);

  function sair() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col gap-6 p-4 max-w-sm mx-auto">
      <div className="text-center space-y-1 pt-4">
        <h1 className="text-2xl font-bold">HortiFlow Produtor</h1>
        {usuario && <p className="text-muted-foreground">Olá, {usuario.nome}</p>}
      </div>

      {erro && <p className="text-destructive text-center">{erro}</p>}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Minhas sociedades</h2>

        {sociedades.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Você ainda não participa de nenhuma sociedade.
          </p>
        )}

        {sociedades.map((s) => (
          <Link key={s.id} to={`/sociedades/${s.id}/socios`}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{s.nome}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1 -mt-2">
                <p>Seu percentual: {s.percentual_lucro}%</p>
                <p>Código de convite: {s.codigo_convite}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        <Button size="lg" className="w-full" onClick={() => navigate('/sociedades/nova')}>
          Criar sociedade
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full"
          onClick={() => navigate('/sociedades/entrar')}
        >
          Entrar com código
        </Button>
      </div>

      <Button size="lg" variant="ghost" className="w-full" onClick={sair}>
        Sair
      </Button>
    </div>
  );
}
