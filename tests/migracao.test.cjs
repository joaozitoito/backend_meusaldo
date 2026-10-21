const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
require('dotenv').config({ path: '.env.test', quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Use um banco isolado com sufixo _test.');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url } } });

test('migrações preservam dados monetários e recusam associação automática de registros antigos', async () => {
  const schema = `migracao_${randomUUID().replaceAll('-', '')}`;
  await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const executar = sql => execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'execute', '--stdin', '--schema', 'prisma/schema.prisma'], {
    input: `SET search_path TO "${schema}";\n${sql}`, env: { ...process.env, DATABASE_URL: url }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  try {
    executar(readFileSync('prisma/migrations/202610210001_initial/migration.sql', 'utf8'));
    await prisma.$executeRawUnsafe(`INSERT INTO "${schema}"."Receita" ("descricao","valor","categoria","data") VALUES ('Registro antigo', 1.001, 'Teste', '2026-10-21')`);
    const migracao = readFileSync('prisma/migrations/202610210002_decimal/migration.sql', 'utf8');
    assert.throws(() => executar(migracao), erro => erro.stderr.toString().includes('Valores antigos incompatíveis'));
    const [antes] = await prisma.$queryRawUnsafe(`SELECT "valor", pg_typeof("valor")::text AS tipo FROM "${schema}"."Receita"`);
    assert.equal(antes.valor, 1.001);
    assert.equal(antes.tipo, 'double precision');
    await prisma.$executeRawUnsafe(`UPDATE "${schema}"."Receita" SET "valor"=1.01`);
    executar(migracao);
    // A aplicação também deve reconectar após uma mudança de tipos no schema.
    await prisma.$disconnect();
    const [depois] = await prisma.$queryRawUnsafe(`SELECT "valor", pg_typeof("valor")::text AS tipo FROM "${schema}"."Receita"`);
    assert.equal(depois.valor.toString(), '1.01');
    assert.equal(depois.tipo, 'numeric');
    const autenticacao = readFileSync('prisma/migrations/202610210003_usuarios_sessoes/migration.sql', 'utf8');
    assert.throws(() => executar(autenticacao), erro => erro.stderr.toString().includes('sem proprietário'));
    const [preservado] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS quantidade FROM "${schema}"."Receita" WHERE "valor"=1.01`);
    assert.equal(preservado.quantidade, 1);
    const [tabela] = await prisma.$queryRawUnsafe(`SELECT to_regclass('"${schema}"."Usuario"')::text AS usuarios`);
    assert.equal(tabela.usuarios, null);
    await prisma.$executeRawUnsafe(`DELETE FROM "${schema}"."Receita" WHERE "descricao"='Registro antigo'`);
    executar(autenticacao);
    const [coluna] = await prisma.$queryRaw`SELECT is_nullable FROM information_schema.columns WHERE table_schema=${schema} AND table_name='Receita' AND column_name='usuarioId'`;
    assert.equal(coluna.is_nullable, 'NO');
  } finally {
    await prisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await prisma.$disconnect();
  }
});
