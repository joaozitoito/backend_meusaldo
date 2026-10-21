import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";

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
  if (typeof err === "object" && err !== null && "status" in err && err.status === 413) {
    res.status(413).json({ erro: "A solicitação excede o tamanho permitido." });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    res.status(404).json({ erro: "Lançamento não encontrado." });
    return;
  }
  if (err instanceof SyntaxError) {
    res.status(400).json({
      erro: "JSON invalido.",
      campos: { body: "Nao foi possivel interpretar o corpo da requisicao." },
    });
    return;
  }

  console.error("Falha interna na API.", err instanceof Prisma.PrismaClientKnownRequestError ? err.code : "inesperado");
  res.status(500).json({ erro: "Erro interno do servidor." });
}
