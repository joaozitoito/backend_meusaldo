import { Router } from "express";
import { Prisma } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { prisma } from "../prisma";
import { selecionarUsuario } from "../auth/sessao";
import { emitir, encerrarEventos } from "../tempo-real";

export const rotasConjunta = Router();

// Sem 0/O e 1/I para evitar erro de digitação; 32 símbolos dividem 256, então não há viés.
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TAMANHO_CODIGO = 10;
const VALIDADE_CONVITE_MS = 24 * 60 * 60 * 1000;
const limitarEntrada = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true,
  standardHeaders: "draft-8", legacyHeaders: false, validate: { xForwardedForHeader: false },
  message: { erro: "Muitas tentativas com código de convite. Aguarde 15 minutos e tente novamente." },
});

const hashCodigo = (codigo: string) => createHash("sha256").update(codigo).digest("hex");
export function gerarCodigo(): string {
  return Array.from(randomBytes(TAMANHO_CODIGO), byte => ALFABETO[byte % ALFABETO.length]).join("");
}
/** Aceita minúsculas, espaços e hífens digitados; devolve null se não for um código possível. */
export function normalizarCodigo(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const codigo = valor.replace(/[\s-]/g, "").toUpperCase();
  return new RegExp(`^[${ALFABETO}]{${TAMANHO_CODIGO}}$`).test(codigo) ? codigo : null;
}

async function estado(usuarioId: number) {
  const usuario = await prisma.usuario.findUniqueOrThrow({
    where: { id: usuarioId },
    select: { titular: { select: selecionarUsuario }, membros: { select: selecionarUsuario }, conviteExpiraEm: true },
  });
  if (usuario.titular) return { papel: "membro" as const, parceiro: usuario.titular, conviteExpiraEm: null };
  if (usuario.membros[0]) return { papel: "titular" as const, parceiro: usuario.membros[0], conviteExpiraEm: null };
  const ativo = usuario.conviteExpiraEm && usuario.conviteExpiraEm > new Date() ? usuario.conviteExpiraEm : null;
  return { papel: "individual" as const, parceiro: null, conviteExpiraEm: ativo };
}

/** Avisa quem via os dados antigos e derruba os streams para reconectarem no dono novo. */
function avisarMudanca(donoAnterior: number, autor: { id: number; nome: string }, afetados: number[]) {
  emitir(donoAnterior, { tipo: "conjunta", autor });
  encerrarEventos(cliente => afetados.includes(cliente.usuarioId));
}

rotasConjunta.get("/", async (req, res) => {
  res.status(200).json(await estado(req.usuario!.id));
});

rotasConjunta.post("/convite", async (req, res) => {
  const eu = req.usuario!.id;
  const atual = await estado(eu);
  if (atual.papel !== "individual") {
    res.status(409).json({ erro: "Você já está em uma conta conjunta. Saia dela para gerar um novo convite." });
    return;
  }
  const codigo = gerarCodigo();
  const conviteExpiraEm = new Date(Date.now() + VALIDADE_CONVITE_MS);
  // Só o hash fica no banco; o código aparece uma vez, para ser repassado à outra pessoa.
  await prisma.usuario.update({ where: { id: eu }, data: { conviteHash: hashCodigo(codigo), conviteExpiraEm } });
  res.status(201).json({ codigo, conviteExpiraEm });
});

rotasConjunta.post("/entrar", limitarEntrada, async (req, res) => {
  const codigo = normalizarCodigo(req.body?.codigo);
  if (!codigo) {
    res.status(400).json({ erro: "Confira os campos informados.", campos: { codigo: `Informe o código de ${TAMANHO_CODIGO} caracteres recebido.` } });
    return;
  }
  const eu = req.usuario!.id;
  const hash = hashCodigo(codigo);
  type Falha = { status: 400 | 404 | 409; erro: string };
  let resultado: Falha | { titularId: number };
  try {
    // Serializable impede que duas entradas simultâneas formem cadeia ou um terceiro membro.
    resultado = await prisma.$transaction(async banco => {
      const titular = await banco.usuario.findFirst({
        where: { conviteHash: hash, conviteExpiraEm: { gt: new Date() } },
        select: { id: true, titularId: true, _count: { select: { membros: true } } },
      });
      if (!titular) return { status: 404, erro: "Código inválido ou expirado. Peça um novo convite." } satisfies Falha;
      if (titular.id === eu) return { status: 400, erro: "Este convite é seu. Envie o código para a outra pessoa." } satisfies Falha;
      const usuario = await banco.usuario.findUniqueOrThrow({ where: { id: eu }, select: { titularId: true, _count: { select: { membros: true } } } });
      if (usuario.titularId || usuario._count.membros) return { status: 409, erro: "Saia da sua conta conjunta atual antes de entrar em outra." } satisfies Falha;
      if (titular.titularId || titular._count.membros) return { status: 409, erro: "Este convite não está mais disponível." } satisfies Falha;
      await banco.usuario.update({ where: { id: titular.id }, data: { conviteHash: null, conviteExpiraEm: null } });
      await banco.usuario.update({ where: { id: eu }, data: { titularId: titular.id, conviteHash: null, conviteExpiraEm: null } });
      return { titularId: titular.id };
    }, { isolationLevel: "Serializable" });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2034") {
      res.status(409).json({ erro: "O convite foi usado ao mesmo tempo por outra pessoa. Tente novamente." });
      return;
    }
    throw erro;
  }
  if ("status" in resultado) {
    res.status(resultado.status).json({ erro: resultado.erro });
    return;
  }
  avisarMudanca(resultado.titularId, req.usuario!, [eu, resultado.titularId]);
  res.status(200).json(await estado(eu));
});

rotasConjunta.post("/sair", async (req, res) => {
  const eu = req.usuario!.id;
  const atual = await estado(eu);
  if (atual.papel === "individual") {
    res.status(409).json({ erro: "Você não está em uma conta conjunta." });
    return;
  }
  // O titular encerra removendo o membro; o membro encerra saindo. Os dados ficam com o titular.
  if (atual.papel === "membro") await prisma.usuario.update({ where: { id: eu }, data: { titularId: null } });
  else await prisma.usuario.updateMany({ where: { titularId: eu }, data: { titularId: null } });
  avisarMudanca(req.donoId!, req.usuario!, [eu, atual.parceiro.id]);
  res.status(204).send();
});
