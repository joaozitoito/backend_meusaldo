import type { RequestHandler } from "express";

export function protegerCsrf(origens: string[]): RequestHandler {
  return (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origem = req.get("Origin");
      if (req.get("X-MeuSaldo-Request") !== "1" || (origem && !origens.includes(origem)) || req.get("Sec-Fetch-Site") === "cross-site") {
        res.status(403).json({ erro: "Origem da solicitação não permitida. Reabra a aplicação e tente novamente." });
        return;
      }
    }
    next();
  };
}
