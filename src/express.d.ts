import type { UsuarioPublico } from "./auth/sessao";

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioPublico;
      sessaoHash?: string;
      sessaoExpiraEm?: Date;
    }
  }
}
