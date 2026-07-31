import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Repeat, Package, Lock, type LucideIcon } from 'lucide-react';
import { meRequest } from '@/services/auth';
import { listarSociosRequest } from '@/services/sociedades';

interface Categoria {
  rota: string;
  titulo: string;
  subtitulo: string;
  Icone: LucideIcon;
}

export default function ConfiguracoesPage() {
  const { id: sociedadeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Configurações é aberta a partir de vários lugares (Resumo "Ver sócios", Menu, lista de
  // Safras) — usa o histórico real do navegador pra voltar pra origem certa, com fallback
  // pra Safras só quando não há histórico (link direto/refresh), mesmo padrão do
  // AcertoDetalhePage.
  function voltar() {
    if (location.key !== 'default') navigate(-1);
    else navigate(`/sociedades/${sociedadeId}/safras`);
  }

  const [souFinanciador, setSouFinanciador] = useState(false);

  useEffect(() => {
    if (!sociedadeId) return;
    meRequest()
      .then((res) => {
        listarSociosRequest(sociedadeId).then((r) => {
          const eu = r.socios.find((s) => s.usuario_id === res.usuario.id);
          setSouFinanciador(eu?.papel === 'FINANCIADOR' || eu?.papel === 'MISTO');
        });
      })
      .catch(() => {});
  }, [sociedadeId]);

  const categorias: Categoria[] = [
    {
      rota: `/sociedades/${sociedadeId}/configuracoes/socios`,
      titulo: 'Sócios e Sociedade',
      subtitulo: 'Percentual de lucro, convite',
      Icone: Users,
    },
    {
      rota: `/sociedades/${sociedadeId}/configuracoes/regras-despesa`,
      titulo: 'Regras de Despesa',
      subtitulo: 'Despesas automáticas',
      Icone: Repeat,
    },
    ...(souFinanciador
      ? [
          {
            rota: `/sociedades/${sociedadeId}/configuracoes/unidades-de-venda`,
            titulo: 'Unidades de Venda',
            subtitulo: 'Caixa, Kg…',
            Icone: Package,
          },
        ]
      : []),
    {
      rota: `/sociedades/${sociedadeId}/configuracoes/conta`,
      titulo: 'Conta e Senha',
      subtitulo: 'Trocar senha',
      Icone: Lock,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-10 bg-white px-[18px] pb-1 pt-2.5">
        <div className="mx-auto grid w-full max-w-sm grid-cols-[auto_1fr_auto] items-center gap-3">
          <button
            type="button"
            aria-label="Voltar"
            onClick={voltar}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-hf-cream-100 text-hf-stone-900"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
          </button>
          <h2 className="truncate text-center font-rounded text-[17px] font-extrabold text-hf-stone-900">Configurações</h2>
          <div className="h-[38px] w-[38px]" />
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-sm grid-cols-2 content-start gap-3 px-[22px] py-[18px]">
        {categorias.map(({ rota, titulo, subtitulo, Icone }) => (
          <button
            key={rota}
            type="button"
            onClick={() => navigate(rota)}
            className="flex flex-col items-start gap-2.5 rounded-2xl border border-hf-line bg-white p-3.5 text-left"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-hf-green-100 text-hf-green-800">
              <Icone className="h-[18px] w-[18px]" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="m-0 text-[13px] font-extrabold leading-snug text-hf-stone-900">{titulo}</p>
              <p className="m-0 mt-0.5 text-[11px] text-hf-stone-400">{subtitulo}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
