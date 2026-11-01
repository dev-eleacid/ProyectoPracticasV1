import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ErrorBoundary from '../../src/components/ErrorBoundary';
import ModuleBoundary from '../../src/components/ModuleBoundary';
import { retryRead } from '../../src/services/requestError.js';
import '../../src/index.css';

// Arnés aislado de QA: no se importa desde la aplicación ni desde la compilación de producción.
const client = new QueryClient({ defaultOptions: { queries: { retry: retryRead }, mutations: { retry: false } } });
const button = 'rounded-lg border border-slate-400 bg-white px-4 py-2';

export function Screen({ onWrite }) {
    const cache = useQueryClient();
    const read = useQuery({ queryKey: ['dashboard', 'boundary-test'], queryFn: async () => ({ crash: false }) });
    const write = useMutation({ mutationFn: async () => onWrite() });
    if (read.data?.crash) throw new Error('QA_PRIVATE_RENDER_SENTINEL');
    return <section className='space-y-4 p-6'>
        <h2 className='text-xl font-semibold'>Pantalla de prueba disponible</h2>
        <p>Datos ficticios. Esta pantalla provoca un error de renderizado para comprobar la recuperación.</p>
        <div className='flex flex-wrap gap-3'>
            <button className={button} type='button' disabled={write.isPending} onClick={() => write.mutate()}>Enviar operación ficticia</button>
            <button className={button} type='button' onClick={() => cache.setQueryData(['dashboard', 'boundary-test'], { crash: true })}>Provocar fallo de pantalla</button>
        </div>
    </section>;
}

export function Harness() {
    const [module, setModule] = useState('dashboard');
    const [writes, setWrites] = useState(0);
    const [rootCrash, setRootCrash] = useState(false);
    if (rootCrash) throw new Error('QA_PRIVATE_ROOT_SENTINEL');
    return <div className='min-h-screen bg-slate-100 text-slate-900'>
        <header className='space-y-3 border-b bg-white p-6'>
            <h1 className='text-2xl font-semibold'>Demostración local de recuperación</h1>
            <p>Operaciones ficticias enviadas: <strong>{writes}</strong></p>
            <nav className='flex flex-wrap gap-3' aria-label='Módulos de prueba'>
                <button className={button} onClick={() => setModule('dashboard')} type='button'>Pantalla de prueba</button>
                <button className={button} onClick={() => setModule('audit')} type='button'>Otro módulo</button>
                <button className={button} onClick={() => setRootCrash(true)} type='button'>Provocar fallo de aplicación</button>
            </nav>
        </header>
        <ModuleBoundary key={module} module={module} label='la pantalla de prueba'>
            {module === 'dashboard' ? <Screen onWrite={() => setWrites((n) => n + 1)} /> : <p className='p-6'>Otro módulo disponible.</p>}
        </ModuleBoundary>
    </div>;
}

createRoot(document.getElementById('root'), {
    onCaughtError: () => console.error('Fallo ficticio controlado en la demostración de recuperación.'),
}).render(<ErrorBoundary><QueryClientProvider client={client}><Harness /></QueryClientProvider></ErrorBoundary>);
