import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app/App.js';
import { applyTheme, watchSystemTheme } from './lib/theme.js';
import '@fontsource-variable/outfit';
import './styles/app.css';

applyTheme();
watchSystemTheme();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Always attempt the request: when offline the service worker answers from its cache.
      networkMode: 'offlineFirst',
      retry: 1,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
    },
    mutations: { networkMode: 'offlineFirst', retry: 0 },
  },
});

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root missing');

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
