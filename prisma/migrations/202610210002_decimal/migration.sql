BEGIN;
LOCK TABLE "Receita", "Despesa" IN ACCESS EXCLUSIVE MODE;

-- Recusar conversões com perda de dados; não arredondar registros antigos em silêncio.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (SELECT "valor" FROM "Receita" UNION ALL SELECT "valor" FROM "Despesa") AS valores
    WHERE "valor"::text IN ('NaN', 'Infinity', '-Infinity')
       OR "valor" <= 0 OR "valor" > 9999999999.99
       OR "valor"::text::numeric <> round("valor"::text::numeric, 2)
  ) THEN
    RAISE EXCEPTION 'Valores antigos incompatíveis com centavos. Revise os registros antes de migrar; nenhum valor foi alterado.';
  END IF;
END $$;

ALTER TABLE "Receita" ALTER COLUMN "valor" TYPE DECIMAL(12,2) USING "valor"::text::numeric;
ALTER TABLE "Despesa" ALTER COLUMN "valor" TYPE DECIMAL(12,2) USING "valor"::text::numeric;
ALTER TABLE "Receita" ADD CONSTRAINT "Receita_valor_positivo" CHECK ("valor" > 0 AND "valor" <> 'NaN'::numeric);
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_valor_positivo" CHECK ("valor" > 0 AND "valor" <> 'NaN'::numeric);

COMMIT;
