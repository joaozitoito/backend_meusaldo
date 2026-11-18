BEGIN;

CREATE TABLE "Orcamento" (
  "id" SERIAL NOT NULL,
  "mes" TEXT NOT NULL,
  "categoria" TEXT NOT NULL,
  "limite" DECIMAL(12,2) NOT NULL,
  "usuarioId" INTEGER NOT NULL,
  CONSTRAINT "Orcamento_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Orcamento_limite_positivo" CHECK ("limite" > 0 AND "limite" <> 'NaN'::numeric),
  CONSTRAINT "Orcamento_mes_formato" CHECK ("mes" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
CREATE UNIQUE INDEX "Orcamento_usuarioId_mes_categoria_key" ON "Orcamento"("usuarioId", "mes", "categoria");
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
