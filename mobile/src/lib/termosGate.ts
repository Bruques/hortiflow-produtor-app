import axios from 'axios';

// Espelha deveMostrarBloqueioAssinatura (assinaturaGate.ts), mas pro 401 TERMOS_PENDENTES
// (spec 26) — mesmo status do 401 de sessão inválida, por isso checa o corpo da resposta em
// vez do status sozinho (ver deveDeslogarPorErro em bootstrapSessao.ts, que exclui esse caso).
export function deveMostrarTermosPendentes(erro: unknown): boolean {
  return (
    axios.isAxiosError(erro) &&
    erro.response?.status === 401 &&
    (erro.response.data as { error?: string } | undefined)?.error === 'TERMOS_PENDENTES'
  );
}
