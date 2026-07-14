import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { useSafraAtiva } from '@/lib/SafraContext';
import { buscarSimulacaoRequest } from '@/services/simulacao';
import type { PeriodoFiltro, Simulacao } from '@/types/simulacao';

const PERIODOS: { valor: PeriodoFiltro; label: string }[] = [
  { valor: 'dia', label: 'Hoje' },
  { valor: 'semana', label: 'Semana' },
  { valor: 'mes', label: 'Mês' },
  { valor: 'safra', label: 'Safra inteira' },
];

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function SimulacaoPage() {
  const { safraId } = useSafraAtiva();

  const [periodo, setPeriodo] = useState<PeriodoFiltro>('semana');
  const [simulacao, setSimulacao] = useState<Simulacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    setCarregando(true);
    setErro(null);
    buscarSimulacaoRequest(safraId, periodo)
      .then(setSimulacao)
      .catch(() => setErro('Não foi possível carregar a simulação'))
      .finally(() => setCarregando(false));
  }, [safraId, periodo]);

  return (
    <div className="max-w-sm mx-auto">
      <PageHeader title="Simulação de divisão" />
      <div className="p-4 space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {PERIODOS.map((p) => (
          <Button
            key={p.valor}
            size="sm"
            variant={periodo === p.valor ? 'default' : 'outline'}
            onClick={() => setPeriodo(p.valor)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {erro && <p className="text-sm text-destructive text-center font-medium">{erro}</p>}
      {carregando && <p className="text-sm text-muted-foreground text-center">Calculando...</p>}

      {simulacao && !carregando && (
        <>
          <Card>
            <CardContent className="pt-4 space-y-1">
              <p className="flex justify-between text-sm">
                <span className="text-muted-foreground">Receita (vendas)</span>
                <span>{formatarMoeda(simulacao.receita)}</span>
              </p>
              <p className="flex justify-between text-sm">
                <span className="text-muted-foreground">Despesas</span>
                <span>{formatarMoeda(simulacao.despesas)}</span>
              </p>
              <p className="flex justify-between font-semibold pt-1 border-t mt-1">
                <span>Lucro líquido</span>
                <span className={simulacao.lucroLiquido < 0 ? 'text-destructive' : ''}>
                  {formatarMoeda(simulacao.lucroLiquido)}
                </span>
              </p>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Divisão por sócio</h2>
            {simulacao.divisao.map((d) => (
              <Card key={d.socio_id}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{d.nome}</span>
                    <span className="text-sm font-normal text-muted-foreground">{d.percentual}%</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="-mt-2">
                  <p className={`text-lg font-bold ${d.valor < 0 ? 'text-destructive' : ''}`}>
                    {formatarMoeda(d.valor)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
      </div>
    </div>
  );
}
