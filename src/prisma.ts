import { PrismaClient } from "@prisma/client";

// Instancia unica do Prisma reutilizada por toda a aplicacao.
export const prisma = new PrismaClient();
