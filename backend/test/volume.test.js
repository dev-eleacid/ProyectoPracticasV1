const { test } = require('node:test');
const assert = require('node:assert/strict');
const { localDatabaseUrl } = require('./helpers/volumeDatabase');
const f = require('./fixtures/volume');
const { summarize, options } = require('../scripts/benchmarkStaging');

test('el ensayo sólo acepta una URL explícita de PostgreSQL local', () => {
    for (const value of [undefined, 'postgresql://remote.example.org/test', 'https://localhost/test',
        'postgresql://localhost/test?options=unsafe', 'postgresql://localhost/test#fragment']) {
        assert.throws(() => localDatabaseUrl(value));
    }
    assert.equal(localDatabaseUrl('postgresql://localhost/test'), 'postgresql://localhost/test');
});

test('la semilla de volumen es determinista, jerárquica y representa tipos y valores vacíos', () => {
    assert.deepEqual([...f.records(2)], [...f.records(2)]);
    const rows = [...f.records(2)];
    assert.equal(rows.length, 8);
    assert.equal(new Set(rows.map((r) => r.entry_uuid)).size, 8);
    assert.equal(rows.filter((r) => r.record_type === 'branch').length, 4);
    for (const row of rows.filter((r) => r.parent_uuid)) assert.ok(rows.some((parent) => parent.entry_uuid === row.parent_uuid));
    assert.equal(f.rootValues(10).name, null);
    assert.equal(f.rootValues(20).amount, null);
    assert.deepEqual(f.rootValues(2).tags, ['a', 'b']);
    assert.deepEqual(f.rootValues(1).tags, ['aa']);
});

test('la medición calcula el percentil 95 por rango más próximo sin ocultar muestras lentas', () => {
    const samples = Array.from({ length: 40 }, (_, i) => i + 1).reverse();
    assert.deepEqual(summarize(samples), { samples: 40, minMs: 1, medianMs: 20, p95Ms: 38, maxMs: 40 });
    assert.equal(samples[0], 40);
    for (const invalid of [[], [NaN], [-1], [Infinity]]) assert.throws(() => summarize(invalid));
    assert.equal(options([]).samples, 40);
    for (const args of [['--samples', '3'], ['--samples'], ['--unknown', '40']]) assert.throws(() => options(args));
});
