import { Router } from "express";
import { prisma } from "../prisma";

export const rotasSaldo = Router();

// GET /saldo -> total de receitas, total de despesas e o saldo resultante
rotasSaldo.get("/", async (_req, res) => {
  const [receitas, despesas] = await Promise.all([
    prisma.receita.aggregate({ _sum: { valor: true } }),
    prisma.despesa.aggregate({ _sum: { valor: true } }),
  ]);

  const totalReceitas = receitas._sum.valor ?? 0;
  const totalDespesas = despesas._sum.valor ?? 0;

  res.status(200).json({
    totalReceitas: Number(totalReceitas.toFixed(2)),
    totalDespesas: Number(totalDespesas.toFixed(2)),
    saldo: Number((totalReceitas - totalDespesas).toFixed(2)),
  });
});
