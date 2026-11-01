const express = require('express');

async function startVolumeServer(database, port = 0) {
    const app = express();
    // Este servidor de QA sólo expone lecturas del esquema temporal.
    app.use((req, res, next) => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            return res.status(405).json({ status: 'error', message: 'El ensayo sólo admite consultas.' });
        }
        next();
    });
    app.get('/__volume', (_req, res) => res.json({ synthetic: true, roots: database.roots,
        total: database.roots * 4, serverVersion: database.serverVersion }));
    app.use(require('../../src/app'));
    const server = await new Promise((resolve, reject) => {
        const instance = app.listen(port, '127.0.0.1', () => resolve(instance));
        instance.once('error', reject);
    });
    return { url: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

module.exports = { startVolumeServer };
