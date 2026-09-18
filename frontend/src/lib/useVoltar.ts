import { useLocation, useNavigate } from 'react-router-dom';

// Handler do botão "Voltar": volta de verdade no histórico quando existe uma tela anterior
// dentro do app, e só cai em `rotaFallback` quando não existe (link direto, refresh).
// Não use navigate(rota) num botão de voltar: isso empilha uma entrada nova no histórico e,
// se a tela de destino fizer navigate(-1), os dois botões ficam se chamando em loop.
export function useVoltar(rotaFallback: string): () => void {
  const navigate = useNavigate();
  const location = useLocation();

  return () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(rotaFallback);
  };
}
