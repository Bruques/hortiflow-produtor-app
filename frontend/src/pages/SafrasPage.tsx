import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { abrirSafraRequest, encerrarSafraRequest, listarSafrasRequest } from '@/services/safras';
import { ROTULO_STATUS_SAFRA } from '@/lib/rotulos';
import type { Safra } from '@/types/safra';

export default function SafrasPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [safras, setSafras] = useState<Safra[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);

  function carregar() {
    if (!id) return;
    setCarregando(true);
    listarSafrasRequest(id)
      .then((data) => setSafras(data.safras))
      .catch(() => setErro('Não foi possível carregar as safras'))
      .finally(() => setCarregando(false));
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
    <div className="min-h-screen max-w-sm mx-auto">
      <PageHeader title="Safras" />
      <div className="p-4 space-y-4">
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
        {carregando && <p className="text-sm text-muted-foreground text-center">Carregando...</p>}
        {!carregando && safras.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">Nenhuma safra ainda.</p>
        )}

        {safras.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>{s.nome}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {ROTULO_STATUS_SAFRA[s.status]}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to={`/safras/${s.id}/despesas`}>
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
              <Link to={`/safras/${s.id}`}>
                <Button variant="outline" className="w-full">
                  Ir para a safra (Resumo)
                </Button>
              </Link>
              <Link to={`/safras/${s.id}/acertos`}>
                <Button variant="outline" className="w-full">
                  Acertos
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

      <Button
        size="lg"
        variant="ghost"
        className="w-full"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        onClick={() => navigate(`/sociedades/${id}/socios`)}
      >
        Voltar
      </Button>
      </div>
    </div>
  );
}
