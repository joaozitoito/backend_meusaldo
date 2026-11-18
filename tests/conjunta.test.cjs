const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { iniciar, chamar, criarConta, limpar } = require('./suporte-auth.cjs');
const { normalizarCodigo, gerarCodigo } = require('../dist/rotas/conjunta');
let servidor;
let base;
const usuarios = [];
const receita = { descricao: 'Mercado conjunto', valor: 10, categoria: 'teste-conjunta', data: '2026-11-18' };

before(async () => { ({ servidor, base } = await iniciar()); });
after(() => limpar(servidor, usuarios));

async function convidar(dono) {
  const convite = await chamar(base, '/conjunta/convite', { method: 'POST', cookie: dono.cookie });
  assert.equal(convite.status, 201);
  return convite.dados.codigo;
}

/** Abre /eventos e devolve o próximo evento recebido (ou null se o stream fechar antes). */
async function proximoEvento(cookie) {
  const controle = new AbortController();
  const resposta = await fetch(base + '/eventos', { headers: { Cookie: cookie }, signal: controle.signal });
  assert.equal(resposta.status, 200);
  assert.match(resposta.headers.get('content-type'), /text\/event-stream/);
  const leitor = resposta.body.getReader();
  const texto = new TextDecoder();
  let buffer = '';
  return {
    async ler() {
      for (;;) {
        const linha = buffer.split('\n\n').find(bloco => bloco.startsWith('data: '));
        if (linha) { buffer = buffer.slice(buffer.indexOf(linha) + linha.length + 2); return JSON.parse(linha.slice(6)); }
        const { value, done } = await leitor.read();
        if (done) return null;
        buffer += texto.decode(value, { stream: true });
      }
    },
    fechar() { controle.abort(); },
  };
}

test('código: gera 10 caracteres sem ambíguos e normaliza o que a pessoa digita', () => {
  const codigo = gerarCodigo();
  assert.match(codigo, /^[A-HJ-NP-Z2-9]{10}$/);
  assert.equal(normalizarCodigo(` ${codigo.slice(0, 5).toLowerCase()}-${codigo.slice(5)} `), codigo);
  for (const invalido of [undefined, 42, '', 'ABCDE', 'ABCDEFGHI0', 'ABCDEFGHIJK']) assert.equal(normalizarCodigo(invalido), null);
});

test('membro vê e altera os dados do titular; ao sair volta aos próprios dados', async () => {
  const titular = await criarConta(base, usuarios);
  const membro = await criarConta(base, usuarios);
  const doTitular = await chamar(base, '/receitas', { method: 'POST', dados: receita, cookie: titular.cookie });
  const doMembro = await chamar(base, '/receitas', { method: 'POST', dados: { ...receita, descricao: 'Pessoal do membro' }, cookie: membro.cookie });

  assert.equal((await chamar(base, '/conjunta', { cookie: membro.cookie })).dados.papel, 'individual');
  const codigo = await convidar(titular);
  const entrada = await chamar(base, '/conjunta/entrar', { method: 'POST', dados: { codigo }, cookie: membro.cookie });
  assert.equal(entrada.status, 200);
  assert.deepEqual([entrada.dados.papel, entrada.dados.parceiro.id], ['membro', titular.id]);
  assert.equal((await chamar(base, '/conjunta', { cookie: titular.cookie })).dados.papel, 'titular');

  // O membro opera sobre os dados do titular, e os próprios ficam fora de alcance.
  assert.equal((await chamar(base, `/receitas/${doTitular.dados.id}`, { cookie: membro.cookie })).status, 200);
  assert.equal((await chamar(base, `/receitas/${doMembro.dados.id}`, { cookie: membro.cookie })).status, 404);
  const criada = await chamar(base, '/receitas', { method: 'POST', dados: { ...receita, descricao: 'Criada pelo membro' }, cookie: membro.cookie });
  assert.equal(criada.dados.usuarioId, titular.id);
  assert.equal((await chamar(base, `/receitas/${criada.dados.id}`, { cookie: titular.cookie })).status, 200);

  // Código é de uso único.
  const terceiro = await criarConta(base, usuarios);
  assert.equal((await chamar(base, '/conjunta/entrar', { method: 'POST', dados: { codigo }, cookie: terceiro.cookie })).status, 404);

  assert.equal((await chamar(base, '/conjunta/sair', { method: 'POST', cookie: membro.cookie })).status, 204);
  assert.equal((await chamar(base, `/receitas/${doTitular.dados.id}`, { cookie: membro.cookie })).status, 404);
  assert.equal((await chamar(base, `/receitas/${doMembro.dados.id}`, { cookie: membro.cookie })).status, 200);
  assert.equal((await chamar(base, `/receitas/${criada.dados.id}`, { cookie: titular.cookie })).status, 200);
});

