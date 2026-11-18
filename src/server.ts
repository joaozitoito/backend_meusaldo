import "dotenv/config";
import { app } from "./app";
import { prisma } from "./prisma";

const PORTA = Number(process.env.PORT ?? 3001);

async function iniciar() {
  await prisma.$connect();

  // Local fica em 127.0.0.1; no container o Dockerfile define HOST=0.0.0.0.
  app.listen(PORTA, process.env.HOST ?? "127.0.0.1", () => {
    console.log(`API rodando em http://localhost:${PORTA}`);
  });
}

iniciar().catch(async () => {
  console.error("Falha ao iniciar a API. Verifique a conexão PostgreSQL e as variáveis de ambiente.");
  await prisma.$disconnect();
  process.exit(1);
});
