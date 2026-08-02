import axios from 'axios';

// Distingue "sessão realmente inválida" (401 de verdade vindo de `/auth/me`) de "estamos
// offline" (timeout, sem conexão, qualquer erro do Axios sem `response`) — só o primeiro
// caso desloga o usuário. É o ponto mais fácil de implementar errado (bibliotecas de HTTP
// tratam timeout e 401 de forma parecida se não for checado explicitamente), por isso é
// isolado numa função pura e testado à parte (docs/specs/mobile/01-auth.md).
export function deveDeslogarPorErro(erro: unknown): boolean {
  return axios.isAxiosError(erro) && erro.response?.status === 401;
}
