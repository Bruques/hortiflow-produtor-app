import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { criarAcertoRequest, listarAcertosRequest } from '@/services/acertos';
import { formatarData } from '@/lib/utils';
import type { AcertoResumo, TipoAcerto } from '@/types/acerto';

const TIPOS: { valor: TipoAcerto; label: string }[] = [
  { valor: 'PARCIAL', label: 'Parcial' },
  { valor: 'FINAL', label: 'Final (encerra a safra)' },
];

export default function AcertosPage() {
  const { id } = useParams<{ id: string }>(); // safra id
  const navigate = useNavigate();

  const [acertos, setAcertos] = useState<AcertoResumo[]>([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [tipo, setTipo] = useState<TipoAcerto>('PARCIAL');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function carregar() {
    if (!id) return;
    listarAcertosRequest(id)
      .then(setAcertos)
      .catch(() => setErro('Não foi possível carregar os acertos'));
  }

  useEffect(carregar, [id]);

  async function registrar() {
    if (!id || !dataInicio || !dataFim) return;
    setErro(null);
    setSalvando(true);
    try {
      const acerto = await criarAcertoRequest(id, { data_inicio: dataInicio, data_fim: dataFim, tipo });
      navigate(`/acertos/${acerto.id}`);
    } catch (e) {
      const mensagem = axios.isAxiosError(e) ? e.response?.data?.error : null;
      setErro(mensagem ?? 'Não foi possível registrar o acerto');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen p-4 max-w-sm mx-auto space-y-4">
      <h1 className="text-xl font-bold text-center pt-4">Acertos</h1>

      {erro && <p className="text-sm text-destructive text-center font-medium">{erro}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registrar novo acerto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="data-inicio">Início do período</Label>
            <Input
              id="data-inicio"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="data-fim">Fim do período</Label>
            <Input id="data-fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map((t) => (
                <Button
                  key={t.valor}
                  type="button"
                  size="sm"
                  variant={tipo === t.valor ? 'default' : 'outline'}
                  onClick={() => setTipo(t.valor)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
          <Button
            className="w-full"
            onClick={registrar}
            disabled={salvando || !dataInicio || !dataFim}
          >
            {salvando ? 'Registrando...' : 'Registrar acerto'}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {acertos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">Nenhum acerto registrado ainda.</p>
        )}

        {acertos.map((a) => (
          <Link key={a.id} to={`/acertos/${a.id}`}>
            <Card>
              <CardContent className="pt-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {formatarData(a.data_inicio)} – {formatarData(a.data_fim)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.tipo === 'FINAL' ? 'Final' : 'Parcial'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Button size="lg" variant="ghost" className="w-full" onClick={() => navigate(-1)}>
        Voltar
      </Button>
    </div>
  );
}
