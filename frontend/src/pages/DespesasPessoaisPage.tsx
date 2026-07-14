import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  atualizarDespesaPessoalRequest,
  criarDespesaPessoalRequest,
  excluirDespesaPessoalRequest,
  listarDespesasPessoaisRequest,
} from '@/services/despesasPessoais';
import { formatarData } from '@/lib/utils';
import type { DespesaPessoal, TipoDespesa } from '@/types/despesa';

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

interface FormState {
  tipo: TipoDespesa;
  valor: string;
  data: string;
  descricao: string;
}

const FORM_VAZIO: FormState = { tipo: 'OUTRO', valor: '', data: '', descricao: '' };

export default function DespesasPessoaisPage() {
  const { id } = useParams<{ id: string }>(); // safra id
  const navigate = useNavigate();

  const [despesas, setDespesas] = useState<DespesaPessoal[]>([]);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function carregar() {
    if (!id) return;
    listarDespesasPessoaisRequest(id)
      .then((res) => setDespesas(res.despesasPessoais))
      .catch(() => setErro('Não foi possível carregar suas despesas pessoais'));
  }

  useEffect(carregar, [id]);

  function iniciarEdicao(d: DespesaPessoal) {
    setEditandoId(d.id);
    setForm({ tipo: d.tipo, valor: d.valor, data: d.data.slice(0, 10), descricao: d.descricao ?? '' });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
  }

  async function salvar() {
    if (!id || !form.valor || !form.data) return;
    setErro(null);
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
        await criarDespesaPessoalRequest(id, input);
      }
      cancelarEdicao();
      carregar();
    } catch {
      setErro('Não foi possível salvar a despesa pessoal');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(despesaId: string) {
    setErro(null);
    try {
      await excluirDespesaPessoalRequest(despesaId);
      carregar();
    } catch {
      setErro('Não foi possível excluir a despesa pessoal');
    }
  }

  return (
    <div className="min-h-screen p-4 max-w-sm mx-auto space-y-4">
      <h1 className="text-xl font-bold text-center pt-4">Minhas despesas pessoais</h1>
      <p className="text-sm text-muted-foreground text-center -mt-2">
        Visível só para você — não entra na divisão da sociedade
      </p>

      {erro && <p className="text-sm text-destructive text-center font-medium">{erro}</p>}

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
                  {t}
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
            <Input
              id="data-pessoal"
              type="date"
              value={form.data}
              onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
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
        {despesas.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Nenhuma despesa pessoal lançada ainda.
          </p>
        )}

        {despesas.map((d) => (
          <Card key={d.id}>
            <CardContent className="pt-4 space-y-1">
              <p className="font-medium">
                {d.tipo} — R$ {d.valor}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatarData(d.data)}
                {d.descricao ? ` · ${d.descricao}` : ''}
              </p>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => iniciarEdicao(d)}>
                  Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => excluir(d.id)}>
                  Excluir
                </Button>
              </div>
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
