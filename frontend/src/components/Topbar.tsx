import { useEffect, useState } from 'react';
import { BrandIcon } from '@/components/BrandMark';
import { statusAssinaturaRequest } from '@/services/assinatura';

// Aparece em toda tela com bottom nav (docs/design/notas-de-design.md). Menu e notificações
// foram removidos daqui (2026-07-17): o Menu já é acessível pela aba "Menu" da bottom nav v2,
// e notificações não existem no produto ainda (Fase 2).
//
// Spec 25 — banner de trial embutido aqui (não só na HomePage) porque a Topbar é o único
// elemento renderizado em TODAS as páginas com bottom nav (Resumo/Vendas/Despesas/Menu...) —
// é a "home" de verdade que o produtor vê no dia a dia depois de entrar numa safra, diferente
// da lista de seleção de safras, que ele só vê uma vez. Bug relatado pelo dev (2026-09-15):
// o banner só aparecia na lista de safras, nunca dentro da safra em si.
export function Topbar() {
  const [diasTrialRestantes, setDiasTrialRestantes] = useState<number | null>(null);

  useEffect(() => {
    statusAssinaturaRequest()
      .then((dados) => {
        if (dados.status === 'TRIAL' && !dados.vencida) {
          const dias = Math.ceil((new Date(dados.dataFimAcesso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          setDiasTrialRestantes(Math.max(dias, 0));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <div className="flex items-center justify-center px-5 pb-1 pt-2">
        <div className="flex items-center gap-2">
          <BrandIcon className="h-[30px] w-[30px] text-hf-green-700" />
          <div className="font-rounded leading-tight">
            <div className="text-[15px] font-extrabold text-hf-green-700">HortiFlow</div>
            <div className="text-[7.5px] font-bold tracking-[0.22em] text-hf-green-600">PRODUTOR</div>
          </div>
        </div>
      </div>
      {diasTrialRestantes !== null && (
        <div className="bg-hf-green-100 py-1.5 text-center text-xs font-bold text-hf-green-800">
          {diasTrialRestantes === 0
            ? 'Seu teste grátis termina hoje'
            : `Teste grátis · ${diasTrialRestantes} ${diasTrialRestantes === 1 ? 'dia restante' : 'dias restantes'}`}
        </div>
      )}
    </div>
  );
}
