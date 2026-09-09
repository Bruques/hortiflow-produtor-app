import apiClient from './apiClient';
import type { RespostaExtracao } from '@/types/importacao';

export interface ArquivoParaImportar {
  nome: string;
  // Data URI base64 (mesmo formato que foto_comprovante já usa hoje)
  base64: string;
}

export async function extrairImportacaoRequest(
  safraId: string,
  arquivos: ArquivoParaImportar[]
): Promise<RespostaExtracao> {
  const { data } = await apiClient.post(`/safras/${safraId}/importacao/extrair`, { arquivos });
  return data;
}
