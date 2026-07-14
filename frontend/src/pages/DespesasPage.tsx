import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { criarDespesaRequest, listarDespesasRequest } from '@/services/despesas';
import { listarSociosRequest } from '@/services/sociedades';
import { formatarData } from '@/lib/utils';
import type { Despesa, TipoDespesa } from '@/types/despesa';
import type { Socio } from '@/types/sociedade';

const TIPOS_DESPESA: TipoDespesa[] = [
  'TERRA',
  'MUDAS',
  'ADUBO',
  'DEFENSIVOS',
  'MAO_DE_OBRA',
  'EMBALAGEM',
  'TRANSPORTE',
  'OUTRO',
];

export default function DespesasPage() {
  const { id } = useParams<{ id: string }>(); // safra id
  const [searchParams] = useSearchParams();
  const sociedadeId = searchParams.get('sociedadeId');
  const navigate = useNavigate();

  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [socioId, setSocioId] = useState('');
  const [tipo, setTipo] = useState<TipoDespesa>('OUTRO');
  const [valor, setValor] = useState('');
  const [data, setData] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function carregarDespesas() {
    if (!id) return;
    listarDespesasRequest(id)
      .then((res) => setDespesas(res.despesas))
      .catch(() => setErro('Não foi possível carregar as despesas'));
  }

  useEffect(carregarDespesas, [id]);

  useEffect(() => {
    if (!sociedadeId) return;
    listarSociosRequest(sociedadeId)
      .then((res) => {
        setSocios(res.socios);
        if (res.socios.length > 0) setSocioId(res.socios[0].usuario_id);
      })
      .catch(() => setErro('Não foi possível carregar os sócios'));
  }, [sociedadeId]);

  async function lancar() {
    if (!id || !socioId || !valor || !data) return;
    setErro(null);
    setSalvando(true);
    try {
      await criarDespesaRequest(id, {
        socio_id: socioId,
        tipo,
        valor: Number(valor),
        data,
      });
      setValor('');
      carregarDespesas();
    } catch {
      setErro('Não foi possível lançar a despesa');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen p-4 max-w-sm mx-auto space-y-4">
      <h1 className="text-xl font-bold text-center pt-4">Despesas da sociedade</h1>

      {erro && <p className="text-sm text-destructive text-center font-medium">{erro}</p>}

      {sociedadeId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lançar despesa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="socio">Sócio</Label>
              <select
                id="socio"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                value={socioId}
                onChange={(e) => setSocioId(e.target.value)}
              >
                {socios.map((s) => (
                  <option key={s.usuario_id} value={s.usuario_id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <select
                id="tipo"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoDespesa)}
              >
                {TIPOS_DESPESA.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor">Valor (R$)</Label>
              <Input
                id="valor"
                type="number"
                min={0}
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <Button
              className="w-full"
              onClick={lancar}
              disabled={salvando || !socioId || !valor || !data}
            >
              {salvando ? 'Lançando...' : 'Lançar despesa'}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {despesas.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">Nenhuma despesa lançada ainda.</p>
        )}

        {despesas.map((d) => (
          <Card key={d.id}>
            <CardContent className="pt-4 space-y-1">
              <p className="font-medium">
                {d.tipo} — R$ {d.valor}
              </p>
              <p className="text-sm text-muted-foreground">
                {d.socio_nome} · {formatarData(d.data)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button size="lg" variant="ghost" className="w-full" onClick={() => navigate(-1)}>
        Voltar
      </Button>
    </div>
  );
}
