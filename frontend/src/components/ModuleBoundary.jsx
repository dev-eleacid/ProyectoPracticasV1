import { useQueryClient } from '@tanstack/react-query';
import ErrorBoundary from './ErrorBoundary';

const QUERIES = {
    'api-manager': ['api-connections', 'sync-logs', 'sync-scheduler'],
    'data-explorer': ['api-connections', 'staging-entries'],
    dashboard: ['dashboard'],
    audit: ['api-connections', 'audit'],
};

export default function ModuleBoundary({ module, label, children }) {
    const client = useQueryClient();
    async function retry() {
        // Se reinician consultas de lectura, nunca operaciones de escritura.
        for (const key of QUERIES[module] || []) await client.resetQueries({ queryKey: [key] });
    }
    return <ErrorBoundary label={label} onRetry={retry}>{children}</ErrorBoundary>;
}
