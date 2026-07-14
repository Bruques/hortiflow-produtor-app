import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { abrirSafraRequest, encerrarSafraRequest, listarSafrasRequest } from '@/services/safras';
import type { Safra } from '@/types/safra';

const STATUS_LABEL: Record<Safra['status'], string> = {
  PLANEJADA: 'Planejada',
  EM_ANDAMENTO: 'Em andamento',
  ENCERRADA: 'Encerrada',
};

export default function SafrasPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [safras, setSafras] = useState<Safra[]>([]);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);

  function carregar() {
    if (!id) return;
    listarSafrasRequest(id)
      .then((data) => setSafras(data.safras))
      .catch(() => setErro('Não foi possível carregar as safras'));
  }

  useEffect(carregar, [id]);

  async function abrir() {
    if (!id || !nome.trim()) return;
    setErro(null);
    setAbrindo(true);
    try {
      await abrirSafraRequest(id, nome.trim());
      setNome('');
      carregar();
    } catch {
      setErro('Não foi possível abrir a safra');
    } finally {
      setAbrindo(false);
    }
  }

  async function encerrar(safraId: string) {
    setErro(null);
    try {
      await encerrarSafraRequest(safraId);
      carregar();
    } catch {
      setErro('Não foi possível encerrar a safra');
    }
  }

  return (
    <div className="min-h-screen p-4 max-w-sm mx-auto space-y-4">
      <h1 className="text-xl font-bold text-center pt-4">Safras</h1>

      {erro && <p className="text-sm text-destructive text-center font-medium">{erro}</p>}

      <Link to={`/sociedades/${id}/regras-recorrentes`}>
        <Button variant="outline" className="w-full">
          Despesas recorrentes
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Abrir nova safra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="nome-safra">Nome</Label>
            <Input
              id="nome-safra"
              placeholder="Safra 2026"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={abrir} disabled={abrindo || !nome.trim()}>
            {abrindo ? 'Abrindo...' : 'Abrir safra'}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {safras.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">Nenhuma safra ainda.</p>
        )}

        {safras.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>{s.nome}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {STATUS_LABEL[s.status]}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to={`/safras/${s.id}/despesas?sociedadeId=${id}`}>
                <Button variant="outline" className="w-full">
                  Despesas da sociedade
                </Button>
              </Link>
              <Link to={`/safras/${s.id}/despesas-pessoais`}>
                <Button variant="outline" className="w-full">
                  Minhas despesas pessoais
                </Button>
              </Link>
              <Link to={`/safras/${s.id}/vendas`}>
                <Button variant="outline" className="w-full">
                  Vendas
                </Button>
              </Link>
              <Link to={`/safras/${s.id}/simulacao`}>
                <Button variant="outline" className="w-full">
                  Simulação de divisão
                </Button>
              </Link>
              {s.status === 'EM_ANDAMENTO' && (
                <Button variant="ghost" className="w-full" onClick={() => encerrar(s.id)}>
                  Encerrar safra
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Button size="lg" variant="ghost" className="w-full" onClick={() => navigate(`/sociedades/${id}/socios`)}>
        Voltar
      </Button>
    </div>
  );
}
