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

test('saldo e listagens por mês e histórico mensal acumulado', async () => {
  const conta = await criarConta(base, usuarios);
  const chamarConta = (caminho, method = 'GET', dados) => chamarAutenticado(base, caminho, { method, dados, cookie: conta.cookie });
  for (const [tipo, valor, data] of [['receitas', 100.1, '2026-10-31'], ['despesas', 0.1, '2026-11-01'], ['receitas', 50, '2026-11-30'], ['despesas', 20, '2026-12-01']]) {
    assert.equal((await chamarConta(`/${tipo}`, 'POST', { descricao: 'Por mes', valor, categoria, data })).status, 201);
  }
  assert.deepEqual((await chamarConta('/saldo?mes=2026-11')).dados, { totalReceitas: 50, totalDespesas: 0.1, saldo: 49.9 });
  assert.deepEqual((await chamarConta('/despesas?mes=2026-11')).dados.map(item => item.valor), [0.1]);
  assert.equal((await chamarConta('/receitas?mes=2026-11')).dados.length, 1);
  assert.equal((await chamarConta('/saldo?mes=2026-13')).status, 400);
  assert.equal((await chamarConta('/receitas?mes=nov')).dados.campos.mes !== undefined, true);
  const mensal = await chamarConta('/saldo/mensal?meses=2&ate=2026-11');
  assert.deepEqual(mensal.dados, [
    { mes: '2026-10', receitas: 100.1, despesas: 0, saldo: 100.1, saldoAcumulado: 100.1 },
    { mes: '2026-11', receitas: 50, despesas: 0.1, saldo: 49.9, saldoAcumulado: 150 },
  ]);
  assert.equal((await chamarConta('/saldo/mensal?meses=1&ate=2026-12')).dados[0].saldoAcumulado, 130);
  for (const consulta of ['meses=0', 'meses=25', 'meses=1.5', 'ate=2026-13']) assert.equal((await chamarConta(`/saldo/mensal?${consulta}`)).status, 400, consulta);
});

test('CORS permite frontend e recusa origem desconhecida; JSON inválido retorna 400', async () => {
  for (const origem of ['http://localhost:3000', 'https://invalida.example']) {
    const resposta = await fetch(base + '/receitas', { method: 'OPTIONS', headers: { Origin: origem, 'Access-Control-Request-Method': 'POST' } });
    assert.equal(resposta.headers.get('access-control-allow-origin'), origem.includes('localhost') ? origem : null);
  }
  const resposta = await fetch(base + '/receitas', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-MeuSaldo-Request': '1', Cookie: usuario.cookie }, body: '{' });
  assert.equal(resposta.status, 400);
});

test('contas: CRUD, filtros por status/mês/até, pagar cria despesa e pagar de novo é 409', async () => {
  const conta = await criarConta(base, usuarios);
  const outra = await criarConta(base, usuarios);
  const pedir = (cookie, caminho, method = 'GET', dados) => chamarAutenticado(base, caminho, { method, dados, cookie });
  const de = (caminho, method, dados) => pedir(conta.cookie, caminho, method, dados);
  const ids = {};
  for (const [nome, valor, vencimento] of [['Aluguel', 1700, '2026-12-05'], ['Internet', 99.9, '2026-12-15'], ['Seguro', 300, '2027-01-10']]) {
    const criada = await de('/contas', 'POST', { descricao: nome, valor, categoria: 'Moradia', vencimento, usuarioId: outra.id });
    assert.equal(criada.status, 201);
    assert.equal(criada.dados.pagaEm, null);
    assert.equal(criada.dados.valor, valor);
    ids[nome] = criada.dados.id;
  }
  const invalida = await de('/contas', 'POST', { descricao: 'ab', valor: 1, categoria: 'X', vencimento: '2026-02-30' });
  assert.equal(invalida.status, 400);
  assert.ok(invalida.dados.campos.vencimento);
  assert.deepEqual((await de('/contas')).dados.map(item => item.descricao), ['Aluguel', 'Internet', 'Seguro']);
  assert.deepEqual((await de('/contas?mes=2026-12')).dados.map(item => item.descricao), ['Aluguel', 'Internet']);
  assert.deepEqual((await de('/contas?ate=2026-12-05')).dados.map(item => item.descricao), ['Aluguel']);
  for (const consulta of ['status=todas', 'mes=2026-13', 'ate=2026-02-30']) assert.equal((await de(`/contas?${consulta}`)).status, 400, consulta);

  assert.equal((await de(`/contas/${ids.Internet}`, 'PUT', { descricao: 'Internet fibra', valor: 120, categoria: 'Moradia', vencimento: '2026-12-16' })).dados.valor, 120);
  assert.equal((await de(`/contas/${ids.Internet}`)).dados.descricao, 'Internet fibra');

  const despesasAntes = (await de('/despesas')).dados.length;
  const paga = await de(`/contas/${ids.Aluguel}/pagar`, 'POST');
  assert.equal(paga.status, 200);
  assert.ok(paga.dados.conta.pagaEm);
  assert.deepEqual(
    { descricao: paga.dados.despesa.descricao, valor: paga.dados.despesa.valor, categoria: paga.dados.despesa.categoria, data: paga.dados.despesa.data.slice(0, 10) },
    { descricao: 'Aluguel', valor: 1700, categoria: 'Moradia', data: paga.dados.conta.pagaEm.slice(0, 10) },
  );
  assert.equal((await de(`/contas/${ids.Aluguel}/pagar`, 'POST')).status, 409);
  assert.equal((await de('/despesas')).dados.length, despesasAntes + 1);
  assert.deepEqual((await de('/contas?status=paga')).dados.map(item => item.id), [ids.Aluguel]);
  assert.deepEqual((await de('/contas?status=aberta&mes=2026-12')).dados.map(item => item.id), [ids.Internet]);

  // Isolamento: a outra pessoa não vê, não altera, não paga e não exclui; usuarioId forjado foi ignorado.
  assert.deepEqual((await pedir(outra.cookie, '/contas')).dados, []);
  for (const [method, caminho, dados] of [['GET', `/contas/${ids.Seguro}`], ['PUT', `/contas/${ids.Seguro}`, { descricao: 'Invasão', valor: 1, categoria: 'X', vencimento: '2026-12-01' }], ['POST', `/contas/${ids.Seguro}/pagar`], ['DELETE', `/contas/${ids.Seguro}`]]) {
    assert.equal((await pedir(outra.cookie, caminho, method, dados)).status, 404, `${method} ${caminho}`);
  }
  assert.equal((await pedir(outra.cookie, '/despesas')).dados.length, 0);
  assert.equal((await de('/contas/999999999/pagar', 'POST')).status, 404);
  assert.equal((await de('/contas/abc/pagar', 'POST')).status, 400);

  assert.equal((await de(`/contas/${ids.Seguro}`, 'DELETE')).status, 204);
  assert.equal((await de(`/contas/${ids.Seguro}`)).status, 404);
});
