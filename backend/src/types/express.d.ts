// Estende o tipo Request do Express para incluir o usuário injetado pelo middleware de auth
declare namespace Express {
  interface Request {
    usuarioId: string;
  }
}
