import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { atualizarPercentuaisRequest, listarSociosRequest } from '@/services/sociedades';
import type { PapelSocio, Socio } from '@/types/sociedade';

const PAPEIS: PapelSocio[] = ['FINANCIADOR', 'MEEIRO', 'MISTO'];

interface EdicaoSocio {
  usuario_id: string;
  nome: string;
  percentual_lucro: string;
  papel: PapelSocio;
}

export default function SociosPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [edicoes, setEdicoes] = useState<EdicaoSocio[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    if (!id) return;
    listarSociosRequest(id)
      .then((data: { socios: Socio[] }) =>
        setEdicoes(
          data.socios.map((s) => ({
            usuario_id: s.usuario_id,
            nome: s.nome,
            percentual_lucro: s.percentual_lucro,
            papel: s.papel,
          }))
        )
      )
      .catch(() => setErro('Não foi possível carregar os sócios'));
  }, [id]);

  function atualizarCampo(usuarioId: string, campo: 'percentual_lucro' | 'papel', valor: string) {
    setSucesso(false);
    setEdicoes((atual) =>
      atual.map((s) => (s.usuario_id === usuarioId ? { ...s, [campo]: valor } : s))
    );
  }

  const soma = edicoes.reduce((acc, s) => acc + (Number(s.percentual_lucro) || 0), 0);

  async function salvar() {
    if (!id) return;
    setErro(null);
    setSucesso(false);
    setSalvando(true);
    try {
      await atualizarPercentuaisRequest(
        id,
        edicoes.map((s) => ({
          usuario_id: s.usuario_id,
          percentual_lucro: Number(s.percentual_lucro),
          papel: s.papel,
        }))
      );
      setSucesso(true);
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string } } }).response?.data;
      setErro(data?.error ?? 'Não foi possível salvar os percentuais');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen p-4 max-w-sm mx-auto space-y-4">
      <h1 className="text-xl font-bold text-center pt-4">Sócios da sociedade</h1>

      {erro && <p className="text-sm text-destructive text-center font-medium">{erro}</p>}
      {sucesso && (
        <p className="text-sm text-center font-medium text-green-600">Percentuais atualizados!</p>
      )}

      {edicoes.map((s) => (
        <Card key={s.usuario_id}>
          <CardHeader>
            <CardTitle className="text-base">{s.nome}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor={`pct-${s.usuario_id}`}>Percentual de lucro (%)</Label>
              <Input
                id={`pct-${s.usuario_id}`}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={s.percentual_lucro}
                onChange={(e) => atualizarCampo(s.usuario_id, 'percentual_lucro', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`papel-${s.usuario_id}`}>Papel</Label>
              <select
                id={`papel-${s.usuario_id}`}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                value={s.papel}
                onChange={(e) => atualizarCampo(s.usuario_id, 'papel', e.target.value)}
              >
                {PAPEIS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      ))}

      {edicoes.length > 0 && (
        <p
          className={`text-sm text-center font-medium ${
            Math.abs(soma - 100) > 0.01 ? 'text-destructive' : 'text-muted-foreground'
          }`}
        >
          Soma atual: {soma.toFixed(2)}%
        </p>
      )}

      <Button size="lg" className="w-full" onClick={salvar} disabled={salvando || edicoes.length === 0}>
        {salvando ? 'Salvando...' : 'Salvar percentuais'}
      </Button>
      <Button size="lg" variant="outline" className="w-full" onClick={() => navigate(`/sociedades/${id}/safras`)}>
        Safras
      </Button>
      <Button size="lg" variant="ghost" className="w-full" onClick={() => navigate('/')}>
        Voltar
      </Button>
    </div>
  );
}
