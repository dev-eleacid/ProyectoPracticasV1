const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createVolumeDatabase } = require('../test/helpers/volumeDatabase');
const { startVolumeServer } = require('../test/helpers/volumeServer');
const { cases, route, validateCase } = require('../test/helpers/volumeCases');
const fixture = require('../test/fixtures/volume');

function summarize(samples) {
    if (!samples.length || samples.some((value) => !Number.isFinite(value) || value < 0)) {
        throw new Error('Las mediciones deben ser finitas y no negativas.');
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const at = (percentile) => sorted[Math.ceil(sorted.length * percentile) - 1];
    return { samples: sorted.length, minMs: sorted[0], medianMs: at(0.5), p95Ms: at(0.95), maxMs: sorted.at(-1) };
}

function options(args) {
    const result = { samples: 40, output: path.resolve(__dirname, '../benchmark-results/staging.json') };
    for (let i = 0; i < args.length; i += 2) {
        if (!['--samples', '--output'].includes(args[i]) || !args[i + 1]) throw new Error('Usa --samples N y/o --output archivo.json.');
        if (args[i] === '--samples') result.samples = Number(args[i + 1]);
        else result.output = path.resolve(args[i + 1]);
    }
    if (!Number.isInteger(result.samples) || result.samples < 20 || result.samples > 500) {
        throw new Error('El número de muestras debe estar entre 20 y 500.');
    }
    return result;
}

async function benchmark(config) {
    const report = { version: 1, fixture: fixture.VERSION, startedAt: new Date().toISOString(), synthetic: true,
        scope: 'HTTP local y PostgreSQL; no mide renderizado, FPS ni memoria del navegador',
        environment: { node: process.version, platform: process.platform, arch: process.arch,
            cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem() },
        dataset: { forms: fixture.ROOTS, children: fixture.ROOTS, branches: fixture.ROOTS * 2, otherSourceRecords: 4 },
        method: { warmupPerCase: 5, samplesPerCase: config.samples, percentile: 'nearest-rank',
            timed: 'fetch hasta JSON parseado; validación funcional fuera del intervalo', thresholdMs: 2000 }, cases: [] };
    const db = await createVolumeDatabase();
    let server;
    try {
        report.environment.postgresql = db.serverVersion;
        report.storage = db.storage;
        server = await startVolumeServer(db);
        const request = async (scenario) => {
            const before = performance.now();
            const response = await fetch(server.url + route(scenario.params));
            const body = await response.json();
            const elapsed = performance.now() - before;
            assert.equal(response.status, 200, scenario.name);
            validateCase(scenario, body);
            return elapsed;
        };
        for (const scenario of cases) {
            db.clearQueries();
            const firstRequestMs = await request(scenario);
            const sql = db.queries.filter((query) => /^\s*SELECT/i.test(query.text) && /FROM entradas_staging/.test(query.text));
            for (let warmup = 0; warmup < 5; warmup++) await request(scenario);
            const durations = [];
            for (let i = 0; i < config.samples; i++) durations.push(await request(scenario));
            const metrics = summarize(durations);
            const plans = [];
            for (const query of sql) {
                const result = await db.pool.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + query.text, query.values);
                plans.push({ sql: query.text, parameters: query.values, plan: result.rows[0]['QUERY PLAN'] });
            }
            report.cases.push({ name: scenario.name, expectedTotal: scenario.total, params: scenario.params,
                firstRequestMs, ...metrics, belowThreshold: metrics.p95Ms < 2000, durationsMs: durations, plans });
            console.log(`${scenario.name}: p95 ${metrics.p95Ms.toFixed(1)} ms (${config.samples} muestras)`);
        }
        const concurrentSamples = [];
        for (let round = 0; round < 10; round++) {
            concurrentSamples.push(...await Promise.all([2, 4, 9, 11].map((index) => request(cases[index]))));
        }
        report.concurrent = { clients: 4, rounds: 10, ...summarize(concurrentSamples), durationsMs: concurrentSamples };
        report.httpThresholdMet = report.cases.every((scenario) => scenario.belowThreshold);
    } finally {
        try { if (server) await server.close(); } finally { await db.close(); }
    }
    report.temporarySchemaRemoved = true;
    report.finishedAt = new Date().toISOString();
    await mkdir(path.dirname(config.output), { recursive: true });
    await writeFile(config.output, JSON.stringify(report, null, 2) + '\n');
    console.log(`Informe guardado. Umbral HTTP local: ${report.httpThresholdMet ? 'cumplido' : 'no cumplido'}.`);
    return report;
}

if (require.main === module) {
    Promise.resolve().then(() => benchmark(options(process.argv.slice(2)))).then((report) => {
        if (!report.httpThresholdMet) process.exitCode = 1;
    }).catch((error) => {
        console.error(`Ensayo no completado: ${error.code || 'VOLUME_BENCHMARK_FAILED'}. Revisa la configuración y las pruebas de volumen.`);
        process.exitCode = 1;
    });
}

module.exports = { summarize, options, benchmark };
