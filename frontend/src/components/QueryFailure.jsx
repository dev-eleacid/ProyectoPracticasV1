import { getRequestErrorMessage } from '../services/requestError.js';

export default function QueryFailure({ query, label = 'datos', retryLabel = 'Reintentar consulta' }) {
    return <div role='alert' className='my-3 space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950'>
        <p>No fue posible consultar {label}. {getRequestErrorMessage(query.error)}</p>
        {query.data && <p>Se muestran los últimos datos confirmados; pueden haber cambiado en el servidor.</p>}
        <button type='button' className='rounded-lg border border-slate-400 bg-white px-3 py-2 text-slate-900 disabled:opacity-50'
            disabled={query.isFetching} onClick={() => query.refetch()}>{retryLabel}</button>
    </div>;
}
