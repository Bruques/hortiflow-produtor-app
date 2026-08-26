import axios from 'axios';

// Espelha deveDeslogarPorErro (bootstrapSessao.ts), mas pra 402 (assinatura vencida do
// titular da sociedade/safra acessada) — diferente do 401, não desloga, só navega pra tela
// de bloqueio (ver AuthContext.tsx, spec 18).
export function deveMostrarBloqueioAssinatura(erro: unknown): boolean {
  return axios.isAxiosError(erro) && erro.response?.status === 402;
}
