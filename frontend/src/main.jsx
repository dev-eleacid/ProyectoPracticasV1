import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import "./index.css";
import App from "./App.jsx";
import ErrorBoundary from './components/ErrorBoundary';
import { retryRead } from './services/requestError.js';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: retryRead }, mutations: { retry: false } } });

createRoot(document.getElementById("root"), {
  // El mensaje de una excepción puede contener datos del registro: no registrarlo.
  onCaughtError: () => console.error('No se pudo mostrar una pantalla de la aplicación.'),
  onUncaughtError: () => console.error('No se pudo mostrar la aplicación.'),
}).render(
  <StrictMode>
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
