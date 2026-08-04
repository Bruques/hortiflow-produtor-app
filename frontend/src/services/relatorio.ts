import apiClient from './apiClient';
import type { PeriodoFiltro } from '@/types/simulacao';

export interface FiltroRelatorio {
  periodo?: PeriodoFiltro;
  data_inicio?: string;
  data_fim?: string;
}

// Baixa o PDF (responseType: 'blob', já que o backend devolve o arquivo binário direto,
// sem envelope JSON) e dispara o download no navegador — não há tela de "visualizar antes",
// só gerar e salvar.
export async function baixarRelatorioRequest(safraId: string, filtro: FiltroRelatorio, nomeArquivo: string): Promise<void> {
  const { data } = await apiClient.get(`/safras/${safraId}/relatorio`, {
    params: filtro,
    responseType: 'blob',
  });

  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
