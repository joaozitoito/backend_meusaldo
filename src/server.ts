import "dotenv/config";
import { app } from "./app";
import { prisma } from "./prisma";

const PORTA = Number(process.env.PORT ?? 3001);

async function iniciar() {
  await prisma.$connect();

  app.listen(PORTA, "127.0.0.1", () => {
    console.log(`API rodando em http://localhost:${PORTA}`);
  });
}

iniciar().catch(async () => {
  console.error("Falha ao iniciar a API. Verifique a conexão PostgreSQL e as variáveis de ambiente.");
  await prisma.$disconnect();
  process.exit(1);
});
