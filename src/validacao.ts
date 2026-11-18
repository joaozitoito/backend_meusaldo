// Validacoes de entrada usadas pelas rotas de receitas e despesas.

export type Campos = Record<string, string>;

export type Lancamento = {
  descricao: string;
  valor: number;
  categoria: string;
  data: Date;
};

type Resultado =
  | { ok: true; dados: Lancamento }
  | { ok: false; campos: Campos };

/**
 * Valida o corpo enviado em POST e PUT.
 * Retorna os dados ja normalizados ou o mapa de erros por campo.
 */
export function validarLancamento(body: unknown): Resultado {
  const campos: Campos = {};
  const corpo = (typeof body === "object" && body !== null && !Array.isArray(body) ? body : {}) as Record<string, unknown>;

  const descricao = corpo.descricao;
  const valor = corpo.valor;
  const categoria = corpo.categoria;
  const data = corpo.data;

  if (typeof descricao !== "string" || descricao.trim().length < 3) {
    campos.descricao = "A descricao e obrigatoria e deve ter ao menos 3 caracteres.";
  } else if (descricao.trim().length > 100) {
    campos.descricao = "A descricao deve ter no maximo 100 caracteres.";
  }

  const erro = erroValor(valor);
  if (erro) campos.valor = erro;

  if (typeof categoria !== "string" || categoria.trim() === "") {
    campos.categoria = "A categoria e obrigatoria.";
  } else if (categoria.trim().length > 60) {
    campos.categoria = "A categoria deve ter no máximo 60 caracteres.";
  }

  const dia = lerDia(data);
  if (!dia) {
    campos.data = "A data e obrigatoria e deve estar no formato YYYY-MM-DD.";
  }

  if (Object.keys(campos).length > 0) {
    return { ok: false, campos };
  }

  return {
    ok: true,
    dados: {
      descricao: (descricao as string).trim(),
      valor: valor as number,
      categoria: (categoria as string).trim(),
      data: dia as Date,
    },
  };
}

/** Dia civil YYYY-MM-DD em meia-noite UTC. Retorna undefined quando ausente e null quando invalido. */
export function lerDia(valor: unknown): Date | null | undefined {
  if (valor === undefined) return undefined;
  const dia = typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor) && !valor.startsWith("0000-")
    ? new Date(`${valor}T00:00:00.000Z`) : new Date(NaN);
  return Number.isNaN(dia.getTime()) || dia.toISOString().slice(0, 10) !== valor ? null : dia;
}

/** Mesmas regras de validarLancamento, com "vencimento" no lugar de "data". */
export function validarConta(body: unknown): { ok: true; dados: Omit<Lancamento, "data"> & { vencimento: Date } } | { ok: false; campos: Campos } {
  const corpo = typeof body === "object" && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const resultado = validarLancamento({ ...corpo, data: corpo.vencimento });
  if (!resultado.ok) {
    const { data, ...campos } = resultado.campos;
    return { ok: false, campos: data ? { ...campos, vencimento: "O vencimento e obrigatorio e deve estar no formato YYYY-MM-DD." } : campos };
  }
  const { data, ...dados } = resultado.dados;
  return { ok: true, dados: { ...dados, vencimento: data } };
}

export const ERRO_MES = { erro: "Dados invalidos.", campos: { mes: "Use o mes no formato YYYY-MM." } };

/**
 * Converte ?mes=YYYY-MM no intervalo UTC [gte, lt).
 * Retorna undefined quando ausente e null quando invalido.
 */
export function lerMes(valor: unknown): { gte: Date; lt: Date } | null | undefined {
  if (valor === undefined) return undefined;
  if (typeof valor !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(valor) || valor.startsWith("0000-")) return null;
  const gte = new Date(`${valor}-01T00:00:00.000Z`);
  const lt = new Date(gte);
  lt.setUTCMonth(lt.getUTCMonth() + 1);
  return { gte, lt };
}

/** Converte o parametro :id em numero. Retorna null quando invalido. */
export function validarId(param: string): number | null {
  const id = Number(param);
  if (!/^[1-9]\d*$/.test(param) || !Number.isSafeInteger(id) || id > 2_147_483_647) return null;
  return id;
}

/** Valor monetario positivo com ate 2 casas. Retorna a mensagem de erro ou undefined. */
function erroValor(valor: unknown): string | undefined {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return "Informe um valor numérico finito.";
  if (valor <= 0) return "O valor deve ser maior que zero.";
  if (valor > 9_999_999_999.99 || !/^\d+(\.\d{1,2})?$/.test(String(valor))) return "Use até duas casas decimais e no máximo R$ 9.999.999.999,99.";
}

export type Orcamento = { categoria: string; limite: number };

/**
 * Valida o corpo de PUT /orcamentos: { categorias: [{ categoria, limite }] }.
 * A lista substitui os limites do mes; erros vem como "categorias.N.campo".
 */
export function validarOrcamentos(body: unknown): { ok: true; dados: Orcamento[] } | { ok: false; campos: Campos } {
  const lista = typeof body === "object" && body !== null ? (body as Record<string, unknown>).categorias : undefined;
  if (!Array.isArray(lista) || lista.length > 50) return { ok: false, campos: { categorias: "Envie uma lista com no maximo 50 categorias." } };
  const campos: Campos = {};
  const vistas = new Set<string>();
  const dados = lista.map((item, indice) => {
    const { categoria, limite } = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
    const nome = typeof categoria === "string" ? categoria.trim() : "";
    if (!nome || nome.length > 60) campos[`categorias.${indice}.categoria`] = "A categoria e obrigatoria e deve ter no maximo 60 caracteres.";
    else if (vistas.has(nome.toLowerCase())) campos[`categorias.${indice}.categoria`] = "Categoria repetida.";
    vistas.add(nome.toLowerCase());
    const erro = erroValor(limite);
    if (erro) campos[`categorias.${indice}.limite`] = erro;
    return { categoria: nome, limite: limite as number };
  });
  return Object.keys(campos).length ? { ok: false, campos } : { ok: true, dados };
}
