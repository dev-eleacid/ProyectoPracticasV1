import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { apiRequest } from '../src/services/api.service.js';
import { getConnections, getSchedulerStatus, createConnection, syncConnection, testConnection, getSyncLogs } from '../src/services/apiManager.service.js';
import { getDashboard } from '../src/services/dashboard.service.js';
import { getAudit, refreshAudit } from '../src/services/audit.service.js';
import { getStagingEntries } from '../src/services/staging.service.js';
import { retryRead, getRequestErrorMessage } from '../src/services/requestError.js';
import { connection, dashboard, audit, staging } from './fixtures/apiResponses.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const reply = (data) => { globalThis.fetch = async () => Response.json({ status: 'ok', data }); };
const scope = { projectSlug: 'recuperacion-local' };

test('los servicios aceptan respuestas completas, incluidas listas legítimamente vacías', async () => {
    reply([connection()]); assert.equal((await getConnections()).data.length, 1);
    reply([]); assert.deepEqual((await getConnections()).data, []); assert.deepEqual((await getSyncLogs()).data, []);
    reply({ enabled: false, pollMs: 30000, requestIntervalMs: 25000 }); await getSchedulerStatus();
    reply(dashboard()); await getDashboard();
    reply(staging()); await getStagingEntries(scope);
    reply(audit()); await getAudit('connection', {});
});

test('rechaza JSON truncado, HTML, null y sobres incompletos sin transformarlos en éxito', async () => {
    for (const body of ['<html>proxy</html>', '{"status":', 'null', '{}', '{"status":"ok"}', '{"status":"error","data":[]}']) {
        globalThis.fetch = async () => new Response(body, { status: 200 });
        await assert.rejects(getConnections(), { code: 'API_RESPONSE_INVALID' });
    }
});

test('rechaza colecciones corruptas de conexiones e historial', async () => {
    for (const value of [{}, [null], [{ ...connection(), name: {} }], [{ ...connection(), sync_schedule_enabled: 'false' }]]) {
        reply(value); await assert.rejects(getConnections(), { code: 'API_RESPONSE_INVALID' });
    }
    reply([null]); await assert.rejects(getSyncLogs(), { code: 'API_RESPONSE_INVALID' });
});

test('un indicador incompleto no se presenta como cero ni como programación desactivada', async () => {
    for (const edit of [ (d) => { delete d.staging; }, (d) => { d.daily = [null]; },
        (d) => { d.period.from = {}; }, (d) => { d.validation = null; }, (d) => { d.sync.recordsPerSecond = {}; } ]) {
        const data = dashboard(); edit(data); reply(data);
        await assert.rejects(getDashboard(), { code: 'API_RESPONSE_INVALID' });
    }
    reply({ enabled: 'false' }); await assert.rejects(getSchedulerStatus(), { code: 'API_RESPONSE_INVALID' });
});

test('rechaza columnas, opciones y filas que romperían el renderizado del explorador', async () => {
    for (const edit of [ (d) => { d.columns = null; }, (d) => { d.rows = [null]; },
        (d) => { d.columns[0].label = {}; }, (d) => { d.columns[1].options = {}; },
        (d) => { d.columns[1].type = 'choice'; delete d.columns[1].options; },
        (d) => { d.columns[1].source = 'payload'; d.columns[1].path = {}; },
        (d) => { d.columns.push(d.columns[0]); }, (d) => { d.pagination.total = 'muchos'; } ]) {
        const data = staging(); edit(data); reply(data);
        await assert.rejects(getStagingEntries(scope), { code: 'API_RESPONSE_INVALID' });
    }
});

test('la auditoría exige conteos consistentes y personas y estados representables', async () => {
    for (const edit of [ (d) => { d.summary.total = 9; }, (d) => { d.surveyors = [null]; },
        (d) => { d.rows[0].surveyor_name = {}; }, (d) => { d.validation_statuses = [{}]; } ]) {
        const data = audit(); edit(data); reply(data);
        await assert.rejects(getAudit('connection', {}), { code: 'API_RESPONSE_INVALID' });
    }
});

