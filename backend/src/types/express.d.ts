// Estende o tipo Request do Express para incluir o usuário injetado pelo middleware de auth
declare namespace Express {
  interface Request {
    usuarioId: string;
    // Spec 18 — injetado pelo adminAuthMiddleware, separado de usuarioId (login de admin
    // não tem relação nenhuma com contas de produtor).
    adminId: string;
  }
}
