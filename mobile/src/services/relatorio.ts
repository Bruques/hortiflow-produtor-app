import { fetch } from 'expo/fetch';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import apiClient from './apiClient';
import { getToken } from '../lib/tokenStorage';
import type { PeriodoFiltro } from '../types/simulacao';

export interface FiltroRelatorio {
  periodo?: PeriodoFiltro;
  data_inicio?: string;
  data_fim?: string;
}

// Não usa `apiClient` (axios) aqui: suporte a resposta binária (arraybuffer/blob) do axios é
// pouco confiável no runtime do React Native, então o download usa `expo/fetch` (fetch
// WHATWG oficial do Expo SDK 57) direto, com o token anexado manualmente — o único lugar do
// app que não passa pelo interceptor de `apiClient`. Erros HTTP (403/400) são detectados por
// `response.ok`; sem isso, uma resposta de erro em JSON seria salva e compartilhada como se
// fosse um PDF válido, mas quebrado.
export async function baixarECompartilharRelatorioRequest(
  safraId: string,
  filtro: FiltroRelatorio,
  nomeArquivo: string
): Promise<void> {
  const token = await getToken();
  const query = new URLSearchParams(
    Object.entries(filtro).filter((par): par is [string, string] => par[1] !== undefined)
  ).toString();
  const url = `${apiClient.defaults.baseURL}/safras/${safraId}/relatorio?${query}`;

  const resposta = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!resposta.ok) {
    let mensagem = 'Não foi possível gerar o relatório';
    try {
      const corpo = (await resposta.json()) as { error?: string };
      if (corpo.error) mensagem = corpo.error;
    } catch {
      // corpo de erro não veio em JSON (ex: erro de proxy/gateway) — mantém a mensagem padrão
    }
    throw new Error(mensagem);
  }

  const bytes = new Uint8Array(await resposta.arrayBuffer());
  // `Paths.cache` (não `Paths.document`): o PDF só precisa existir o tempo de abrir a folha
  // de compartilhamento — spec 09 declara explicitamente que não há cache do relatório
  // gerado, cada chamada busca um PDF novo do servidor.
  const arquivo = new File(Paths.cache, nomeArquivo);
  arquivo.create({ overwrite: true });
  arquivo.write(bytes);

  const disponivel = await Sharing.isAvailableAsync();
  if (!disponivel) {
    throw new Error('Compartilhamento não está disponível neste dispositivo');
  }
  await Sharing.shareAsync(arquivo.uri, { mimeType: 'application/pdf', dialogTitle: 'Compartilhar relatório' });
}
