import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  atualizarAtivoRequest,
  criarRegraRequest,
  listarRegrasRequest,
} from '@/services/regrasDespesaRecorrente';
import { listarSociosRequest, listarSociedadesRequest } from '@/services/sociedades';
import type { RegraDespesaRecorrente, TipoGatilhoRegra } from '@/types/regraDespesaRecorrente';
import type { Socio } from '@/types/sociedade';
import type { TipoDespesa } from '@/types/despesa';

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

const GATILHO_LABEL: Record<TipoGatilhoRegra, string> = {
  POR_VENDA: 'Por venda (valor por caixa)',
  POR_PERIODO: 'Por período (sugestão diária)',
};

export default function RegrasRecorrentesPage() {
  const { id } = useParams<{ id: string }>(); // sociedade id
  const navigate = useNavigate();

  const [regras, setRegras] = useState<RegraDespesaRecorrente[]>([]);
  const [socios, setSocios] = useState<Socio[]>([]);
  const [souFinanciador, setSouFinanciador] = useState(false);
  const [socioId, setSocioId] = useState('');
  const [tipoGatilho, setTipoGatilho] = useState<TipoGatilhoRegra>('POR_VENDA');
  const [tipoDespesa, setTipoDespesa] = useState<TipoDespesa>('OUTRO');
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function carregarRegras() {
    if (!id) return;
    listarRegrasRequest(id)
      .then((res) => setRegras(res.regras))
      .catch(() => setErro('Não foi possível carregar as regras'));
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
    setSalvando(true);
    try {
      await criarRegraRequest(id, {
        socio_id: socioId,
        tipo_gatilho: tipoGatilho,
        tipo_despesa: tipoDespesa,
        valor: Number(valor),
      });
      setValor('');
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
    <div className="min-h-screen p-4 max-w-sm mx-auto space-y-4">
      <h1 className="text-xl font-bold text-center pt-4">Despesas recorrentes</h1>

      {erro && <p className="text-sm text-destructive text-center font-medium">{erro}</p>}

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
                {(Object.keys(GATILHO_LABEL) as TipoGatilhoRegra[]).map((g) => (
                  <option key={g} value={g}>
                    {GATILHO_LABEL[g]}
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
                    {t}
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
        {regras.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">Nenhuma regra criada ainda.</p>
        )}

        {regras.map((r) => (
          <Card key={r.id}>
            <CardContent className="pt-4 space-y-1">
              <p className="font-medium">
                {r.tipo_despesa} — R$ {r.valor} {r.tipo_gatilho === 'POR_VENDA' ? '/ caixa' : '/ vez'}
              </p>
              <p className="text-sm text-muted-foreground">
                {GATILHO_LABEL[r.tipo_gatilho]} · {r.socio_nome}
              </p>
              <p className="text-sm">{r.ativo ? 'Ativa' : 'Inativa'}</p>
              {souFinanciador && (
                <Button variant="outline" size="sm" onClick={() => alternarAtivo(r)}>
                  {r.ativo ? 'Desativar' : 'Ativar'}
                </Button>
              )}
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
