// Ícone da marca desenhado à mão (SVG), extraído de docs/design/wireframes.html.
// Reutilizado em Login, Splash e (futuramente) na Topbar — nas telas em tamanho pequeno
// o arquivo raster de frontend/src/assets fica "manchado", por isso o vetor é preferido.
export function BrandIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <path d="M50 30c-3-9-11-14-20-13 2 8 8 13 16 14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 30c3-9 11-14 20-13-2 8-8 13-16 14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 33c-6-4-14-4-19 1 4 5 12 6 19 3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 33c6-4 14-4 19 1-4 5-12 6-19 3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 36c-16 0-27 13-27 29 0 15 12 27 27 27s27-12 27-27c0-16-11-29-27-29z" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
      <circle cx="38" cy="58" r="1.8" fill="currentColor" />
      <circle cx="50" cy="53" r="1.8" fill="currentColor" />
      <circle cx="62" cy="58" r="1.8" fill="currentColor" />
      <circle cx="33" cy="70" r="1.8" fill="currentColor" />
      <circle cx="45" cy="67" r="1.8" fill="currentColor" />
      <circle cx="57" cy="67" r="1.8" fill="currentColor" />
      <circle cx="67" cy="70" r="1.8" fill="currentColor" />
      <circle cx="39" cy="80" r="1.8" fill="currentColor" />
      <circle cx="50" cy="83" r="1.8" fill="currentColor" />
      <circle cx="61" cy="80" r="1.8" fill="currentColor" />
    </svg>
  );
}

export function BrandLockup() {
  return (
    <div className="flex flex-col items-center">
      <BrandIcon className="h-16 w-16 text-hf-green-700" />
      <div className="mt-1.5 font-rounded text-2xl font-extrabold tracking-tight text-hf-green-700">
        HortiFlow
      </div>
      <div className="text-[11px] font-bold tracking-[0.32em] text-hf-green-600">PRODUTOR</div>
    </div>
  );
}
