import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateField } from '@/components/ui/date-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { useSafraAtiva } from '@/lib/SafraContext';
import {
  atualizarDespesaPessoalRequest,
  criarDespesaPessoalRequest,
  excluirDespesaPessoalRequest,
  listarDespesasPessoaisRequest,
} from '@/services/despesasPessoais';
import { formatarData } from '@/lib/utils';
import { ROTULO_TIPO_DESPESA } from '@/lib/rotulos';
import type { DespesaPessoal, TipoDespesa } from '@/types/despesa';

const TIPOS_DESPESA = Object.keys(ROTULO_TIPO_DESPESA) as TipoDespesa[];

interface FormState {
  tipo: TipoDespesa;
  valor: string;
  data: string;
  descricao: string;
}

const FORM_VAZIO: FormState = { tipo: 'OUTRO', valor: '', data: '', descricao: '' };

export default function DespesasPessoaisPage() {
  const { safraId } = useSafraAtiva();

  const [despesas, setDespesas] = useState<DespesaPessoal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [salvando, setSalvando] = useState(false);

  function carregar() {
    setCarregando(true);
    listarDespesasPessoaisRequest(safraId)
      .then((res) => setDespesas(res.despesasPessoais))
      .catch(() => setErro('Não foi possível carregar suas despesas pessoais'))
      .finally(() => setCarregando(false));
  }

  useEffect(carregar, [safraId]);

  function iniciarEdicao(d: DespesaPessoal) {
    setEditandoId(d.id);
    setForm({ tipo: d.tipo, valor: d.valor, data: d.data.slice(0, 10), descricao: d.descricao ?? '' });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
  }

  async function salvar() {
    if (!form.valor || !form.data) return;
    setErro(null);
    setSucesso(false);
    setSalvando(true);
    try {
      const input = {
        tipo: form.tipo,
        valor: Number(form.valor),
        data: form.data,
        descricao: form.descricao || undefined,
      };
      if (editandoId) {
        await atualizarDespesaPessoalRequest(editandoId, input);
      } else {
        await criarDespesaPessoalRequest(safraId, input);
      }
      cancelarEdicao();
      setSucesso(true);
      carregar();
    } catch {
      setErro('Não foi possível salvar a despesa pessoal');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(despesaId: string) {
    if (!window.confirm('Excluir essa despesa pessoal? Essa ação não pode ser desfeita.')) return;
    setErro(null);
    try {
      await excluirDespesaPessoalRequest(despesaId);
      carregar();
    } catch {
      setErro('Não foi possível excluir a despesa pessoal');
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <PageHeader
        title="Minhas despesas pessoais"
        apoio="Visível só para você — não entra na divisão da sociedade"
      />
      <div className="p-4 space-y-4">
        {erro && <p className="text-sm text-destructive text-center font-medium">{erro}</p>}
        {sucesso && (
          <p className="text-sm text-center font-medium text-green-600">Despesa salva!</p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editandoId ? 'Editar despesa' : 'Nova despesa'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="tipo-pessoal">Tipo</Label>
              <select
                id="tipo-pessoal"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoDespesa }))}
              >
                {TIPOS_DESPESA.map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_TIPO_DESPESA[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor-pessoal">Valor (R$)</Label>
              <Input
                id="valor-pessoal"
                type="number"
                min={0}
                step="0.01"
                value={form.valor}
                onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data-pessoal">Data</Label>
              <DateField
                id="data-pessoal"
                value={form.data}
                onChange={(valor) => setForm((f) => ({ ...f, data: valor }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao-pessoal">Descrição (opcional)</Label>
              <Input
                id="descricao-pessoal"
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="w-full"
                onClick={salvar}
                disabled={salvando || !form.valor || !form.data}
              >
                {salvando ? 'Salvando...' : editandoId ? 'Salvar edição' : 'Lançar'}
              </Button>
              {editandoId && (
                <Button variant="ghost" onClick={cancelarEdicao}>
                  Cancelar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {carregando && <p className="text-sm text-muted-foreground text-center">Carregando...</p>}
          {!carregando && despesas.length === 0 && (
            <p className="text-sm text-muted-foreground text-center">
              Nenhuma despesa pessoal lançada ainda.
            </p>
          )}

          {despesas.map((d) => (
            <Card key={d.id}>
              <CardContent className="pt-4 space-y-1">
                <p className="font-medium">
                  {ROTULO_TIPO_DESPESA[d.tipo]} — R$ {d.valor}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatarData(d.data)}
                  {d.descricao ? ` · ${d.descricao}` : ''}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button className="flex-1" variant="outline" onClick={() => iniciarEdicao(d)}>
                    Editar
                  </Button>
                  <Button className="flex-1" variant="ghost" onClick={() => excluir(d.id)}>
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