test('una operación correcta conserva el resultado del servidor', async () => {
    reply(connection()); assert.equal((await createConnection({ name: 'Ficticia' })).data.id, connection().id);
    reply({ connection: connection(), test: { statusCode: 200, entriesCount: 1 } }); await testConnection('connection');
    reply({ connection: connection(), sync: { database: { processed: 1, skipped: 0, pendingParents: 0 }, fetch: { totalEntriesFetched: 1 } } });
    assert.equal((await syncConnection('connection')).data.sync.database.processed, 1);
    reply({ received: 1, matched: 1, unmatched: 0 }); await refreshAudit('connection');
});

test('una escritura sin respuesta válida queda sin confirmar y se envía una sola vez', async () => {
    for (const action of [() => createConnection({}), () => syncConnection('c'), () => refreshAudit('c')]) {
        let requests = 0;
        globalThis.fetch = async () => { requests++; return Response.json({ status: 'ok', data: {} }); };
        const error = await action().catch((failure) => failure);
        assert.equal(error.code, 'API_RESULT_UNCONFIRMED'); assert.equal(error.uncertain, true);
        assert.match(error.message, /antes de repetirla/); assert.equal(requests, 1);
    }
});

test('una pérdida de conexión en escritura no induce éxito ni reenvío', async () => {
    let sent = 0;
    globalThis.fetch = async () => { sent++; throw new TypeError('QA_SECRET_NETWORK_DETAILS'); };
    await assert.rejects(createConnection({}), { code: 'API_RESULT_UNCONFIRMED' });
    assert.equal(sent, 1);
});

test('respuestas de error con objetos o trazas quedan controladas y sin el cuerpo remoto', async () => {
    for (const status of [400, 500]) {
        globalThis.fetch = async () => Response.json({ message: { secret: 'QA_SECRET' }, detail: 'QA_SECRET at C:/private/server.js',
            errors: [null, { message: {} }, { secret: 'QA_SECRET' }] }, { status });
        const error = await getConnections().catch((failure) => failure);
        assert.equal(error.code, 'API_HTTP_ERROR'); assert.equal(error.status, status);
        assert.equal(JSON.stringify(error.payload).includes('QA_SECRET'), false);
        assert.equal(getRequestErrorMessage(error).includes('[object Object]'), false);
    }
});

test('errores de campos admiten mensajes de texto y objetos del backend', async () => {
    globalThis.fetch = async () => Response.json({ message: 'Revisa los campos', errors: ['Falta proyecto', { message: 'Falta nombre' }, null] }, { status: 400 });
    const error = await createConnection({}).catch((failure) => failure);
    assert.equal(getRequestErrorMessage(error), 'Falta proyecto Falta nombre');
});

test('un código conocido conserva la orientación operativa sin mostrar detalles remotos', async () => {
    globalThis.fetch = async () => Response.json({ code: 'AUDIT_SOURCE_UNAVAILABLE', message: 'QA_SECRET', detail: 'QA_SECRET' }, { status: 503 });
    const error = await getAudit('c', {}).catch((failure) => failure);
    assert.match(error.message, /no está configurado/);
    assert.equal(JSON.stringify(error.payload).includes('QA_SECRET'), false);
});

test('React Query conserva los últimos datos confirmados al rechazar una actualización', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: retryRead } } });
    try {
        reply([connection()]); await client.fetchQuery({ queryKey: ['api-connections'], queryFn: getConnections });
        reply([null]); await assert.rejects(client.fetchQuery({ queryKey: ['api-connections'], queryFn: getConnections, staleTime: 0 }), { code: 'API_RESPONSE_INVALID' });
        assert.equal(client.getQueryData(['api-connections']).data[0].id, connection().id);
    } finally { client.clear(); }
});

test('sólo las lecturas con fallo de conexión tienen reintento automático acotado', () => {
    assert.equal(retryRead(0, { code: 'API_UNAVAILABLE' }), true);
    assert.equal(retryRead(2, { code: 'API_UNAVAILABLE' }), false);
    for (const code of ['API_RESPONSE_INVALID', 'API_RESULT_UNCONFIRMED', 'API_HTTP_ERROR']) assert.equal(retryRead(0, { code }), false);
});

test('una señal de cancelación de lectura se respeta', async () => {
    const controller = new AbortController(); controller.abort();
    globalThis.fetch = async (url, options) => { assert.equal(options.signal, controller.signal); throw new DOMException('Cancelado', 'AbortError'); };
    await assert.rejects(apiRequest('/connections', { signal: controller.signal }), { name: 'AbortError' });
});
