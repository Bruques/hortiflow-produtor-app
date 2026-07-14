import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buscarAcertoRequest } from '@/services/acertos';
import { formatarData } from '@/lib/utils';
import type { AcertoDetalhado } from '@/types/acerto';

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function AcertoDetalhePage() {
  const { id } = useParams<{ id: string }>(); // acerto id
  const navigate = useNavigate();

  const [acerto, setAcerto] = useState<AcertoDetalhado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    buscarAcertoRequest(id)
      .then(setAcerto)
      .catch(() => setErro('Não foi possível carregar o acerto'));
  }, [id]);

  return (
    <div className="min-h-screen p-4 max-w-sm mx-auto space-y-4">
      <h1 className="text-xl font-bold text-center pt-4">Extrato do acerto</h1>

      {erro && <p className="text-sm text-destructive text-center font-medium">{erro}</p>}

      {acerto && (
        <>
          <p className="text-sm text-muted-foreground text-center">
            {formatarData(acerto.data_inicio)} – {formatarData(acerto.data_fim)} ·{' '}
            {acerto.tipo === 'FINAL' ? 'Final' : 'Parcial'}
          </p>

          <Card>
            <CardContent className="pt-4 space-y-1">
              <p className="flex justify-between text-sm">
                <span className="text-muted-foreground">Receita (vendas)</span>
                <span>{formatarMoeda(acerto.receita)}</span>
              </p>
              <p className="flex justify-between text-sm">
                <span className="text-muted-foreground">Despesas</span>
                <span>{formatarMoeda(acerto.despesas)}</span>
              </p>
              <p className="flex justify-between font-semibold pt-1 border-t mt-1">
                <span>Lucro líquido</span>
                <span className={acerto.lucroLiquido < 0 ? 'text-destructive' : ''}>
                  {formatarMoeda(acerto.lucroLiquido)}
                </span>
              </p>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Divisão por sócio</h2>
            {acerto.socios.map((s) => (
              <Card key={s.socio_id}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{s.nome}</span>
                    <span className="text-xs font-normal text-muted-foreground">{s.percentual_aplicado}%</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="-mt-2 space-y-1">
                  <p className={`text-lg font-bold ${s.valor_lucro < 0 ? 'text-destructive' : ''}`}>
                    {formatarMoeda(s.valor_lucro)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Despesas bancadas: {formatarMoeda(s.despesas_bancadas)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Button size="lg" variant="ghost" className="w-full" onClick={() => navigate(-1)}>
        Voltar
      </Button>
    </div>
  );
}
