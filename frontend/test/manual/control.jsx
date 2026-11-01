import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';

export default function Control() {
    const [mode, setMode] = useState('valid');
    const [target, setTarget] = useState('/api/dashboard');
    const [result, setResult] = useState('Sin consultar');
    const style = 'rounded-lg border border-slate-400 bg-white px-3 py-2';
    async function stats() {
        try { setResult(JSON.stringify(await (await fetch('http://127.0.0.1:3087/__qa/status')).json(), null, 2)); }
        catch { setResult('No se pudo consultar la API ficticia.'); }
    }
    async function apply() {
        try {
            await fetch('http://127.0.0.1:3087/__qa/scenario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, target }) });
            await stats();
        } catch { setResult('No se pudo configurar la API ficticia.'); }
    }
    return <main className='space-y-4 p-6'>
        <h1 className='text-2xl font-semibold'>Control local de respuestas ficticias</h1>
        <p>Esta página sólo cambia la API de prueba. No contacta el backend de trabajo.</p>
        <label className='block'>Escenario <select className={style} value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value='valid'>Respuesta válida</option><option value='invalid'>Respuesta incompleta</option>
            <option value='html'>HTML en lugar de JSON</option><option value='http-error'>Error HTTP 503</option>
            <option value='write-invalid'>Escritura aplicada con respuesta incompleta</option>
        </select></label>
        <label className='block'>Consulta <select className={style} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value='/api/dashboard'>Cuadro de mando</option><option value='/api/connections'>Conexiones</option>
            <option value='/api/sync-logs'>Historial</option><option value='/api/sync-scheduler'>Programación</option>
            <option value='/api/staging/entries'>Explorador</option>
            <option value='/api/audit/connections/00000000-0000-4000-8000-000000000001'>Auditoría</option>
        </select></label>
        <div className='flex gap-3'><button className={style} type='button' onClick={apply}>Aplicar escenario</button>
            <button className={style} type='button' onClick={stats}>Consultar contadores</button></div>
        <pre aria-live='polite' className='whitespace-pre-wrap rounded-lg bg-slate-100 p-4'>{result}</pre>
    </main>;
}
createRoot(document.getElementById('root')).render(<Control />);
