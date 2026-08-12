import { AxiosError } from 'axios';

// Mensagem amigável a partir de um erro de API — distingue "não deu pra falar com o servidor"
// (erro do Axios sem `response`) de erro de validação/negócio do backend (mensagem em
// `response.data.error`). Usado nas ações de Sociedade (docs/specs/mobile/
// 02-sociedade-e-socios.md): são ações raras que exigem conexão no momento, então o app não
// tenta adivinhar — só informa que a ação não foi concluída, sem enfileirar nada.
//
// Um AxiosError sem `response` não prova que o aparelho está sem internet — o mesmo erro
// acontece se o backend estiver momentaneamente fora do ar (deploy, instabilidade) ou a
// requisição estourar o timeout, mesmo com o celular plenamente conectado. Dizer "sem conexão
// com a internet" nesse caso culpa a rede do produtor por um problema que pode ser do servidor
// (bug relatado 2026-08-12: mensagem de "offline" aparecendo com internet normal).
export function mensagemErro(erro: unknown, mensagemPadrao: string): string {
  if (erro instanceof AxiosError) {
    if (!erro.response) {
      return 'Não foi possível falar com o servidor. Verifique sua internet ou tente novamente em instantes.';
    }
    const mensagemBackend = (erro.response.data as { error?: string } | undefined)?.error;
    if (mensagemBackend) return mensagemBackend;
  }
  return mensagemPadrao;
}
