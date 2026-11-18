const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarLancamento, validarId, lerMes, lerDia, validarConta } = require('../dist/validacao');

const valido = { descricao: 'Pagamento', valor: 1.1, categoria: 'Trabalho', data: '2026-10-21' };

test('normaliza texto e mantém centavos e dia civil UTC', () => {
  const resultado = validarLancamento({ ...valido, descricao: ' Pagamento ' });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.dados.descricao, 'Pagamento');
  assert.equal(resultado.dados.valor, 1.1);
  assert.equal(resultado.dados.data.toISOString(), '2026-10-21T00:00:00.000Z');
});

test('rejeita dinheiro não finito, negativo, sem valor, além do limite ou com fração de centavo', () => {
  for (const valor of [Infinity, -Infinity, NaN, 0, -1, 1.001, 10_000_000_000, '1.00']) {
    const resultado = validarLancamento({ ...valido, valor });
    assert.equal(resultado.ok, false, `valor ${valor}`);
    assert.ok(resultado.campos.valor);
  }
  assert.equal(validarLancamento({ ...valido, valor: 9_999_999_999.99 }).ok, true);
});

test('rejeita datas inexistentes e formatos diferentes de YYYY-MM-DD', () => {
  for (const data of ['2026-02-30', '2026-02-29', '2026-13-01', '21/10/2026', '2026-10-21T00:00:00Z', '0000-01-01']) {
    const resultado = validarLancamento({ ...valido, data });
    assert.equal(resultado.ok, false, data);
    assert.ok(resultado.campos.data);
  }
  assert.equal(validarLancamento({ ...valido, data: '2024-02-29' }).ok, true);
});

test('rejeita corpo inválido, descrição curta/longa e categoria vazia/longa', () => {
  for (const body of [null, [], 'texto', {}, { ...valido, descricao: 'ab' }, { ...valido, descricao: 'a'.repeat(101) }, { ...valido, categoria: ' ' }, { ...valido, categoria: 'a'.repeat(61) }]) {
    assert.equal(validarLancamento(body).ok, false);
  }
});

test('ids devem ser inteiros positivos seguros em notação decimal', () => {
  for (const id of ['0', '-1', '1.2', '1e2', '9007199254740993', 'abc', '']) assert.equal(validarId(id), null, id);
  assert.equal(validarId('12'), 12);
});

test('mês YYYY-MM vira intervalo UTC [início, próximo mês); ausente e inválido são distintos', () => {
  const dezembro = lerMes('2026-12');
  assert.equal(dezembro.gte.toISOString(), '2026-12-01T00:00:00.000Z');
  assert.equal(dezembro.lt.toISOString(), '2027-01-01T00:00:00.000Z');
  assert.equal(lerMes(undefined), undefined);
  for (const mes of ['2026-13', '2026-00', '2026-1', '0000-01', '2026-12-01', ['2026-12'], '']) assert.equal(lerMes(mes), null, String(mes));
});

test('conta usa as regras do lançamento com vencimento no lugar de data', () => {
  const conta = { descricao: ' Aluguel ', valor: 1700, categoria: 'Moradia', vencimento: '2026-12-05' };
  const resultado = validarConta(conta);
  assert.equal(resultado.ok, true);
  assert.deepEqual(resultado.dados, { descricao: 'Aluguel', valor: 1700, categoria: 'Moradia', vencimento: new Date('2026-12-05T00:00:00.000Z') });
  assert.equal('data' in resultado.dados, false);
  const invalido = validarConta({ ...conta, vencimento: '2026-02-30', valor: 0, data: '2026-12-05' });
  assert.equal(invalido.ok, false);
  assert.deepEqual(Object.keys(invalido.campos).sort(), ['valor', 'vencimento']);
  assert.deepEqual(Object.keys(validarConta(null).campos).sort(), ['categoria', 'descricao', 'valor', 'vencimento']);
  assert.equal(lerDia(undefined), undefined);
  assert.equal(lerDia('2026-13-01'), null);
  assert.equal(lerDia('2026-12-31').toISOString(), '2026-12-31T00:00:00.000Z');
});
