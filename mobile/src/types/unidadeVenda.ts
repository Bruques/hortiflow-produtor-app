// Copiado manualmente de frontend/src/types/unidadeVenda.ts — mobile/ e frontend/ não
// compartilham tipos entre si (docs/specs/mobile/00-setup-e-infra.md).
export interface UnidadeVenda {
  id: string;
  sociedade_id: string;
  nome: string;
  ativo: boolean;
}
