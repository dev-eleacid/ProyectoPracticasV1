const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { createVolumeDatabase } = require('../helpers/volumeDatabase');
const { startVolumeServer } = require('../helpers/volumeServer');
const { cases, route, validateCase } = require('../helpers/volumeCases');
const f = require('../fixtures/volume');

test('consultas HTTP sobre 10.000 hogares y su jerarquía sintética', async (t) => {
    const db = await createVolumeDatabase();
    let server;
    t.after(async () => {
        try { if (server) await server.close(); } finally { await db.close(); }
    });
    server = await startVolumeServer(db);
    const request = async (params) => {
        const response = await fetch(server.url + route(params));
        assert.equal(response.status, 200);
        return response.json();
    };
    await t.test('el volumen y todos los vínculos tienen el recuento esperado', async () => {
        const counts = await db.admin.query(`SELECT record_type, count(*)::integer AS total
            FROM entradas_staging WHERE project_id = $1 GROUP BY record_type ORDER BY record_type`, [f.PROJECT_ID]);
        assert.deepEqual(counts.rows, [{ record_type: 'branch', total: 20_000 },
            { record_type: 'child', total: 10_000 }, { record_type: 'form', total: 10_000 }]);
        const missing = await db.admin.query(`SELECT count(*)::integer AS total FROM entradas_staging s
            WHERE parent_uuid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM entradas_staging p
                WHERE p.project_id = s.project_id AND p.form_ref = s.parent_form_ref AND p.entry_uuid = s.parent_uuid)`);
        assert.equal(missing.rows[0].total, 0);
    });
    for (const scenario of cases) {
        await t.test(scenario.name, async () => validateCase(scenario, await request(scenario.params)));
    }
    await t.test('las diez páginas contienen todos los hogares exactamente una vez con empates numéricos', async () => {
        const ids = [];
        for (let page = 1; page <= 10; page++) {
            const data = await request({ page, page_size: 1000, sort_by: `field.${f.PROJECT_ID}.household.amount`, sort_order: 'asc' });
            ids.push(...data.data.rows.map((row) => row.entry_uuid));
        }
        assert.equal(ids.length, f.ROOTS);
        assert.equal(new Set(ids).size, f.ROOTS);
        assert.deepEqual(new Set(ids), new Set(Array.from({ length: f.ROOTS }, (_, i) => f.uuid('form', i + 1))));
    });
    await t.test('el mismo slug e identificadores de otro servidor no se mezclan', async () => {
        const data = await request({ source_base_url: f.OTHER_BASE });
        assert.equal(data.data.pagination.total, 1);
        assert.equal(data.data.rows[0].project_id, f.OTHER_PROJECT_ID);
    });
    await t.test('el servidor de ensayo rechaza escrituras', async () => {
        const response = await fetch(server.url + '/api/connections', { method: 'POST' });
        assert.equal(response.status, 405);
    });
});

test('el cierre elimina únicamente el esquema temporal creado por el ensayo', async () => {
    const db = await createVolumeDatabase({ roots: 1 });
    const schema = db.schema;
    await db.close();
    await db.close();
    const client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    try {
        await client.connect();
        const found = await client.query('SELECT 1 FROM pg_namespace WHERE nspname = $1', [schema]);
        assert.equal(found.rowCount, 0);
    } finally { await client.end(); }
});
