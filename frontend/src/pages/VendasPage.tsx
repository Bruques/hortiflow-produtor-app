import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateField } from '@/components/ui/date-field';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { useSafraAtiva } from '@/lib/SafraContext';
import { criarVendaRequest, listarVendasRequest } from '@/services/vendas';
import { formatarData } from '@/lib/utils';
import type { Venda } from '@/types/venda';

export default function VendasPage() {
  const { safraId } = useSafraAtiva();

  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [data, setData] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [preco, setPreco] = useState('');
  const [comprador, setComprador] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [salvando, setSalvando] = useState(false);

  function carregar() {
    setCarregando(true);
    listarVendasRequest(safraId)
      .then((res) => setVendas(res.vendas))
      .catch(() => setErro('Não foi possível carregar as vendas'))
      .finally(() => setCarregando(false));
  }

  useEffect(carregar, [safraId]);

  async function lancar() {
    if (!data || !quantidade || !preco) return;
    setErro(null);
    setSucesso(false);
    setSalvando(true);
    try {
      await criarVendaRequest(safraId, {
        data,
        quantidade: Number(quantidade),
        preco: Number(preco),
        comprador: comprador || undefined,
      });
      setQuantidade('');
      setPreco('');
      setComprador('');
      setSucesso(true);
      carregar();
    } catch {
      setErro('Não foi possível lançar a venda');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <PageHeader title="Vendas" />
      <div className="p-4 space-y-4">
        {erro && <p className="text-sm text-destructive text-center font-medium">{erro}</p>}
        {sucesso && (
          <p className="text-sm text-center font-medium text-green-600">Venda lançada!</p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lançar venda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="data-venda">Data</Label>
              <DateField id="data-venda" value={data} onChange={setData} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantidade">Quantidade (caixas)</Label>
              <Input
                id="quantidade"
                type="number"
                min={0}
                step="0.01"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preco">Preço por caixa (R$)</Label>
              <Input
                id="preco"
                type="number"
                min={0}
                step="0.01"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comprador">Comprador (opcional)</Label>
              <Input id="comprador" value={comprador} onChange={(e) => setComprador(e.target.value)} />
            </div>
            <Button
              className="w-full"
              onClick={lancar}
              disabled={salvando || !data || !quantidade || !preco}
            >
              {salvando ? 'Lançando...' : 'Lançar venda'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {carregando && <p className="text-sm text-muted-foreground text-center">Carregando...</p>}
          {!carregando && vendas.length === 0 && (
            <p className="text-sm text-muted-foreground text-center">Nenhuma venda lançada ainda.</p>
          )}

          {vendas.map((v) => (
            <Card key={v.id}>
              <CardContent className="pt-4 space-y-1">
                <p className="font-medium">
                  {v.quantidade} caixas × R$ {v.preco} = R$ {v.total}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatarData(v.data)}
                  {v.comprador ? ` · ${v.comprador}` : ''}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
