import { Router } from "express";
import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";
import { ERRO_MES, lerMes } from "../validacao";

export const rotasSaldo = Router();

// GET /saldo -> total de receitas, total de despesas e o saldo resultante (todo o periodo ou ?mes=YYYY-MM)
rotasSaldo.get("/", async (req, res) => {
  const data = lerMes(req.query.mes);
  if (data === null) {
    res.status(400).json(ERRO_MES);
    return;
  }
  const where = { usuarioId: req.usuario!.id, ...(data ? { data } : {}) };
  const [receitas, despesas] = await prisma.$transaction([
    prisma.receita.aggregate({ where, _sum: { valor: true } }),
    prisma.despesa.aggregate({ where, _sum: { valor: true } }),
  ], { isolationLevel: "RepeatableRead" });

  const totalReceitas = receitas._sum.valor ?? new Prisma.Decimal(0);
  const totalDespesas = despesas._sum.valor ?? new Prisma.Decimal(0);

  res.status(200).json({
    totalReceitas: totalReceitas.toNumber(),
    totalDespesas: totalDespesas.toNumber(),
    saldo: totalReceitas.minus(totalDespesas).toNumber(),
  });
});

// GET /saldo/mensal?meses=12&ate=YYYY-MM -> um item por mes, do mais antigo ao mes "ate"
rotasSaldo.get("/mensal", async (req, res) => {
  const meses = req.query.meses === undefined ? 12 : Number(req.query.meses);
  const ate = lerMes(req.query.ate ?? new Date().toISOString().slice(0, 7));
  if (!Number.isInteger(meses) || meses < 1 || meses > 24 || typeof req.query.meses === "object") {
    res.status(400).json({ erro: "Dados invalidos.", campos: { meses: "Use um inteiro de 1 a 24." } });
    return;
  }
  if (!ate) {
    res.status(400).json({ erro: "Dados invalidos.", campos: { ate: ERRO_MES.campos.mes } });
    return;
  }
  const inicio = new Date(ate.gte);
  inicio.setUTCMonth(inicio.getUTCMonth() - meses + 1);
  const usuarioId = req.usuario!.id;
  const antes = { usuarioId, data: { lt: inicio } };
  const periodo = { where: { usuarioId, data: { gte: inicio, lt: ate.lt } }, select: { valor: true, data: true } };

  const [receitasAntes, despesasAntes, receitas, despesas] = await prisma.$transaction([
    prisma.receita.aggregate({ where: antes, _sum: { valor: true } }),
    prisma.despesa.aggregate({ where: antes, _sum: { valor: true } }),
    prisma.receita.findMany(periodo),
    prisma.despesa.findMany(periodo),
  ], { isolationLevel: "RepeatableRead" });

  const zero = new Prisma.Decimal(0);
  const lista = Array.from({ length: meses }, (_, indice) => {
    const dia = new Date(inicio);
    dia.setUTCMonth(dia.getUTCMonth() + indice);
    return { mes: dia.toISOString().slice(0, 7), receitas: zero, despesas: zero };
  });
  const posicao = (data: Date) => (data.getUTCFullYear() - inicio.getUTCFullYear()) * 12 + data.getUTCMonth() - inicio.getUTCMonth();
  for (const item of receitas) lista[posicao(item.data)].receitas = lista[posicao(item.data)].receitas.plus(item.valor);
  for (const item of despesas) lista[posicao(item.data)].despesas = lista[posicao(item.data)].despesas.plus(item.valor);

  let acumulado = (receitasAntes._sum.valor ?? zero).minus(despesasAntes._sum.valor ?? zero);
  res.status(200).json(lista.map(item => {
    const saldo = item.receitas.minus(item.despesas);
    acumulado = acumulado.plus(saldo);
    return { mes: item.mes, receitas: item.receitas.toNumber(), despesas: item.despesas.toNumber(), saldo: saldo.toNumber(), saldoAcumulado: acumulado.toNumber() };
  }));
});
