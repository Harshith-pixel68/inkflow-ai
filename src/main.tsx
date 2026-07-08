import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign development-only HMR WebSocket connection errors and unhandled rejections in the sandboxed preview environment
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (
      reason &&
      (reason instanceof Error || typeof reason === 'object') &&
      ((reason.message && reason.message.includes('WebSocket')) ||
       (reason.message && reason.message.includes('websocket')) ||
       (reason.message && reason.message.includes('Vite')) ||
       String(reason).includes('WebSocket') ||
       String(reason).includes('websocket'))
    ) {
      event.preventDefault();
      console.warn('Silenced benign development-only WebSocket unhandled rejection:', reason);
    }
  });

  window.addEventListener('error', (event) => {
    if (
      event.message &&
      (event.message.includes('WebSocket') ||
       event.message.includes('websocket') ||
       event.message.includes('Vite'))
    ) {
      event.preventDefault();
      console.warn('Silenced benign development-only WebSocket error:', event.message);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
