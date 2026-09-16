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
  const corpo = (body ?? {}) as Record<string, unknown>;

  const descricao = corpo.descricao;
  const valor = corpo.valor;
  const categoria = corpo.categoria;
  const data = corpo.data;

  if (typeof descricao !== "string" || descricao.trim().length < 3) {
    campos.descricao = "A descricao e obrigatoria e deve ter ao menos 3 caracteres.";
  } else if (descricao.trim().length > 100) {
    campos.descricao = "A descricao deve ter no maximo 100 caracteres.";
  }

  if (typeof valor !== "number" || Number.isNaN(valor)) {
    campos.valor = "O valor e obrigatorio e deve ser um numero.";
  } else if (valor <= 0) {
    campos.valor = "O valor deve ser maior que zero.";
  }

  if (typeof categoria !== "string" || categoria.trim() === "") {
    campos.categoria = "A categoria e obrigatoria.";
  }

  if (typeof data !== "string" || Number.isNaN(Date.parse(data))) {
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
      data: new Date(data as string),
    },
  };
}

/** Converte o parametro :id em numero. Retorna null quando invalido. */
export function validarId(param: string): number | null {
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}
