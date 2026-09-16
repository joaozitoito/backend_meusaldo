import { Router } from "express";
import { prisma } from "../prisma";
import { validarId, validarLancamento } from "../validacao";

export const rotasReceitas = Router();

// GET /receitas  -> lista todas (filtro opcional por ?categoria=)
rotasReceitas.get("/", async (req, res) => {
  const categoria = req.query.categoria;

  const receitas = await prisma.receita.findMany({
    where: typeof categoria === "string" ? { categoria } : undefined,
    orderBy: { data: "desc" },
  });

  res.status(200).json(receitas);
});

// GET /receitas/:id -> busca uma receita
rotasReceitas.get("/:id", async (req, res) => {
  const id = validarId(req.params.id);
  if (id === null) {
    res.status(400).json({
      erro: "Dados invalidos.",
      campos: { id: "O id deve ser um numero inteiro positivo." },
    });
    return;
  }

  const receita = await prisma.receita.findUnique({ where: { id } });
  if (!receita) {
    res.status(404).json({ erro: "Receita nao encontrada." });
    return;
  }

  res.status(200).json(receita);
});

// POST /receitas -> cria
rotasReceitas.post("/", async (req, res) => {
  const resultado = validarLancamento(req.body);
  if (!resultado.ok) {
    res.status(400).json({ erro: "Dados invalidos.", campos: resultado.campos });
    return;
  }

  const receita = await prisma.receita.create({ data: resultado.dados });
  res.status(201).json(receita);
});

// PUT /receitas/:id -> atualiza
rotasReceitas.put("/:id", async (req, res) => {
  const id = validarId(req.params.id);
  if (id === null) {
    res.status(400).json({
      erro: "Dados invalidos.",
      campos: { id: "O id deve ser um numero inteiro positivo." },
    });
    return;
  }

  const resultado = validarLancamento(req.body);
  if (!resultado.ok) {
    res.status(400).json({ erro: "Dados invalidos.", campos: resultado.campos });
    return;
  }

  const existe = await prisma.receita.findUnique({ where: { id } });
  if (!existe) {
    res.status(404).json({ erro: "Receita nao encontrada." });
    return;
  }

  const receita = await prisma.receita.update({ where: { id }, data: resultado.dados });
  res.status(200).json(receita);
});

// DELETE /receitas/:id -> remove
rotasReceitas.delete("/:id", async (req, res) => {
  const id = validarId(req.params.id);
  if (id === null) {
    res.status(400).json({
      erro: "Dados invalidos.",
      campos: { id: "O id deve ser um numero inteiro positivo." },
    });
    return;
  }

  const existe = await prisma.receita.findUnique({ where: { id } });
  if (!existe) {
    res.status(404).json({ erro: "Receita nao encontrada." });
    return;
  }

  await prisma.receita.delete({ where: { id } });
  res.status(204).send();
});
