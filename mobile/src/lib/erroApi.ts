import { AxiosError } from 'axios';

// Mensagem amigável a partir de um erro de API — distingue "sem conexão" (erro do Axios
// sem `response`) de erro de validação/negócio do backend (mensagem em `response.data.error`).
// Usado nas ações de Sociedade (docs/specs/mobile/02-sociedade-e-socios.md): são ações raras
// que exigem conexão no momento, então o app não tenta adivinhar — só informa claramente
// que é preciso estar online, sem enfileirar nada.
export function mensagemErro(erro: unknown, mensagemPadrao: string): string {
  if (erro instanceof AxiosError) {
    if (!erro.response) {
      return 'Sem conexão com a internet — essa ação precisa estar online. Tente novamente quando a conexão voltar.';
    }
    const mensagemBackend = (erro.response.data as { error?: string } | undefined)?.error;
    if (mensagemBackend) return mensagemBackend;
  }
  return mensagemPadrao;
}
