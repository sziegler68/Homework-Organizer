import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { log } from './utils/ErrorLogger'
import './index.css'
import App from './App.jsx'

// Catch unhandled errors and promise rejections globally
window.addEventListener('error', (event) => {
  log('error', 'window.onerror', event.message, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  }, event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  log('error', 'unhandledrejection', String(reason), {}, reason instanceof Error ? reason : null);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
