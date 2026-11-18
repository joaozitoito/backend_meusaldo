import { Router, type Request } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { ERRO_MES, lerMes, validarOrcamentos } from "../validacao";

export const rotasOrcamentos = Router();

/** Limites do mes com o gasto (despesas do mes) de cada categoria, calculados no banco. */
async function resumo(usuarioId: number, mes: string, data: { gte: Date; lt: Date }) {
  const [limites, gastos] = await prisma.$transaction([
    prisma.orcamento.findMany({ where: { usuarioId, mes }, orderBy: [{ limite: "desc" }, { categoria: "asc" }] }),
    prisma.despesa.groupBy({ by: ["categoria"], where: { usuarioId, data }, _sum: { valor: true }, orderBy: { categoria: "asc" } }),
  ], { isolationLevel: "RepeatableRead" });
  const zero = new Prisma.Decimal(0);
  const gastoPor = new Map(gastos.map(item => [item.categoria, item._sum?.valor ?? zero]));
  let limite = zero;
  let gasto = zero;
  const categorias = limites.map(item => {
    const gastoCategoria = gastoPor.get(item.categoria) ?? zero;
    limite = limite.plus(item.limite);
    gasto = gasto.plus(gastoCategoria);
    return { categoria: item.categoria, limite: item.limite.toNumber(), gasto: gastoCategoria.toNumber() };
  });
  return { mes, limite: limite.toNumber(), gasto: gasto.toNumber(), categorias };
}

function lerMesObrigatorio(req: Request) {
  const data = lerMes(req.query.mes);
  return data ? { mes: req.query.mes as string, data } : null;
}

// GET /orcamentos?mes=YYYY-MM -> { mes, limite, gasto, categorias: [{ categoria, limite, gasto }] }
rotasOrcamentos.get("/", async (req, res) => {
  const periodo = lerMesObrigatorio(req);
  if (!periodo) {
    res.status(400).json(ERRO_MES);
    return;
  }
  res.status(200).json(await resumo(req.usuario!.id, periodo.mes, periodo.data));
});

// PUT /orcamentos?mes=YYYY-MM com { categorias: [{ categoria, limite }] } substitui todos os limites do mes.
rotasOrcamentos.put("/", async (req, res) => {
  const periodo = lerMesObrigatorio(req);
  if (!periodo) {
    res.status(400).json(ERRO_MES);
    return;
  }
  const resultado = validarOrcamentos(req.body);
  if (!resultado.ok) {
    res.status(400).json({ erro: "Dados invalidos.", campos: resultado.campos });
    return;
  }
  const usuarioId = req.usuario!.id;
  await prisma.$transaction([
    prisma.orcamento.deleteMany({ where: { usuarioId, mes: periodo.mes } }),
    prisma.orcamento.createMany({ data: resultado.dados.map(item => ({ ...item, mes: periodo.mes, usuarioId })) }),
  ]);
  res.status(200).json(await resumo(usuarioId, periodo.mes, periodo.data));
});
