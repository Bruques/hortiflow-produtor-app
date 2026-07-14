import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateField } from '@/components/ui/date-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { useSafraAtiva } from '@/lib/SafraContext';
import { criarDespesaRequest, listarDespesasRequest } from '@/services/despesas';
import { listarSociosRequest } from '@/services/sociedades';
import { confirmarSugestaoRequest, listarSugestoesRequest } from '@/services/regrasDespesaRecorrente';
import { formatarData } from '@/lib/utils';
import { ROTULO_TIPO_DESPESA } from '@/lib/rotulos';
import type { Despesa, TipoDespesa } from '@/types/despesa';
import type { Socio } from '@/types/sociedade';
import type { SugestaoDespesaRecorrente } from '@/types/regraDespesaRecorrente';

const TIPOS_DESPESA = Object.keys(ROTULO_TIPO_DESPESA) as TipoDespesa[];

function lerArquivoComoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result as string);
    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
}

export default function DespesasPage() {
  const { safraId, sociedadeId } = useSafraAtiva();

  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [sugestoes, setSugestoes] = useState<SugestaoDespesaRecorrente[]>([]);
  const [socioId, setSocioId] = useState('');
  const [tipo, setTipo] = useState<TipoDespesa>('OUTRO');
  const [valor, setValor] = useState('');
  const [data, setData] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [fotoInputKey, setFotoInputKey] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [salvando, setSalvando] = useState(false);

  function carregarDespesas() {
    setCarregando(true);
    listarDespesasRequest(safraId)
      .then((res) => setDespesas(res.despesas))
      .catch(() => setErro('Não foi possível carregar as despesas'))
      .finally(() => setCarregando(false));
  }

  function carregarSugestoes() {
    listarSugestoesRequest(safraId)
      .then((res) => setSugestoes(res.sugestoes))
      .catch(() => setErro('Não foi possível carregar as sugestões do dia'));
  }

  useEffect(carregarDespesas, [safraId]);
  useEffect(carregarSugestoes, [safraId]);

  async function confirmarSugestao(regraId: string) {
    setErro(null);
    try {
      await confirmarSugestaoRequest(safraId, regraId);
      carregarSugestoes();
      carregarDespesas();
    } catch {
      setErro('Não foi possível confirmar a sugestão');
    }
  }

  useEffect(() => {
    listarSociosRequest(sociedadeId)
      .then((res) => {
        setSocios(res.socios);
        if (res.socios.length > 0) setSocioId(res.socios[0].usuario_id);
      })
      .catch(() => setErro('Não foi possível carregar os sócios'));
  }, [sociedadeId]);

  async function escolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setFoto(await lerArquivoComoBase64(arquivo));
  }

  async function lancar() {
    if (!socioId || !valor || !data) return;
    setErro(null);
    setSucesso(false);
    setSalvando(true);
    try {
      await criarDespesaRequest(safraId, {
        socio_id: socioId,
        tipo,
        valor: Number(valor),
        data,
        foto_comprovante: foto ?? undefined,
      });
      setValor('');
      setFoto(null);
      setFotoInputKey((k) => k + 1);
      setSucesso(true);
      carregarDespesas();
    } catch {
      setErro('Não foi possível lançar a despesa');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <PageHeader title="Despesas da sociedade" />
      <div className="p-4 space-y-4">
        {erro && <p className="text-sm text-destructive text-center font-medium">{erro}</p>}
        {sucesso && (
          <p className="text-sm text-center font-medium text-green-600">Despesa lançada!</p>
        )}

        {sugestoes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sugestões do dia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sugestoes.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {ROTULO_TIPO_DESPESA[s.tipo_despesa]} — R$ {s.valor}
                    </p>
                    <p className="text-sm text-muted-foreground">{s.socio_nome}</p>
                  </div>
                  <Button onClick={() => confirmarSugestao(s.id)}>Confirmar</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lançar despesa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="socio">Sócio que pagou essa despesa</Label>
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
                    {ROTULO_TIPO_DESPESA[t]}
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
              <DateField id="data" value={data} onChange={setData} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="foto">Foto do comprovante (opcional)</Label>
              <Input
                key={fotoInputKey}
                id="foto"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={escolherFoto}
              />
              {foto && (
                <div className="flex items-center gap-3">
                  <img src={foto} alt="Preview do comprovante" className="h-16 w-16 object-cover rounded-md border" />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setFoto(null);
                      setFotoInputKey((k) => k + 1);
                    }}
                  >
                    Remover foto
                  </Button>
                </div>
              )}
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

        <div className="space-y-3">
          {carregando && <p className="text-sm text-muted-foreground text-center">Carregando...</p>}
          {!carregando && despesas.length === 0 && (
            <p className="text-sm text-muted-foreground text-center">Nenhuma despesa lançada ainda.</p>
          )}

          {despesas.map((d) => (
            <Card key={d.id}>
              <CardContent className="pt-4 space-y-1">
                <p className="font-medium">
                  {ROTULO_TIPO_DESPESA[d.tipo]} — R$ {d.valor}
                </p>
                <p className="text-sm text-muted-foreground">
                  {d.socio_nome} · {formatarData(d.data)}
                </p>
                {d.foto_comprovante && (
                  <img
                    src={d.foto_comprovante}
                    alt="Comprovante da despesa"
                    className="h-16 w-16 object-cover rounded-md border mt-1"
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
