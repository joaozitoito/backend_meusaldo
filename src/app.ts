import express from "express";
import cors from "cors";
import { delayGet } from "./middlewares/delay";
import { rotaNaoEncontrada, tratarErro } from "./middlewares/erros";
import { rotasReceitas } from "./rotas/receitas";
import { rotasDespesas } from "./rotas/despesas";
import { rotasSaldo } from "./rotas/saldo";

export const app = express();

// Libera o frontend rodando no Vite.
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// Atraso de 400ms apenas nos GET.
app.use(delayGet);

app.use("/receitas", rotasReceitas);
app.use("/despesas", rotasDespesas);
app.use("/saldo", rotasSaldo);

app.use(rotaNaoEncontrada);
app.use(tratarErro);
