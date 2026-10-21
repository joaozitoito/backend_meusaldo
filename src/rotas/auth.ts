import { Router } from "express";
import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { prisma } from "../prisma";
import { validarCadastro, validarLogin } from "../auth/validacao";
import { conferirSenha, hashSenha } from "../auth/senha";
import { abrirSessao, exigirSessao, limparCookie, selecionarUsuario } from "../auth/sessao";

export const rotasAuth = Router();
// A conta inexistente também executa verificação de hash para reduzir diferenças de tempo.
const hashInexistente = hashSenha(randomBytes(32).toString("hex"));
const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true,
  standardHeaders: "draft-8", legacyHeaders: false, validate: { xForwardedForHeader: false },
  message: { erro: "Muitas tentativas de login. Aguarde 15 minutos e tente novamente." },
});
const limitarCadastro = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false,
  validate: { xForwardedForHeader: false }, message: { erro: "Muitas tentativas de cadastro. Aguarde uma hora e tente novamente." },
});

rotasAuth.post("/registro", limitarCadastro, async (req, res) => {
  const resultado = validarCadastro(req.body);
  if (!resultado.ok) {
    res.status(400).json({ erro: "Confira os campos informados.", campos: resultado.campos });
    return;
  }
  const { nome, email, senha } = resultado.dados;
  try {
    const usuario = await prisma.usuario.create({ data: { nome, email, senhaHash: await hashSenha(senha) }, select: selecionarUsuario });
    res.status(201).json({ usuario });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      res.status(409).json({ erro: "Já existe uma conta com este e-mail.", campos: { email: "Use outro e-mail ou entre na sua conta." } });
      return;
    }
    throw erro;
  }
});

rotasAuth.post("/login", limitarLogin, async (req, res) => {
  const resultado = validarLogin(req.body);
  if (!resultado.ok) {
    res.status(400).json({ erro: "Confira os campos informados.", campos: resultado.campos });
    return;
  }
  const usuario = await prisma.usuario.findUnique({ where: { email: resultado.dados.email }, select: { ...selecionarUsuario, senhaHash: true } });
  const correta = await conferirSenha(usuario?.senhaHash ?? await hashInexistente, resultado.dados.senha);
  if (!usuario || !correta) {
    res.status(401).json({ erro: "E-mail ou senha incorretos." });
    return;
  }
  res.status(200).json(await abrirSessao(req, res, usuario));
});

rotasAuth.get("/me", exigirSessao, (req, res) => {
  res.status(200).json({ usuario: req.usuario, expiraEm: req.sessaoExpiraEm });
});

rotasAuth.post("/logout", exigirSessao, async (req, res) => {
  await prisma.sessao.deleteMany({ where: { tokenHash: req.sessaoHash! } });
  limparCookie(res);
  res.status(204).send();
});
