import express from "express";
import cors from "cors";
import { delayGet } from "./middlewares/delay";
import { rotaNaoEncontrada, tratarErro } from "./middlewares/erros";
import { rotasReceitas } from "./rotas/receitas";
import { rotasDespesas } from "./rotas/despesas";
import { rotasSaldo } from "./rotas/saldo";
import { rotasAuth } from "./rotas/auth";
import { exigirSessao } from "./auth/sessao";
import { protegerCsrf } from "./auth/csrf";

export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", false);

// Apenas as origens explícitas do frontend podem acessar a API pelo navegador.
const origensFrontend = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((origem) => origem.trim())
  .filter(Boolean);
if (!origensFrontend.length || origensFrontend.some(origem => {
  try { const url = new URL(origem); return !["http:", "https:"].includes(url.protocol) || url.origin !== origem; } catch { return true; }
}) || (process.env.NODE_ENV === "production" && !process.env.CORS_ORIGINS)) throw new Error("Configure CORS_ORIGINS com origens HTTP(S) explícitas, sem curinga.");
app.use(cors({ origin: origensFrontend, credentials: true, allowedHeaders: ["Content-Type", "X-MeuSaldo-Request"], methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] }));
app.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
app.use(["/receitas", "/despesas", "/saldo"], exigirSessao);
app.use(protegerCsrf(origensFrontend));
app.use(express.json({ limit: "16kb" }));

// Atraso de 400ms apenas nos GET.
app.use(delayGet);
app.use("/auth", rotasAuth);

app.use("/receitas", rotasReceitas);
app.use("/despesas", rotasDespesas);
app.use("/saldo", rotasSaldo);

app.use(rotaNaoEncontrada);
app.use(tratarErro);
