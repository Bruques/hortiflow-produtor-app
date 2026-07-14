import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DateField } from '@/components/ui/date-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { useSafraAtiva } from '@/lib/SafraContext';
import { criarAcertoRequest, listarAcertosRequest } from '@/services/acertos';
import { formatarData } from '@/lib/utils';
import { ROTULO_TIPO_ACERTO } from '@/lib/rotulos';
import type { AcertoResumo, TipoAcerto } from '@/types/acerto';

const TIPOS = Object.keys(ROTULO_TIPO_ACERTO) as TipoAcerto[];

export default function AcertosPage() {
  const { safraId } = useSafraAtiva();
  const navigate = useNavigate();

  const [acertos, setAcertos] = useState<AcertoResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [tipo, setTipo] = useState<TipoAcerto>('PARCIAL');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function carregar() {
    setCarregando(true);
    listarAcertosRequest(safraId)
      .then(setAcertos)
      .catch(() => setErro('Não foi possível carregar os acertos'))
      .finally(() => setCarregando(false));
  }

  useEffect(carregar, [safraId]);

  async function registrar() {
    if (!dataInicio || !dataFim) return;
    setErro(null);
    setSalvando(true);
    try {
      const acerto = await criarAcertoRequest(safraId, { data_inicio: dataInicio, data_fim: dataFim, tipo });
      navigate(`/acertos/${acerto.id}`);
    } catch (e) {
      const mensagem = axios.isAxiosError(e) ? e.response?.data?.error : null;
      setErro(mensagem ?? 'Não foi possível registrar o acerto');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <PageHeader
        title="Acertos"
        apoio="Um acerto congela o cálculo de um período — pra prestação de contas já feita não mudar depois"
      />
      <div className="p-4 space-y-4">
        {erro && <p className="text-sm text-destructive text-center font-medium">{erro}</p>}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrar novo acerto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="data-inicio">Início do período</Label>
              <DateField id="data-inicio" value={dataInicio} onChange={setDataInicio} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data-fim">Fim do período</Label>
              <DateField id="data-fim" value={dataFim} onChange={setDataFim} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="grid grid-cols-2 gap-2">
                {TIPOS.map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant={tipo === t ? 'default' : 'outline'}
                    onClick={() => setTipo(t)}
                  >
                    {ROTULO_TIPO_ACERTO[t]}
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
          {carregando && <p className="text-sm text-muted-foreground text-center">Carregando...</p>}
          {!carregando && acertos.length === 0 && (
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
                    <p className="text-xs text-muted-foreground">{ROTULO_TIPO_ACERTO[a.tipo]}</p>
                  </div>
                  <span className="text-muted-foreground" aria-hidden>›</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
