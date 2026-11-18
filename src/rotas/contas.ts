import { Router } from "express";
import { prisma } from "../prisma";
import { ERRO_MES, lerDia, lerMes, validarConta, validarId } from "../validacao";
import { serializarLancamento } from "../financeiro";

export const rotasContas = Router();

const ERRO_ID = { erro: "Dados invalidos.", campos: { id: "O id deve ser um numero inteiro positivo." } };

// GET /contas?status=aberta|paga&mes=YYYY-MM&ate=YYYY-MM-DD (filtros pelo vencimento)
rotasContas.get("/", async (req, res) => {
  const { status } = req.query;
  const mes = lerMes(req.query.mes);
  const ate = lerDia(req.query.ate);
  if (mes === null) {
    res.status(400).json(ERRO_MES);
    return;
  }
  if (status !== undefined && status !== "aberta" && status !== "paga") {
    res.status(400).json({ erro: "Dados invalidos.", campos: { status: "Use aberta ou paga." } });
    return;
  }
  if (ate === null) {
    res.status(400).json({ erro: "Dados invalidos.", campos: { ate: "Use a data no formato YYYY-MM-DD." } });
    return;
  }
  const registros = await prisma.conta.findMany({
    where: {
      usuarioId: req.donoId!,
      ...(status ? { pagaEm: status === "paga" ? { not: null } : null } : {}),
      ...(mes || ate ? { vencimento: { ...mes, ...(ate ? { lte: ate } : {}) } } : {}),
    },
    orderBy: [{ vencimento: "asc" }, { id: "asc" }],
  });
  res.status(200).json(registros.map(serializarLancamento));
});

rotasContas.get("/:id", async (req, res) => {
  const id = validarId(req.params.id);
  if (id === null) {
    res.status(400).json(ERRO_ID);
    return;
  }
  const registro = await prisma.conta.findFirst({ where: { id, usuarioId: req.donoId! } });
  if (!registro) {
    res.status(404).json({ erro: "Conta nao encontrada." });
    return;
  }
  res.status(200).json(serializarLancamento(registro));
});

rotasContas.post("/", async (req, res) => {
  const resultado = validarConta(req.body);
  if (!resultado.ok) {
    res.status(400).json({ erro: "Dados invalidos.", campos: resultado.campos });
    return;
  }
  const registro = await prisma.conta.create({ data: { ...resultado.dados, usuarioId: req.donoId! } });
  res.status(201).json(serializarLancamento(registro));
});

rotasContas.put("/:id", async (req, res) => {
  const id = validarId(req.params.id);
  if (id === null) {
    res.status(400).json(ERRO_ID);
    return;
  }
  const resultado = validarConta(req.body);
  if (!resultado.ok) {
    res.status(400).json({ erro: "Dados invalidos.", campos: resultado.campos });
    return;
  }
  const registro = await prisma.conta.update({ where: { id, usuarioId: req.donoId! }, data: resultado.dados });
  res.status(200).json(serializarLancamento(registro));
});

rotasContas.delete("/:id", async (req, res) => {
  const id = validarId(req.params.id);
  if (id === null) {
    res.status(400).json(ERRO_ID);
    return;
  }
  await prisma.conta.delete({ where: { id, usuarioId: req.donoId! } });
  res.status(204).send();
});

// POST /contas/:id/pagar -> marca pagaEm e cria a Despesa correspondente na mesma transação
rotasContas.post("/:id/pagar", async (req, res) => {
  const id = validarId(req.params.id);
  if (id === null) {
    res.status(400).json(ERRO_ID);
    return;
  }
  const usuarioId = req.donoId!;
  const resultado = await prisma.$transaction(async banco => {
    const agora = new Date();
    // O filtro pagaEm: null torna a marcação atômica: dois cliques simultâneos não geram duas despesas.
    const { count } = await banco.conta.updateMany({ where: { id, usuarioId, pagaEm: null }, data: { pagaEm: agora } });
    const conta = await banco.conta.findFirst({ where: { id, usuarioId } });
    if (!conta) return { status: 404 as const };
    if (!count) return { status: 409 as const };
    const despesa = await banco.despesa.create({
      data: { descricao: conta.descricao, valor: conta.valor, categoria: conta.categoria, data: new Date(`${agora.toISOString().slice(0, 10)}T00:00:00.000Z`), usuarioId },
    });
    return { status: 200 as const, conta, despesa };
  });
  if (resultado.status === 404) {
    res.status(404).json({ erro: "Conta nao encontrada." });
    return;
  }
  if (resultado.status === 409) {
    res.status(409).json({ erro: "Esta conta ja foi paga." });
    return;
  }
  res.status(200).json({ conta: serializarLancamento(resultado.conta), despesa: serializarLancamento(resultado.despesa) });
});
