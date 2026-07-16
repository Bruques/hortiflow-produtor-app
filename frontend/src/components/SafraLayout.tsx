import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { obterSafraRequest } from '@/services/safras';
import { SafraContext, type SafraContextValue } from '@/lib/SafraContext';
import { BottomNavV2 } from '@/components/BottomNavV2';

// Resolve a sociedade dona da safra atual uma única vez (via GET /safras/:id) e disponibiliza
// os dois IDs pro resto da árvore de rotas via contexto — em vez de cada tela depender de um
// parâmetro de URL solto (?sociedadeId=...), que sumia se a página fosse aberta sem vir do link certo.
export default function SafraLayout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [contexto, setContexto] = useState<SafraContextValue | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setContexto(null);
    setErro(null);
    obterSafraRequest(id)
      .then((res) => setContexto({ safraId: id, sociedadeId: res.safra.sociedade_id, safra: res.safra }))
      .catch(() => setErro('Não foi possível carregar essa safra'));
  }, [id]);

  if (erro) {
    return (
      <div className="min-h-screen p-4 max-w-sm mx-auto space-y-4 flex flex-col justify-center text-center">
        <p className="text-sm text-destructive font-medium">{erro}</p>
        <Button variant="outline" onClick={() => navigate('/')}>
          Voltar para o início
        </Button>
      </div>
    );
  }

  if (!contexto) {
    return (
      <div className="min-h-screen p-4 max-w-sm mx-auto flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Telas de formulário em tela cheia (convenção ".../nova", ".../novo" ou ".../editar") têm
  // botão "Voltar" e ação de salvar fixada embaixo — a bottom nav não cabe junto e concorreria
  // com o botão de salvar, então some nessas rotas.
  const ehTelaDeFormulario = /\/(nov[ao]|editar)$/.test(location.pathname);

  return (
    <SafraContext.Provider value={contexto}>
      <div className={ehTelaDeFormulario ? 'bg-hf-cream-50 min-h-screen' : 'pb-24 bg-hf-cream-50 min-h-screen'}>
        <Outlet />
      </div>
      {!ehTelaDeFormulario && <BottomNavV2 safraId={contexto.safraId} />}
    </SafraContext.Provider>
  );
}
