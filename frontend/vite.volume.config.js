import { defineConfig, mergeConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import config from './vite.config.js';

// Compilación separada de QA: nunca sustituye dist ni el punto de entrada del producto.
export default defineConfig((environment) => mergeConfig(config(environment), { build: {
    outDir: 'volume-dist',
    rollupOptions: { input: fileURLToPath(new URL('./test/manual/volume.html', import.meta.url)) },
} }));
