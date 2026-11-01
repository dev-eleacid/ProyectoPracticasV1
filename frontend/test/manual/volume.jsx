import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import VirtualizedDataTable from '../../src/components/VirtualizedDataTable';
import { getStagingEntries } from '../../src/services/staging.service.js';
import '../../src/index.css';

const ROOTS = 10_000;
const scope = { projectSlug: 'volumen-local', sourceBaseUrl: 'https://volumen.example.org/api', formRef: 'household' };

export function VolumeHarness() {
    const [data, setData] = useState(null);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('Prepara la API local de volumen antes de cargar.');
    const [report, setReport] = useState(null);
    const container = useRef(null);
    const frame = useRef(null);
    useEffect(() => () => cancelAnimationFrame(frame.current), []);

    async function load() {
        setBusy(true); setReport(null); setStatus('Cargando páginas desde PostgreSQL local…');
        try {
            const started = performance.now();
            const rows = [];
            let columns;
            for (let page = 1; page <= 10; page++) {
                const response = await getStagingEntries({ ...scope, page, pageSize: 1000 });
                if (response.data.pagination.total !== ROOTS) throw new Error('El volumen recibido no coincide.');
                columns = response.data.columns.filter((column) => !column.hidden);
                rows.push(...response.data.rows);
            }
            if (rows.length !== ROOTS || new Set(rows.map((row) => row.row_key)).size !== ROOTS) throw new Error('Páginas incompletas o duplicadas.');
            setData({ columns, rows });
            setStatus(`${ROOTS.toLocaleString('es-MX')} formularios cargados en memoria; carga HTTP completa ${(performance.now() - started).toFixed(0)} ms.`);
        } catch { setData(null); setStatus('No se completó la carga. Revisa la API y el conjunto temporal de pruebas.'); }
        finally { setBusy(false); }
    }

    function measure(moving = true) {
        // Es el contenedor real del componente compartido, no una tabla reconstruida para el ensayo.
        const scroll = container.current.querySelector('div.overflow-auto');
        if (!scroll || document.visibilityState !== 'visible') return;
        setBusy(true); setReport(null); setStatus(moving
            ? 'Midiendo desplazamiento durante 20 segundos. Mantén visible esta pestaña.'
            : 'Midiendo reposo durante 5 segundos. Mantén visible esta pestaña.');
        scroll.scrollTop = 0;
        const duration = moving ? 20_000 : 5_000;
        const samples = [];
        const memory = () => performance.memory?.usedJSHeapSize ?? null;
        const beforeMemory = memory();
        let started;
        let previous;
        let hidden = false;
        let maxMounted = 0;
        let maximumOffset = 0;
        const step = (now) => {
            started ??= now; previous ??= now;
            hidden ||= document.visibilityState !== 'visible';
            const elapsed = now - started;
            if (now > previous) samples.push({ elapsed, ms: now - previous });
            previous = now;
            const progress = Math.min(1, elapsed / duration);
            const distance = scroll.scrollHeight - scroll.clientHeight;
            if (moving) scroll.scrollTop = distance * (progress <= 0.5 ? progress * 2 : (1 - progress) * 2);
            maximumOffset = Math.max(maximumOffset, scroll.scrollTop);
            maxMounted = Math.max(maxMounted, scroll.querySelectorAll('tr[data-row-index]').length);
            if (elapsed < duration) { frame.current = requestAnimationFrame(step); return; }
            const windows = [];
            for (let second = 0; second < duration / 1000; second++) {
                const values = samples.filter((sample) => sample.elapsed > second * 1000 && sample.elapsed <= (second + 1) * 1000);
                if (values.length) windows.push(values.length * 1000 / values.reduce((sum, value) => sum + value.ms, 0));
            }
            const result = { synthetic: true, mode: moving ? 'scroll' : 'idle', loadedRows: data.rows.length, loadedColumns: data.columns.length,
                durationMs: elapsed, frames: samples.length,
                averageFps: samples.length * 1000 / samples.reduce((sum, sample) => sum + sample.ms, 0),
                minimumOneSecondFps: Math.min(...windows), oneSecondFps: windows,
                maxMountedRows: maxMounted, maximumScrollOffset: maximumOffset,
                visibleThroughout: !hidden, heapBeforeBytes: beforeMemory, heapAfterBytes: memory(),
                thirtyMinuteStabilityMeasured: false,
                note: `rAF del navegador; ensayo sintético de ${duration / 1000} s. No acredita CA-1 en producción ni estabilidad de 30 min.` };
            setReport(result); setBusy(false); setStatus(hidden ? 'Medición inválida: la pestaña dejó de estar visible.' : 'Medición local terminada.');
        };
        frame.current = requestAnimationFrame(step);
    }

    return <main className='min-h-screen bg-slate-100 p-6 text-slate-900'>
        <h1 className='text-2xl font-bold'>Prueba local de volumen</h1>
        <p className='my-3'>Datos ficticios de PostgreSQL. La tabla usa el componente de la aplicación con 10.000 filas en memoria.</p>
        <div className='flex gap-3'>
            <button className='rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-40' disabled={busy} onClick={load}>Cargar 10.000 formularios</button>
            <button className='rounded border border-slate-400 px-4 py-2 disabled:opacity-40' disabled={!data || busy} onClick={() => measure()}>Medir desplazamiento (20 s)</button>
            <button className='rounded border border-slate-400 px-4 py-2 disabled:opacity-40' disabled={!data || busy} onClick={() => measure(false)}>Medir reposo (5 s)</button>
        </div>
        <p role='status' className='my-3'>{status}</p>
        {data && <div ref={container}><VirtualizedDataTable columns={data.columns} rows={data.rows} resetKey={data} /></div>}
        {report && <section className='mt-5 rounded bg-white p-4'>
            <h2 className='text-lg font-bold'>Resultado del desplazamiento</h2>
            <p>Promedio: {report.averageFps.toFixed(1)} FPS · Menor ventana de un segundo: {report.minimumOneSecondFps.toFixed(1)} FPS · Máximo de filas montadas: {report.maxMountedRows}</p>
            <pre className='mt-3 overflow-auto text-xs' aria-label='Informe de desplazamiento'>{JSON.stringify(report, null, 2)}</pre>
        </section>}
    </main>;
}

createRoot(document.getElementById('root')).render(<VolumeHarness />);
