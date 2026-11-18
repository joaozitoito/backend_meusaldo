import type { UsuarioPublico } from "./auth/sessao";

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioPublico;
      /** Dono dos dados financeiros: o titular da conta conjunta ou o próprio usuário. */
      donoId?: number;
      sessaoHash?: string;
      sessaoExpiraEm?: Date;
    }
  }
}
