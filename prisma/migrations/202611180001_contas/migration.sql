BEGIN;

CREATE TABLE "Conta" (
  "id" SERIAL NOT NULL,
  "descricao" TEXT NOT NULL,
  "valor" DECIMAL(12,2) NOT NULL,
  "categoria" TEXT NOT NULL,
  "vencimento" TIMESTAMP(3) NOT NULL,
  "pagaEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usuarioId" INTEGER NOT NULL,
  CONSTRAINT "Conta_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Conta_valor_positivo" CHECK ("valor" > 0 AND "valor" <> 'NaN'::numeric)
);
CREATE INDEX "Conta_usuarioId_vencimento_id_idx" ON "Conta"("usuarioId", "vencimento", "id");
ALTER TABLE "Conta" ADD CONSTRAINT "Conta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
