const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { execFileSync } = require('node:child_process');
require('dotenv').config({ path: '.env.test', quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Use TEST_DATABASE_URL de um banco exclusivo com sufixo _test.');
process.env.DATABASE_URL = url;
execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: process.env, stdio: 'pipe' });
const { prisma } = require('../dist/prisma');
const { app } = require('../dist/app');

async function iniciar() {
  const servidor = app.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  return { servidor, base: `http://127.0.0.1:${servidor.address().port}` };
}
async function chamar(base, caminho, { method = 'GET', dados, cookie, csrf = true, headers = {} } = {}) {
  const resposta = await fetch(base + caminho, {
    method, headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-MeuSaldo-Request': '1' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: dados === undefined ? undefined : JSON.stringify(dados),
  });
  const corpo = resposta.status === 204 ? undefined : await resposta.json();
  return { status: resposta.status, dados: corpo, headers: resposta.headers, cookie: resposta.headers.get('set-cookie')?.split(';')[0] };
}
async function criarConta(base, usuarios) {
  const senha = randomBytes(24).toString('base64url');
  const email = `teste-${randomUUID()}@example.test`;
  const registro = await chamar(base, '/auth/registro', { method: 'POST', dados: { nome: 'Pessoa de teste', email, senha } });
  assert.equal(registro.status, 201, 'Cadastro de fixture deve funcionar sem expor credenciais.');
  usuarios.push(registro.dados.usuario.id);
  const login = await chamar(base, '/auth/login', { method: 'POST', dados: { email, senha } });
  assert.equal(login.status, 200);
  assert.ok(login.cookie);
  return { ...registro.dados.usuario, senha, cookie: login.cookie };
}
async function limpar(servidor, usuarios) {
  try {
    await prisma.receita.deleteMany({ where: { usuarioId: { in: usuarios } } });
    await prisma.despesa.deleteMany({ where: { usuarioId: { in: usuarios } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
  } finally {
    await prisma.$disconnect();
    if (servidor) await new Promise(resolve => servidor.close(resolve));
  }
}
module.exports = { iniciar, chamar, criarConta, limpar, prisma };
