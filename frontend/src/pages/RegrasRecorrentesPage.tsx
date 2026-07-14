import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import {
  atualizarAtivoRequest,
  criarRegraRequest,
  listarRegrasRequest,
} from '@/services/regrasDespesaRecorrente';
import { listarSociosRequest, listarSociedadesRequest } from '@/services/sociedades';
import { ROTULO_TIPO_DESPESA, ROTULO_TIPO_GATILHO } from '@/lib/rotulos';
import type { RegraDespesaRecorrente, TipoGatilhoRegra } from '@/types/regraDespesaRecorrente';
import type { Socio } from '@/types/sociedade';
import type { TipoDespesa } from '@/types/despesa';

const TIPOS_DESPESA = Object.keys(ROTULO_TIPO_DESPESA) as TipoDespesa[];
const GATILHOS = Object.keys(ROTULO_TIPO_GATILHO) as TipoGatilhoRegra[];

export default function RegrasRecorrentesPage() {
  const { id } = useParams<{ id: string }>(); // sociedade id
  const navigate = useNavigate();

  const [regras, setRegras] = useState<RegraDespesaRecorrente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [souFinanciador, setSouFinanciador] = useState(false);
  const [socioId, setSocioId] = useState('');
  const [tipoGatilho, setTipoGatilho] = useState<TipoGatilhoRegra>('POR_VENDA');
  const [tipoDespesa, setTipoDespesa] = useState<TipoDespesa>('OUTRO');
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [salvando, setSalvando] = useState(false);

  function carregarRegras() {
    if (!id) return;
    setCarregando(true);
    listarRegrasRequest(id)
      .then((res) => setRegras(res.regras))
      .catch(() => setErro('Não foi possível carregar as regras'))
      .finally(() => setCarregando(false));
  }

  useEffect(carregarRegras, [id]);

  useEffect(() => {
    if (!id) return;
    listarSociosRequest(id)
      .then((res) => {
        setSocios(res.socios);
        if (res.socios.length > 0) setSocioId(res.socios[0].usuario_id);
      })
      .catch(() => setErro('Não foi possível carregar os sócios'));

    listarSociedadesRequest()
      .then((res) => {
        const minhaSociedade = res.sociedades.find((s) => s.id === id);
        setSouFinanciador(
          minhaSociedade?.papel === 'FINANCIADOR' || minhaSociedade?.papel === 'MISTO'
        );
      })
      .catch(() => setErro('Não foi possível verificar seu papel na sociedade'));
  }, [id]);

  async function criar() {
    if (!id || !socioId || !valor) return;
    setErro(null);
    setSucesso(false);
    setSalvando(true);
    try {
      await criarRegraRequest(id, {
        socio_id: socioId,
        tipo_gatilho: tipoGatilho,
        tipo_despesa: tipoDespesa,
        valor: Number(valor),
      });
      setValor('');
      setSucesso(true);
      carregarRegras();
    } catch {
      setErro('Não foi possível criar a regra');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(regra: RegraDespesaRecorrente) {
    setErro(null);
    try {
      await atualizarAtivoRequest(regra.id, !regra.ativo);
      carregarRegras();
    } catch {
      setErro('Não foi possível atualizar a regra');
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <PageHeader
        title="Despesas recorrentes"
        apoio="Uma regra gera automaticamente uma despesa da sociedade — por caixa vendida ou como sugestão diária"
      />
      <div className="p-4 space-y-4">
        {erro && <p className="text-sm text-destructive text-center font-medium">{erro}</p>}
        {sucesso && (
          <p className="text-sm text-center font-medium text-green-600">Regra criada!</p>
        )}

        {souFinanciador && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nova regra</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="socio-regra">Sócio (recebe a despesa)</Label>
                <select
                  id="socio-regra"
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
                <Label htmlFor="gatilho">Gatilho</Label>
                <select
                  id="gatilho"
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                  value={tipoGatilho}
                  onChange={(e) => setTipoGatilho(e.target.value as TipoGatilhoRegra)}
                >
                  {GATILHOS.map((g) => (
                    <option key={g} value={g}>
                      {ROTULO_TIPO_GATILHO[g]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo-despesa-regra">Tipo de despesa gerada</Label>
                <select
                  id="tipo-despesa-regra"
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                  value={tipoDespesa}
                  onChange={(e) => setTipoDespesa(e.target.value as TipoDespesa)}
                >
                  {TIPOS_DESPESA.map((t) => (
                    <option key={t} value={t}>
                      {ROTULO_TIPO_DESPESA[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor-regra">
                  {tipoGatilho === 'POR_VENDA' ? 'Valor por caixa (R$)' : 'Valor fixo (R$)'}
                </Label>
                <Input
                  id="valor-regra"
                  type="number"
                  min={0}
                  step="0.01"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={criar} disabled={salvando || !socioId || !valor}>
                {salvando ? 'Criando...' : 'Criar regra'}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {carregando && <p className="text-sm text-muted-foreground text-center">Carregando...</p>}
          {!carregando && regras.length === 0 && (
            <p className="text-sm text-muted-foreground text-center">Nenhuma regra criada ainda.</p>
          )}

          {regras.map((r) => (
            <Card key={r.id}>
              <CardContent className="pt-4 space-y-1">
                <p className="font-medium">
                  {ROTULO_TIPO_DESPESA[r.tipo_despesa]} — R$ {r.valor}{' '}
                  {r.tipo_gatilho === 'POR_VENDA' ? '/ caixa' : '/ vez'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {ROTULO_TIPO_GATILHO[r.tipo_gatilho]} · {r.socio_nome}
                </p>
                <p className="text-sm">{r.ativo ? 'Ativa' : 'Inativa'}</p>
                {souFinanciador && (
                  <Button variant="outline" onClick={() => alternarAtivo(r)}>
                    {r.ativo ? 'Desativar' : 'Ativar'}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Button
          size="lg"
          variant="ghost"
          className="w-full"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          onClick={() => navigate(-1)}
        >
          Voltar
        </Button>
      </div>
    </div>
  );
}
