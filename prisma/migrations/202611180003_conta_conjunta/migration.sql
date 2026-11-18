-- Conta conjunta: o membro passa a operar sobre os dados do titular.
ALTER TABLE "Usuario" ADD COLUMN "titularId" INTEGER,
ADD COLUMN "conviteHash" TEXT,
ADD COLUMN "conviteExpiraEm" TIMESTAMP(3),
ADD CONSTRAINT "Usuario_titular_diferente" CHECK ("titularId" IS NULL OR "titularId" <> "id");

CREATE UNIQUE INDEX "Usuario_conviteHash_key" ON "Usuario"("conviteHash");

CREATE INDEX "Usuario_titularId_idx" ON "Usuario"("titularId");

ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_titularId_fkey" FOREIGN KEY ("titularId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
