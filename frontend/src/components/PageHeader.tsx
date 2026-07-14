interface PageHeaderProps {
  title: string;
  apoio?: string;
}

// Fica fixo (sticky) no topo pra manter o título visível ao rolar listas longas.
export function PageHeader({ title, apoio }: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-10 -mx-4 px-4 pt-4 pb-3 bg-background border-b">
      <h1 className="text-xl font-bold text-center">{title}</h1>
      {apoio && <p className="text-sm text-muted-foreground text-center mt-1">{apoio}</p>}
    </div>
  );
}
