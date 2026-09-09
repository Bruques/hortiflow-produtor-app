import apiClient from './apiClient';
import type { RespostaExtracao } from '../types/importacao';

// Contrato idêntico ao web (frontend/src/services/importacao.ts) — mesmo endpoint
// POST /safras/:id/importacao/extrair implementado na task 24, sem mudança nenhuma no
// backend pra suportar o mobile (docs/specs/mobile/12-importacao-por-ia.md).
export interface ArquivoParaImportar {
  nome: string;
  // Data URI base64 (mesmo formato que foto_comprovante já usa hoje)
  base64: string;
}

// Exige internet — chamado só depois que a tela confirma conexão (useConectividade), já que
// não há como enfileirar uma extração de IA que ainda não existe (ver spec mobile 12).
export async function extrairImportacaoRequest(
  safraId: string,
  arquivos: ArquivoParaImportar[]
): Promise<RespostaExtracao> {
  const { data } = await apiClient.post(`/safras/${safraId}/importacao/extrair`, { arquivos });
  return data;
}
