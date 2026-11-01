const { createVolumeDatabase } = require('../test/helpers/volumeDatabase');
const { startVolumeServer } = require('../test/helpers/volumeServer');

async function main() {
    const port = Number(process.env.VOLUME_PORT || 3088);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Puerto de ensayo no válido.');
    // Configuración exclusiva del proceso de QA, sin editar el .env del proyecto.
    process.env.CORS_ALLOWED_ORIGINS = 'http://127.0.0.1:5188,http://localhost:5188';
    const database = await createVolumeDatabase();
    let server;
    try { server = await startVolumeServer(database, port); }
    catch (error) { await database.close(); throw error; }
    let closing = false;
    const close = async () => {
        if (closing) return;
        closing = true;
        try {
            try { await server.close(); } finally { await database.close(); }
            console.log('Ensayo detenido; esquema temporal retirado.');
        }
        catch { console.error('Revisa la limpieza del esquema temporal de QA.'); process.exitCode = 1; }
    };
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
    console.log(`API de volumen sintético: ${server.url}/api`);
    console.log('10.000 hogares, 10.000 hijos y 20.000 ramas; sólo lecturas. Ctrl+C para terminar.');
}

if (require.main === module) main().catch((error) => {
    console.error(`No se pudo iniciar el ensayo: ${error.code || 'VOLUME_SERVER_FAILED'}.`);
    process.exitCode = 1;
});
