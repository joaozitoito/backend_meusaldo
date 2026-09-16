import "dotenv/config";
import { app } from "./app";
import { popularBanco } from "./seed";

const PORTA = Number(process.env.PORT ?? 3001);

async function iniciar() {
  await popularBanco();

  app.listen(PORTA, () => {
    console.log(`API rodando em http://localhost:${PORTA}`);
  });
}

iniciar().catch((erro) => {
  console.error("Falha ao iniciar a API:", erro);
  process.exit(1);
});
