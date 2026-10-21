const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { iniciar, chamar: chamarAutenticado, criarConta, limpar, prisma } = require('./suporte-auth.cjs');
let servidor;
let base;
let usuario;
const usuarios = [];
const categoria = `teste-${Date.now()}`;

before(async () => {
  ({ servidor, base } = await iniciar());
  usuario = await criarConta(base, usuarios);
});
after(() => limpar(servidor, usuarios));
async function chamar(caminho, method = 'GET', dados) {
  return chamarAutenticado(base, caminho, { method, dados, cookie: usuario.cookie });
}

for (const tipo of ['receitas', 'despesas']) {
  test(`${tipo}: criar, consultar, filtrar, editar, persistir e excluir`, async () => {
    const corpo = { descricao: 'Teste financeiro', valor: 12.34, categoria, data: '2026-10-21' };
    const totaisAntes = (await chamar('/saldo')).dados;
    const chave = tipo === 'receitas' ? 'totalReceitas' : 'totalDespesas';
    const criado = await chamar(`/${tipo}`, 'POST', corpo);
    assert.equal(criado.status, 201);
    const id = criado.dados.id;
    assert.equal(criado.dados.valor, 12.34);
    assert.equal((await chamar('/saldo')).dados[chave], Number((totaisAntes[chave] + 12.34).toFixed(2)));
    assert.equal((await chamar(`/${tipo}/${id}`)).dados.descricao, corpo.descricao);
    const lista = await chamar(`/${tipo}?categoria=${categoria}`);
    assert.equal(lista.status, 200);
    assert.ok(lista.dados.some(item => item.id === id));
    assert.equal((await chamar(`/${tipo}?categoria=inexistente-${categoria}`)).dados.length, 0);
    assert.equal((await chamar(`/${tipo}/${id}`, 'PUT', { ...corpo, valor: 20.01 })).status, 200);
    const persistido = await prisma[tipo === 'receitas' ? 'receita' : 'despesa'].findUnique({ where: { id } });
    assert.equal(persistido.valor.toString(), '20.01');
    assert.equal((await chamar(`/${tipo}/${id}`)).dados.valor, 20.01);
    assert.equal((await chamar('/saldo')).dados[chave], Number((totaisAntes[chave] + 20.01).toFixed(2)));
    assert.equal((await chamar(`/${tipo}/${id}`, 'DELETE')).status, 204);
    assert.deepEqual((await chamar('/saldo')).dados, totaisAntes);
    for (const metodo of ['GET', 'PUT', 'DELETE']) assert.equal((await chamar(`/${tipo}/${id}`, metodo, metodo === 'PUT' ? corpo : undefined)).status, 404);
  });

  test(`${tipo}: valida campos/ids e não grava dados inválidos`, async () => {
    const antes = await prisma[tipo === 'receitas' ? 'receita' : 'despesa'].count({ where: { usuarioId: usuario.id } });
    const resposta = await chamar(`/${tipo}`, 'POST', { descricao: 'ab', valor: 1.001, categoria: '', data: '2026-02-30' });
    assert.equal(resposta.status, 400);
    assert.deepEqual(Object.keys(resposta.dados.campos).sort(), ['categoria', 'data', 'descricao', 'valor']);
    assert.equal((await chamar(`/${tipo}/abc`)).status, 400);
    assert.equal(await prisma[tipo === 'receitas' ? 'receita' : 'despesa'].count({ where: { usuarioId: usuario.id } }), antes);
  });
}

test('saldo: centavos exatos, alterações, saldo negativo e exclusão dos últimos itens', async () => {
  const inicial = (await chamar('/saldo')).dados;
  const registros = [];
  for (const [tipo, valor] of [['receitas', 0.1], ['receitas', 0.2], ['despesas', 0.4]]) {
    const resposta = await chamar(`/${tipo}`, 'POST', { descricao: 'Centavos', valor, categoria, data: '2026-10-21' });
    assert.equal(resposta.status, 201);
    registros.push([tipo, resposta.dados.id]);
  }
  const saldo = (await chamar('/saldo')).dados;
  assert.equal(saldo.totalReceitas, Number((inicial.totalReceitas + 0.3).toFixed(2)));
  assert.equal(saldo.totalDespesas, Number((inicial.totalDespesas + 0.4).toFixed(2)));
  assert.equal(saldo.saldo, Number((inicial.saldo - 0.1).toFixed(2)));
  for (const [tipo, id] of registros) assert.equal((await chamar(`/${tipo}/${id}`, 'DELETE')).status, 204);
  assert.deepEqual((await chamar('/saldo')).dados, inicial);
});

test('CORS permite frontend e recusa origem desconhecida; JSON inválido retorna 400', async () => {
  for (const origem of ['http://localhost:3000', 'https://invalida.example']) {
    const resposta = await fetch(base + '/receitas', { method: 'OPTIONS', headers: { Origin: origem, 'Access-Control-Request-Method': 'POST' } });
    assert.equal(resposta.headers.get('access-control-allow-origin'), origem.includes('localhost') ? origem : null);
  }
  const resposta = await fetch(base + '/receitas', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-MeuSaldo-Request': '1', Cookie: usuario.cookie }, body: '{' });
  assert.equal(resposta.status, 400);
});
