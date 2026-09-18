// Spec 27 — a maioria das rotas nem precisa aparecer aqui: qualquer rota com path começando
// em `/:id` montada depois de um `router.use('/:id', ...)` de gate já é reconhecida
// automaticamente pelo teste de cobertura (assinaturaGate.cobertura.test.ts), sem precisar
// listar cada uma. Este arquivo só existe pra classificar as EXCEÇÕES conscientes — rotas
// que nunca passam por esse padrão `:id` e por isso, sem essa lista, ficariam sem checagem
// nenhuma sem ninguém perceber (foi exatamente assim que o bug relatado 2026-09-17
// aconteceu: GET /safras e GET /safras/resumo ficaram de fora por serem "sem :id").
//
// Uma rota nova que não se encaixa em nenhuma categoria abaixo, e também não é `/:id/...`
// depois de um gate, faz o teste de cobertura falhar — é a checagem consciente que substitui
// "lembrar" de proteger toda rota nova.

interface RotaManifesto {
  arquivo: string; // nome do arquivo em backend/src/routes/
  metodo: 'get' | 'post' | 'put' | 'patch' | 'delete';
  caminho: string; // exatamente como aparece no router.<metodo>('...') do arquivo
}

// Nunca bloqueadas por assinatura vencida, de propósito — ver docs/specs/18 e docs/specs/27.
export const ROTAS_ISENTAS: RotaManifesto[] = [
  // auth.ts — login/registro/perfil não podem depender de assinatura em dia
  { arquivo: 'auth.ts', metodo: 'post', caminho: '/register' },
  { arquivo: 'auth.ts', metodo: 'post', caminho: '/login' },
  { arquivo: 'auth.ts', metodo: 'post', caminho: '/logout' },
  { arquivo: 'auth.ts', metodo: 'get', caminho: '/me' },
  { arquivo: 'auth.ts', metodo: 'put', caminho: '/senha' },
  { arquivo: 'auth.ts', metodo: 'delete', caminho: '/me' },

  // assinatura.ts — o próprio fluxo de pagamento/consulta nunca pode ficar preso atrás do gate
  { arquivo: 'assinatura.ts', metodo: 'get', caminho: '/status' },
  { arquivo: 'assinatura.ts', metodo: 'post', caminho: '/cancelar' },
  { arquivo: 'assinatura.ts', metodo: 'get', caminho: '/planos' },
  { arquivo: 'assinatura.ts', metodo: 'post', caminho: '/onboarding' },
  { arquivo: 'assinatura.ts', metodo: 'patch', caminho: '/plano' },
  { arquivo: 'assinatura.ts', metodo: 'post', caminho: '/checkout' },
  { arquivo: 'assinatura.ts', metodo: 'get', caminho: '/checkout/pix/:orderId/status' },

  // admin.ts — painel do dev, autorizado por adminAuthMiddleware (admin=true), não pela
  // assinatura do produtor — o conceito nem se aplica aqui
  { arquivo: 'admin.ts', metodo: 'post', caminho: '/auth/login' },
  { arquivo: 'admin.ts', metodo: 'get', caminho: '/assinaturas' },
  { arquivo: 'admin.ts', metodo: 'get', caminho: '/planos' },
  { arquivo: 'admin.ts', metodo: 'patch', caminho: '/assinaturas/:usuarioId/plano' },
  { arquivo: 'admin.ts', metodo: 'patch', caminho: '/assinaturas/:usuarioId/limite-safras' },
  { arquivo: 'admin.ts', metodo: 'post', caminho: '/assinaturas/:usuarioId/checkout-link' },
  { arquivo: 'admin.ts', metodo: 'post', caminho: '/assinaturas/:usuarioId/pagamento-manual' },
  { arquivo: 'admin.ts', metodo: 'patch', caminho: '/planos/:planoId' },

  // termos.ts — aceite de Termos de Uso precisa funcionar mesmo com trial/assinatura vencida
  { arquivo: 'termos.ts', metodo: 'get', caminho: '/status' },
  { arquivo: 'termos.ts', metodo: 'post', caminho: '/aceite' },

  // sociedades.ts — criar/entrar/listar acontecem antes de existir um :id de sociedade pra
  // checar; criar uma Sociedade nova já é limitada por outra regra (podeAtivarSafra/plano),
  // não pelo gate de tempo
  { arquivo: 'sociedades.ts', metodo: 'post', caminho: '/' },
  { arquivo: 'sociedades.ts', metodo: 'post', caminho: '/entrar' },
  { arquivo: 'sociedades.ts', metodo: 'get', caminho: '/convite/:codigo' },
  { arquivo: 'sociedades.ts', metodo: 'get', caminho: '/' },
];

// Nunca devolvem 402 — em vez disso, filtram o próprio resultado por titular, pra não
// bloquear em bloco uma lista que pode abranger sociedades de titulares diferentes (ver
// assinatura.service.ts#titularesLiberados, safras.service.ts#listarSafrasDoUsuario e
// #titularesVencidosDasSafras).
export const ROTAS_AGREGADAS: RotaManifesto[] = [
  { arquivo: 'safras.ts', metodo: 'get', caminho: '/' },
  { arquivo: 'safras.ts', metodo: 'get', caminho: '/resumo' },
  { arquivo: 'despesas.ts', metodo: 'post', caminho: '/compartilhada' },
];

// Rotas sem authMiddleware — webhooks de gateway, autenticados por token próprio (não JWT de
// usuário), fora do universo de "assinatura de produtor" por definição.
export const ROTAS_PUBLICAS: RotaManifesto[] = [
  { arquivo: 'webhooksAsaas.ts', metodo: 'post', caminho: '/' },
  { arquivo: 'webhooksMercadoPago.ts', metodo: 'post', caminho: '/' },
];
