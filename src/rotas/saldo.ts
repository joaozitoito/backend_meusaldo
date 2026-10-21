import { Router } from "express";
import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";

export const rotasSaldo = Router();

// GET /saldo -> total de receitas, total de despesas e o saldo resultante
rotasSaldo.get("/", async (req, res) => {
  const [receitas, despesas] = await prisma.$transaction([
    prisma.receita.aggregate({ where: { usuarioId: req.usuario!.id }, _sum: { valor: true } }),
    prisma.despesa.aggregate({ where: { usuarioId: req.usuario!.id }, _sum: { valor: true } }),
  ], { isolationLevel: "RepeatableRead" });

  const totalReceitas = receitas._sum.valor ?? new Prisma.Decimal(0);
  const totalDespesas = despesas._sum.valor ?? new Prisma.Decimal(0);

  res.status(200).json({
    totalReceitas: totalReceitas.toNumber(),
    totalDespesas: totalDespesas.toNumber(),
    saldo: totalReceitas.minus(totalDespesas).toNumber(),
  });
});
