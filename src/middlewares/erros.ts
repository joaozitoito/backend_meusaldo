import { Request, Response, NextFunction } from "express";

/** Rota inexistente. */
export function rotaNaoEncontrada(_req: Request, res: Response) {
  res.status(404).json({ erro: "Rota nao encontrada." });
}

/** Erro inesperado (ex.: JSON malformado ou falha do banco). */
export function tratarErro(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof SyntaxError) {
    res.status(400).json({
      erro: "JSON invalido.",
      campos: { body: "Nao foi possivel interpretar o corpo da requisicao." },
    });
    return;
  }

  console.error(err);
  res.status(500).json({ erro: "Erro interno do servidor." });
}
