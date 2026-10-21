import { Router } from "express";
import { prisma } from "../prisma";
import { validarId, validarLancamento } from "../validacao";
import { serializarLancamento } from "../financeiro";

export const rotasDespesas = Router();

rotasDespesas.get("/", async (req, res) => {
  const categoria = req.query.categoria;
  const registros = await prisma.despesa.findMany({
    where: { usuarioId: req.usuario!.id, ...(typeof categoria === "string" ? { categoria } : {}) },
    orderBy: [{ data: "desc" }, { id: "desc" }],
  });
  res.status(200).json(registros.map(serializarLancamento));
});

rotasDespesas.get("/:id", async (req, res) => {
  const id = validarId(req.params.id);
  if (id === null) {
    res.status(400).json({ erro: "Dados invalidos.", campos: { id: "O id deve ser um numero inteiro positivo." } });
    return;
  }
  const registro = await prisma.despesa.findFirst({ where: { id, usuarioId: req.usuario!.id } });
  if (!registro) {
    res.status(404).json({ erro: "Despesa nao encontrada." });
    return;
  }
  res.status(200).json(serializarLancamento(registro));
});

rotasDespesas.post("/", async (req, res) => {
  const resultado = validarLancamento(req.body);
  if (!resultado.ok) {
    res.status(400).json({ erro: "Dados invalidos.", campos: resultado.campos });
    return;
  }
  const registro = await prisma.despesa.create({ data: { ...resultado.dados, usuarioId: req.usuario!.id } });
  res.status(201).json(serializarLancamento(registro));
});

rotasDespesas.put("/:id", async (req, res) => {
  const id = validarId(req.params.id);
  if (id === null) {
    res.status(400).json({ erro: "Dados invalidos.", campos: { id: "O id deve ser um numero inteiro positivo." } });
    return;
  }
  const resultado = validarLancamento(req.body);
  if (!resultado.ok) {
    res.status(400).json({ erro: "Dados invalidos.", campos: resultado.campos });
    return;
  }
  const registro = await prisma.despesa.update({ where: { id, usuarioId: req.usuario!.id }, data: resultado.dados });
  res.status(200).json(serializarLancamento(registro));
});

rotasDespesas.delete("/:id", async (req, res) => {
  const id = validarId(req.params.id);
  if (id === null) {
    res.status(400).json({ erro: "Dados invalidos.", campos: { id: "O id deve ser um numero inteiro positivo." } });
    return;
  }
  await prisma.despesa.delete({ where: { id, usuarioId: req.usuario!.id } });
  res.status(204).send();
});
