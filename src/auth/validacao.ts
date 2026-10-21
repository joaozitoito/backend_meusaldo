type Credenciais = { email: string; senha: string };
type Cadastro = Credenciais & { nome: string };
type Resultado<T> = { ok: true; dados: T } | { ok: false; campos: Record<string, string> };

function objeto(body: unknown): Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : {};
}

export function validarLogin(body: unknown): Resultado<Credenciais> {
  const corpo = objeto(body);
  const campos: Record<string, string> = {};
  const email = typeof corpo.email === "string" ? corpo.email.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) campos.email = "Informe um e-mail válido.";
  if (typeof corpo.senha !== "string" || !corpo.senha.length || Array.from(corpo.senha).length > 128) campos.senha = "Informe sua senha (até 128 caracteres).";
  return Object.keys(campos).length ? { ok: false, campos } : { ok: true, dados: { email, senha: corpo.senha as string } };
}

export function validarCadastro(body: unknown): Resultado<Cadastro> {
  const corpo = objeto(body);
  const login = validarLogin(body);
  const campos: Record<string, string> = login.ok ? {} : { ...login.campos };
  const nome = typeof corpo.nome === "string" ? corpo.nome.trim() : "";
  if (nome.length < 2 || nome.length > 100) campos.nome = "Use de 2 a 100 caracteres no nome.";
  if (typeof corpo.senha !== "string" || !corpo.senha.trim() || Array.from(corpo.senha).length < 12 || Array.from(corpo.senha).length > 128) {
    campos.senha = "Use uma senha de 12 a 128 caracteres.";
  }
  if (Object.keys(campos).length || !login.ok) return { ok: false, campos };
  return { ok: true, dados: { nome, ...login.dados } };
}