test('regras do convite: próprio código, conta já vinculada, código errado e CSRF', async () => {
  const titular = await criarConta(base, usuarios);
  const membro = await criarConta(base, usuarios);
  const outro = await criarConta(base, usuarios);
  const codigo = await convidar(titular);
  assert.equal((await chamar(base, '/conjunta/entrar', { method: 'POST', dados: { codigo }, cookie: titular.cookie })).status, 400);
  assert.equal((await chamar(base, '/conjunta/entrar', { method: 'POST', dados: { codigo: 'ABC' }, cookie: membro.cookie })).status, 400);
  assert.equal((await chamar(base, '/conjunta/entrar', { method: 'POST', dados: { codigo }, cookie: membro.cookie, csrf: false })).status, 403);
  assert.equal((await chamar(base, '/conjunta/entrar', { method: 'POST', dados: { codigo }, cookie: membro.cookie })).status, 200);

  // Ninguém vinculado gera convite nem entra em outra conta: o máximo são duas pessoas.
  assert.equal((await chamar(base, '/conjunta/convite', { method: 'POST', cookie: titular.cookie })).status, 409);
  assert.equal((await chamar(base, '/conjunta/convite', { method: 'POST', cookie: membro.cookie })).status, 409);
  const codigoOutro = await convidar(outro);
  assert.equal((await chamar(base, '/conjunta/entrar', { method: 'POST', dados: { codigo: codigoOutro }, cookie: titular.cookie })).status, 409);
  assert.equal((await chamar(base, '/conjunta/entrar', { method: 'POST', dados: { codigo: codigoOutro }, cookie: membro.cookie })).status, 409);

  // O titular também pode encerrar; depois disso, quem estava sozinho não tem o que sair.
  assert.equal((await chamar(base, '/conjunta/sair', { method: 'POST', cookie: titular.cookie })).status, 204);
  assert.equal((await chamar(base, '/conjunta', { cookie: membro.cookie })).dados.papel, 'individual');
  assert.equal((await chamar(base, '/conjunta/sair', { method: 'POST', cookie: membro.cookie })).status, 409);
});

test('tempo real: a outra pessoa recebe o evento com o autor; quem está fora não recebe', async () => {
  const titular = await criarConta(base, usuarios);
  const membro = await criarConta(base, usuarios);
  const estranho = await criarConta(base, usuarios);
  const codigo = await convidar(titular);
  await chamar(base, '/conjunta/entrar', { method: 'POST', dados: { codigo }, cookie: membro.cookie });

  assert.equal((await fetch(base + '/eventos')).status, 401);
  const doTitular = await proximoEvento(titular.cookie);
  const doEstranho = await proximoEvento(estranho.cookie);
  try {
    await chamar(base, '/despesas', { method: 'POST', dados: receita, cookie: membro.cookie });
    assert.deepEqual(await doTitular.ler(), { tipo: 'dados', recurso: 'despesas', autor: { id: membro.id, nome: membro.nome } });
    // Uma alteração do estranho chega primeiro ao stream dele: prova que a do membro não chegou.
    await chamar(base, '/receitas', { method: 'POST', dados: receita, cookie: estranho.cookie });
    assert.equal((await doEstranho.ler()).autor.id, estranho.id);

    // Encerrar a conta conjunta avisa e fecha o stream para reconectar no dono novo.
    await chamar(base, '/conjunta/sair', { method: 'POST', cookie: membro.cookie });
    assert.equal((await doTitular.ler()).tipo, 'conjunta');
    assert.equal(await doTitular.ler(), null);
  } finally {
    doTitular.fechar();
    doEstranho.fechar();
  }
});
