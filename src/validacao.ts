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

  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    campos.valor = "Informe um valor numérico finito.";
  } else if (valor <= 0) {
    campos.valor = "O valor deve ser maior que zero.";
  } else if (valor > 9_999_999_999.99 || !/^\d+(\.\d{1,2})?$/.test(String(valor))) {
    campos.valor = "Use até duas casas decimais e no máximo R$ 9.999.999.999,99.";
  }

  if (typeof categoria !== "string" || categoria.trim() === "") {
    campos.categoria = "A categoria e obrigatoria.";
  } else if (categoria.trim().length > 60) {
    campos.categoria = "A categoria deve ter no máximo 60 caracteres.";
  }

  const dia = typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data) && !data.startsWith("0000-")
    ? new Date(`${data}T00:00:00.000Z`) : new Date(NaN);
  if (Number.isNaN(dia.getTime()) || dia.toISOString().slice(0, 10) !== data) {
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
      data: dia,
    },
  };
}

/** Converte o parametro :id em numero. Retorna null quando invalido. */
export function validarId(param: string): number | null {
  const id = Number(param);
  if (!/^[1-9]\d*$/.test(param) || !Number.isSafeInteger(id) || id > 2_147_483_647) return null;
  return id;
}
