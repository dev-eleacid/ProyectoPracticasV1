import { createServer } from 'node:http';
import { connection, dashboard, staging, audit } from '../fixtures/apiResponses.js';

// API ficticia ligada únicamente al equipo local. No contacta Epicollect5 ni PostgreSQL.
const state = { mode: 'valid', target: '/api/dashboard', writes: 0, requests: {}, saved: false };
const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5187');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,OPTIONS');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') { res.end(); return; }
    const url = new URL(req.url, 'http://127.0.0.1:3087');
    const send = (body, status = 200) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    if (url.pathname === '/__qa/status') { send(state); return; }
    if (url.pathname === '/__qa/stop' && req.method === 'POST') {
        send({ stopped: true }); server.close(); return;
    }
    if (url.pathname === '/__qa/scenario' && req.method === 'POST') {
        let raw = ''; for await (const chunk of req) raw += chunk;
        try {
            const next = JSON.parse(raw);
            if (!['valid', 'invalid', 'html', 'http-error', 'write-invalid'].includes(next.mode)) throw new Error();
            state.mode = next.mode; state.target = typeof next.target === 'string' ? next.target : '/api/dashboard';
            send({ updated: true });
        } catch { send({ error: 'Escenario no válido' }, 400); }
        return;
    }
    const key = `${req.method} ${url.pathname}`;
    state.requests[key] = (state.requests[key] || 0) + 1;
    if (req.method !== 'GET') {
        for await (const chunk of req) { void chunk; }
        state.writes++;
        if (url.pathname === '/api/connections') state.saved = true;
        if (state.mode === 'write-invalid') { res.end('{"status":'); return; }
        if (url.pathname.endsWith('/refresh')) { send({ status: 'ok', data: { received: 1, matched: 1, unmatched: 0 } }); return; }
        send({ status: 'ok', data: connection() }); return;
    }
    if (state.target === url.pathname && state.mode === 'invalid') { send({ status: 'ok', data: { unexpected: 'QA_PRIVATE_RESPONSE_SENTINEL' } }); return; }
    if (state.target === url.pathname && state.mode === 'html') { res.end('<html>QA_PRIVATE_RESPONSE_SENTINEL</html>'); return; }
    if (state.target === url.pathname && state.mode === 'http-error') { send({ message: {}, detail: 'QA_PRIVATE_RESPONSE_SENTINEL at private/server.js' }, 503); return; }
    let data;
    if (url.pathname === '/api/connections') data = [connection()];
    else if (url.pathname === '/api/sync-scheduler') data = { enabled: false, pollMs: 30000, requestIntervalMs: 25000 };
    else if (url.pathname === '/api/sync-logs') data = [];
    else if (url.pathname === '/api/dashboard') data = dashboard();
    else if (url.pathname === '/api/staging/entries') data = staging();
    else if (url.pathname.startsWith('/api/audit/connections/')) data = audit();
    else { send({ message: 'Ruta de prueba no disponible' }, 404); return; }
    send({ status: 'ok', data });
});
server.listen(3087, '127.0.0.1', () => console.log('API ficticia de recuperación: http://127.0.0.1:3087/api'));
