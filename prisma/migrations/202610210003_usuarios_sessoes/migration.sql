BEGIN;
LOCK TABLE "Receita", "Despesa" IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Receita") OR EXISTS (SELECT 1 FROM "Despesa") THEN
    RAISE EXCEPTION 'Há registros financeiros sem proprietário. Nenhum dado foi alterado. Planeje uma vinculação autorizada antes de migrar.';
  END IF;
END $$;

CREATE TABLE "Usuario" (
  "id" SERIAL NOT NULL,
  "nome" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "senhaHash" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");
CREATE TABLE "Sessao" (
  "tokenHash" TEXT NOT NULL,
  "usuarioId" INTEGER NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiraEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Sessao_pkey" PRIMARY KEY ("tokenHash")
);
CREATE INDEX "Sessao_usuarioId_expiraEm_idx" ON "Sessao"("usuarioId", "expiraEm");
CREATE INDEX "Sessao_expiraEm_idx" ON "Sessao"("expiraEm");
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Receita" ADD COLUMN "usuarioId" INTEGER NOT NULL;
ALTER TABLE "Despesa" ADD COLUMN "usuarioId" INTEGER NOT NULL;
CREATE INDEX "Receita_usuarioId_data_id_idx" ON "Receita"("usuarioId", "data", "id");
CREATE INDEX "Despesa_usuarioId_data_id_idx" ON "Despesa"("usuarioId", "data", "id");
ALTER TABLE "Receita" ADD CONSTRAINT "Receita_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
COMMIT;
