const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarLancamento, validarId } = require('../dist/validacao');

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
