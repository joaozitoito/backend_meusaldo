import { Prisma } from "@prisma/client";

/** Mantém o contrato JSON numérico existente; no banco o valor permanece Decimal. */
export function serializarLancamento<T extends { valor: Prisma.Decimal }>(registro: T) {
  return { ...registro, valor: registro.valor.toNumber() };
}
