const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarCadastro, validarLogin } = require('../dist/auth/validacao');
const { hashSenha, conferirSenha } = require('../dist/auth/senha');

const cadastro = { nome: ' Pessoa Teste ', email: ' Teste@Example.COM ', senha: 'Senha de teste longa 2026!' };
test('cadastro normaliza nome/e-mail e nunca remove espaços da senha', () => {
  const resultado = validarCadastro({ ...cadastro, senha: ' senha com espaços ' });
  assert.equal(resultado.ok, true);
  assert.deepEqual(resultado.dados, { nome: 'Pessoa Teste', email: 'teste@example.com', senha: ' senha com espaços ' });
});
test('cadastro recusa corpo inválido, nome, e-mail e senha fora dos limites', () => {
  for (const corpo of [null, [], {}, { ...cadastro, nome:'a' }, { ...cadastro, nome:'a'.repeat(101) }, { ...cadastro, email:'email-invalido' }, { ...cadastro, senha:'curta' }, { ...cadastro, senha:'a'.repeat(129) }, { ...cadastro, senha:' '.repeat(15) }]) {
    assert.equal(validarCadastro(corpo).ok, false);
  }
});
test('login normaliza e-mail, valida formato e não aceita tipos inesperados', () => {
  assert.deepEqual(validarLogin(cadastro), { ok: true, dados: { email: 'teste@example.com', senha: cadastro.senha } });
  assert.equal(validarLogin({ email:cadastro.email, senha:3 }).ok, false);
  assert.equal(validarLogin({ email:'a@', senha:cadastro.senha }).ok, false);
});
test('Argon2id usa salt individual e verifica senha sem armazenar texto puro', async () => {
  const primeiro = await hashSenha(cadastro.senha);
  const segundo = await hashSenha(cadastro.senha);
  assert.notEqual(primeiro, segundo);
  assert.ok(primeiro.startsWith('$argon2id$'));
  assert.ok(!primeiro.includes(cadastro.senha));
  assert.equal(await conferirSenha(primeiro, cadastro.senha), true);
  assert.equal(await conferirSenha(primeiro, 'Senha diferente 2026!'), false);
});
