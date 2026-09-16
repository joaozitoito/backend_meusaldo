import { Request, Response, NextFunction } from "express";

const MILISSEGUNDOS = 400;

/**
 * Atraso artificial aplicado somente em requisicoes GET,
 * para que o frontend consiga exibir o estado de "carregando".
 */
export function delayGet(req: Request, _res: Response, next: NextFunction) {
  if (req.method === "GET") {
    setTimeout(next, MILISSEGUNDOS);
    return;
  }
  next();
}
