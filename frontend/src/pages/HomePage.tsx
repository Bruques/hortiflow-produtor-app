import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { meRequest } from '@/services/auth';
import type { Usuario } from '@/types/usuario';

export default function HomePage() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    meRequest()
      .then((data) => setUsuario(data.usuario))
      .catch(() => setErro('Não foi possível carregar os dados do usuário'));
  }, []);

  function sair() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-bold">HortiFlow Produtor</h1>
      {usuario && <p>Olá, {usuario.nome}!</p>}
      {erro && <p className="text-destructive">{erro}</p>}
      <Button size="lg" variant="outline" onClick={sair}>
        Sair
      </Button>
    </div>
  );
}
