import { Router } from "express";
import { prisma } from "../prisma";
import { validarId, validarLancamento } from "../validacao";

export const rotasDespesas = Router();

// GET /despesas  -> lista todas (filtro opcional por ?categoria=)
rotasDespesas.get("/", async (req, res) => {
  const categoria = req.query.categoria;

  const despesas = await prisma.despesa.findMany({
    where: typeof categoria === "string" ? { categoria } : undefined,
    orderBy: { data: "desc" },
  });

  res.status(200).json(despesas);
});

// GET /despesas/:id -> busca uma despesa
rotasDespesas.get("/:id", async (req, res) => {
  const id = validarId(req.params.id);
  if (id === null) {
    res.status(400).json({
      erro: "Dados invalidos.",
      campos: { id: "O id deve ser um numero inteiro positivo." },
    });
    return;
  }

  const despesa = await prisma.despesa.findUnique({ where: { id } });
  if (!despesa) {
    res.status(404).json({ erro: "Despesa nao encontrada." });
    return;
  }

  res.status(200).json(despesa);
});

// POST /despesas -> cria
rotasDespesas.post("/", async (req, res) => {
  const resultado = validarLancamento(req.body);
  if (!resultado.ok) {
    res.status(400).json({ erro: "Dados invalidos.", campos: resultado.campos });
    return;
  }

  const despesa = await prisma.despesa.create({ data: resultado.dados });
  res.status(201).json(despesa);
});

// PUT /despesas/:id -> atualiza
rotasDespesas.put("/:id", async (req, res) => {
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

  const existe = await prisma.despesa.findUnique({ where: { id } });
  if (!existe) {
    res.status(404).json({ erro: "Despesa nao encontrada." });
    return;
  }

  const despesa = await prisma.despesa.update({ where: { id }, data: resultado.dados });
  res.status(200).json(despesa);
});

// DELETE /despesas/:id -> remove
rotasDespesas.delete("/:id", async (req, res) => {
  const id = validarId(req.params.id);
  if (id === null) {
    res.status(400).json({
      erro: "Dados invalidos.",
      campos: { id: "O id deve ser um numero inteiro positivo." },
    });
    return;
  }

  const existe = await prisma.despesa.findUnique({ where: { id } });
  if (!existe) {
    res.status(404).json({ erro: "Despesa nao encontrada." });
    return;
  }

  await prisma.despesa.delete({ where: { id } });
  res.status(204).send();
});
