import type { RequestHandler, Response } from "express";

export type EventoTempoReal = {
  tipo: "dados" | "conjunta";
  recurso?: string;
  autor: { id: number; nome: string };
};
type Cliente = { res: Response; usuarioId: number; sessaoHash: string };

// shortcut: assinantes em memória, válido só com uma instância da API; com várias, trocar por Postgres LISTEN/NOTIFY.
const porDono = new Map<number, Set<Cliente>>();
const PING_MS = 25_000;

/** GET /eventos: Server-Sent Events com as alterações dos dados do dono da sessão. */
export const conectarEventos: RequestHandler = (req, res) => {
  const donoId = req.donoId!;
  const cliente: Cliente = { res, usuarioId: req.usuario!.id, sessaoHash: req.sessaoHash! };
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.write("retry: 3000\n\n");

  const grupo = porDono.get(donoId) ?? new Set<Cliente>();
  grupo.add(cliente);
  porDono.set(donoId, grupo);

  const ping = setInterval(() => res.write(": ping\n\n"), PING_MS);
  // O stream não pode sobreviver à sessão que o abriu.
  const expira = setTimeout(() => res.end(), Math.max(0, req.sessaoExpiraEm!.getTime() - Date.now()));
  res.on("close", () => {
    clearInterval(ping);
    clearTimeout(expira);
    grupo.delete(cliente);
    if (!grupo.size && porDono.get(donoId) === grupo) porDono.delete(donoId);
  });
};

export function emitir(donoId: number, evento: EventoTempoReal) {
  const linha = `data: ${JSON.stringify(evento)}\n\n`;
  for (const cliente of porDono.get(donoId) ?? []) cliente.res.write(linha);
}

/** Fecha streams; o navegador reconecta e passa a ouvir o dono atual. */
export function encerrarEventos(deveEncerrar: (cliente: { usuarioId: number; sessaoHash: string }) => boolean) {
  for (const grupo of porDono.values()) {
    for (const cliente of grupo) if (deveEncerrar(cliente)) cliente.res.end();
  }
}

/** Depois de uma alteração bem-sucedida, avisa todos que veem os mesmos dados. */
export const avisarAlteracao: RequestHandler = (req, res, next) => {
  if (req.method !== "GET") {
    res.on("finish", () => {
      if (res.statusCode < 400) emitir(req.donoId!, { tipo: "dados", recurso: req.baseUrl.slice(1), autor: { id: req.usuario!.id, nome: req.usuario!.nome } });
    });
  }
  next();
};
