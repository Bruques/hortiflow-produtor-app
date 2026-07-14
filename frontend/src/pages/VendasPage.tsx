import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { criarVendaRequest, listarVendasRequest } from '@/services/vendas';
import { formatarData } from '@/lib/utils';
import type { Venda } from '@/types/venda';

export default function VendasPage() {
  const { id } = useParams<{ id: string }>(); // safra id
  const navigate = useNavigate();

  const [vendas, setVendas] = useState<Venda[]>([]);
  const [data, setData] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [preco, setPreco] = useState('');
  const [comprador, setComprador] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function carregar() {
    if (!id) return;
    listarVendasRequest(id)
      .then((res) => setVendas(res.vendas))
      .catch(() => setErro('Não foi possível carregar as vendas'));
  }

  useEffect(carregar, [id]);

  async function lancar() {
    if (!id || !data || !quantidade || !preco) return;
    setErro(null);
    setSalvando(true);
    try {
      await criarVendaRequest(id, {
        data,
        quantidade: Number(quantidade),
        preco: Number(preco),
        comprador: comprador || undefined,
      });
      setQuantidade('');
      setPreco('');
      setComprador('');
      carregar();
    } catch {
      setErro('Não foi possível lançar a venda');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen p-4 max-w-sm mx-auto space-y-4">
      <h1 className="text-xl font-bold text-center pt-4">Vendas</h1>

      {erro && <p className="text-sm text-destructive text-center font-medium">{erro}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lançar venda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="data-venda">Data</Label>
            <Input id="data-venda" type="date" value={data} onChange={(e) => setData(e.target.value)} />
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
        {vendas.length === 0 && (
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

      <Button size="lg" variant="ghost" className="w-full" onClick={() => navigate(-1)}>
        Voltar
      </Button>
    </div>
  );
}
