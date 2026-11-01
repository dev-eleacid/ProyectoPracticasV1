const { randomBytes } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { Client, Pool } = require('pg');
const fixture = require('../fixtures/volume');

function localDatabaseUrl(value) {
    if (!value) throw new Error('Define TEST_DATABASE_URL para una base local de pruebas.');
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)
        || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        || url.search || url.hash) {
        throw new Error('El ensayo requiere PostgreSQL en localhost y una URL sin parámetros adicionales.');
    }
    return value;
}

async function createVolumeDatabase({ roots = fixture.ROOTS } = {}) {
    const connectionString = localDatabaseUrl(process.env.TEST_DATABASE_URL);
    if (!Number.isInteger(roots) || roots < 1 || roots > 100_000) throw new Error('Volumen no válido.');
    const schema = `local_volume_${randomBytes(12).toString('hex')}`;
    const admin = new Client({ connectionString, connectionTimeoutMillis: 10_000 });
    let isolatedPool;
    let created = false;
    let restored = false;
    const appPool = require('../../src/config/db');
    const original = { query: appPool.query, connect: appPool.connect };
    const queries = [];
    const priorKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
    process.env.CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    async function close() {
        if (restored) return;
        restored = true;
        appPool.query = original.query;
        appPool.connect = original.connect;
        if (priorKey === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY;
        else process.env.CREDENTIAL_ENCRYPTION_KEY = priorKey;
        try {
            if (isolatedPool) await isolatedPool.end();
            if (created) {
                await admin.query('SET search_path TO pg_catalog');
                // El identificador procede exclusivamente de randomBytes; nunca del usuario.
                await admin.query(`DROP SCHEMA ${schema} CASCADE`);
            }
        } finally { await admin.end(); }
    }
    try {
        await admin.connect();
        await admin.query(`CREATE SCHEMA ${schema}`);
        created = true;
        await admin.query(`SET search_path TO ${schema}, pg_catalog`);
        const dir = path.resolve(__dirname, '../../../database/migrations');
        for (const file of ['api_conection.sql', 'entradas_staging.sql', 'sync_controls.sql', 'sync_logs.sql']) {
            await admin.query(await readFile(path.join(dir, file), 'utf8'));
        }
        await require('../../src/services/oauthStorage.service').migrateOAuth(admin);
        await require('../../src/services/hierarchyStorage.service').migrateHierarchy(admin);
        await require('../../src/services/schedulerStorage.service').migrateScheduler(admin);
        await require('../../src/services/auditStorage.service').migrateAudit(admin);
        const { parseProjectHierarchy } = require('../../src/services/projectHierarchy.service');
        const { saveProjectHierarchy } = require('../../src/services/hierarchyStorage.service');
        // IDs fijos: las referencias de las columnas son reproducibles entre ejecuciones.
        for (const [id, base] of [[fixture.PROJECT_ID, fixture.BASE], [fixture.OTHER_PROJECT_ID, fixture.OTHER_BASE]]) {
            await admin.query('INSERT INTO staging_projects (id, project_slug, base_url, definition) VALUES ($1,$2,$3,$4)',
                [id, fixture.SLUG, base, fixture.definition]);
            await saveProjectHierarchy(admin, base, parseProjectHierarchy(fixture.definition, fixture.SLUG));
        }
        const insert = async (batch, projectId) => admin.query(`INSERT INTO entradas_staging
            (project_id, project_slug, form_ref, record_type, entry_uuid, ec5_uuid, parent_form_ref,
             parent_uuid, branch_ref, field_values, payload, uploaded_at_epicollect, received_at)
            SELECT $1::uuid, $2, r.form_ref, r.record_type, r.entry_uuid, r.ec5_uuid,
                r.parent_form_ref, r.parent_uuid, r.branch_ref, r.field_values, r.payload, r.uploaded_at, r.uploaded_at
            FROM jsonb_to_recordset($3::jsonb) AS r(form_ref text, record_type text, entry_uuid uuid,
                ec5_uuid uuid, parent_form_ref text, parent_uuid uuid, branch_ref text,
                field_values jsonb, payload jsonb, uploaded_at timestamptz)`,
        [projectId, fixture.SLUG, JSON.stringify(batch)]);
        let batch = [];
        await admin.query('BEGIN');
        try {
            for (const row of fixture.records(roots)) {
                batch.push(row);
                if (batch.length === 1000) { await insert(batch, fixture.PROJECT_ID); batch = []; }
            }
            if (batch.length) await insert(batch, fixture.PROJECT_ID);
            // Mismo slug e identificadores en otro servidor: detectar cruces de procedencia.
            await insert([...fixture.records(1)], fixture.OTHER_PROJECT_ID);
            await admin.query(`INSERT INTO api_connections (name, project_slug, form_ref, base_url, auth_type)
                VALUES ('Volumen local: hogar', $1, 'household', $2, 'none'),
                ('Volumen local: jerarquía completa', $1, NULL, $2, 'none')`, [fixture.SLUG, fixture.BASE]);
            await admin.query('COMMIT');
        } catch (error) { await admin.query('ROLLBACK'); throw error; }
        await admin.query('ANALYZE entradas_staging');
        await admin.query('ANALYZE staging_projects');
        isolatedPool = new Pool({ connectionString, max: 4, connectionTimeoutMillis: 10_000,
            options: `-c search_path=${schema},pg_catalog -c statement_timeout=15000` });
        appPool.query = (text, values) => {
            if (queries.length < 10) queries.push({ text, values });
            return isolatedPool.query(text, values);
        };
        appPool.connect = isolatedPool.connect.bind(isolatedPool);
        const serverVersion = (await admin.query('SHOW server_version')).rows[0].server_version;
        const storage = (await admin.query(`SELECT pg_relation_size('entradas_staging')::bigint AS table_bytes,
            pg_indexes_size('entradas_staging')::bigint AS index_bytes,
            pg_total_relation_size('entradas_staging')::bigint AS total_bytes`)).rows[0];
        return { schema, admin, pool: isolatedPool, queries, close, roots, serverVersion, storage,
            clearQueries() { queries.length = 0; } };
    } catch (error) {
        await close().catch(() => {});
        // No incluir URL, credenciales ni mensajes remotos en la salida del ensayo.
        throw Object.assign(new Error('No se pudo preparar el esquema temporal de volumen.'), { code: error.code || 'VOLUME_SETUP_FAILED' });
    }
}

module.exports = { localDatabaseUrl, createVolumeDatabase };
