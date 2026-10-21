import "dotenv/config";
import { popularBanco } from "./seed";
import { prisma } from "./prisma";

async function executarSeed() {
  const email = process.env.SEED_USUARIO_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("Informe SEED_USUARIO_EMAIL de uma conta já cadastrada.");
  const usuario = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
  if (!usuario) throw new Error("A conta indicada para o seed não existe.");
  await popularBanco(usuario.id);
}

executarSeed().catch(() => {
  console.error("Não foi possível executar o seed. Confira o banco de desenvolvimento.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
