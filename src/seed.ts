import { prisma } from "./prisma";

const receitas = [
  { descricao: "Salario de setembro", valor: 4200.0, categoria: "Salario", data: "2026-09-05" },
  { descricao: "Freelance site institucional", valor: 1500.0, categoria: "Freelance", data: "2026-09-08" },
  { descricao: "Venda de notebook usado", valor: 1800.0, categoria: "Vendas", data: "2026-08-22" },
  { descricao: "Rendimento da poupanca", valor: 62.35, categoria: "Investimentos", data: "2026-09-01" },
  { descricao: "Aulas particulares de logica", valor: 320.0, categoria: "Freelance", data: "2026-08-30" },
  { descricao: "Bolsa de iniciacao cientifica", valor: 700.0, categoria: "Bolsa", data: "2026-09-10" },
  { descricao: "Reembolso de passagem", valor: 145.9, categoria: "Reembolso", data: "2026-08-18" },
  { descricao: "Venda de bicicleta", valor: 550.0, categoria: "Vendas", data: "2026-09-12" },
];

const despesas = [
  { descricao: "Aluguel", valor: 1350.0, categoria: "Moradia", data: "2026-09-05" },
  { descricao: "Mercado do mes", valor: 780.45, categoria: "Alimentacao", data: "2026-09-06" },
  { descricao: "Conta de luz", valor: 168.9, categoria: "Moradia", data: "2026-09-09" },
  { descricao: "Internet fibra", valor: 99.9, categoria: "Moradia", data: "2026-09-09" },
  { descricao: "Passe de onibus", valor: 210.0, categoria: "Transporte", data: "2026-09-02" },
  { descricao: "Assinatura de streaming", valor: 39.9, categoria: "Lazer", data: "2026-08-28" },
  { descricao: "Material da faculdade", valor: 125.0, categoria: "Educacao", data: "2026-08-25" },
  { descricao: "Farmacia", valor: 87.6, categoria: "Saude", data: "2026-09-11" },
];

/**
 * Popula o banco somente pelo comando explicito de demonstracao.
 * So insere se as tabelas estiverem vazias, para nao duplicar a cada restart.
 */
export async function popularBanco(usuarioId: number) {
  const totalReceitas = await prisma.receita.count({ where: { usuarioId } });
  const totalDespesas = await prisma.despesa.count({ where: { usuarioId } });

  if (totalReceitas === 0) {
    await prisma.receita.createMany({
      data: receitas.map((r) => ({ ...r, usuarioId, data: new Date(r.data) })),
    });
    console.log(`Seed: ${receitas.length} receitas inseridas.`);
  }

  if (totalDespesas === 0) {
    await prisma.despesa.createMany({
      data: despesas.map((d) => ({ ...d, usuarioId, data: new Date(d.data) })),
    });
    console.log(`Seed: ${despesas.length} despesas inseridas.`);
  }

  if (totalReceitas > 0 && totalDespesas > 0) {
    console.log("Seed: banco ja possui dados, nada foi inserido.");
  }
}
