import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { logPerf } from './utils/perf';
const bootT0 = performance.now();

const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);

logPerf('startup', Math.round(performance.now() - bootT0));

// Service worker didaftarkan vite-plugin-pwa (registerType: 'autoUpdate'), yang
// menyuntik /registerSW.js ke index.html. Jangan daftarkan manual di sini.
