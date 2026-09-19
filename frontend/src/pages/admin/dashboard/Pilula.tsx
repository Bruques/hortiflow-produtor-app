import { cn } from '@/lib/utils';
import type { SituacaoProdutor } from '@/types/adminDashboard';
import { CLASSE_TOM, SITUACAO } from './formatos';

// Situação do produtor como pílula: o rótulo em texto garante que a informação não dependa só da cor.
export default function Pilula({ situacao }: { situacao: SituacaoProdutor }) {
  const { rotulo, tom } = SITUACAO[situacao];
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-[3px] pl-2 pr-2.5 text-etiqueta font-semibold', CLASSE_TOM[tom])}>
      <span className="h-[7px] w-[7px] rounded-full bg-current" />
      {rotulo}
    </span>
  );
}
