import { createHash, randomBytes } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import { prisma } from "../prisma";

export type UsuarioPublico = { id: number; nome: string; email: string };
export const selecionarUsuario = { id: true, nome: true, email: true } as const;
const DURACAO_MS = 60 * 60 * 1000;

export function nomeCookie() {
  return process.env.NODE_ENV === "production" ? "__Host-meusaldo_sessao" : "meusaldo_sessao";
}
export function opcoesCookie() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
}
export function lerToken(req: Request): string | undefined {
  const prefixo = `${nomeCookie()}=`;
  const token = req.headers.cookie?.split(";").map(parte => parte.trim()).find(parte => parte.startsWith(prefixo))?.slice(prefixo.length);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export function limparCookie(res: Response) {
  res.clearCookie(nomeCookie(), opcoesCookie());
}
export async function abrirSessao(req: Request, res: Response, usuario: UsuarioPublico) {
  const token = randomBytes(32).toString("hex");
  const expiraEm = new Date(Date.now() + DURACAO_MS);
  const anterior = lerToken(req);
  await prisma.$transaction(async banco => {
    if (anterior) await banco.sessao.deleteMany({ where: { tokenHash: hashToken(anterior) } });
    await banco.sessao.deleteMany({ where: { usuarioId: usuario.id, expiraEm: { lte: new Date() } } });
    await banco.sessao.create({ data: { tokenHash: hashToken(token), usuarioId: usuario.id, expiraEm } });
  });
  res.cookie(nomeCookie(), token, { ...opcoesCookie(), maxAge: DURACAO_MS });
  return { usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }, expiraEm };
}

export const exigirSessao: RequestHandler = async (req, res, next) => {
  const token = lerToken(req);
  const sessao = token ? await prisma.sessao.findUnique({
    where: { tokenHash: hashToken(token) }, include: { usuario: { select: selecionarUsuario } },
  }) : null;
  if (!sessao || sessao.expiraEm.getTime() <= Date.now()) {
    // Um 401 atrasado não deve apagar o cookie criado por um login mais recente.
    res.status(401).json({ erro: "Sessão ausente, expirada ou inválida. Entre novamente." });
    return;
  }
  req.usuario = sessao.usuario;
  req.sessaoHash = sessao.tokenHash;
  req.sessaoExpiraEm = sessao.expiraEm;
  next();
};
