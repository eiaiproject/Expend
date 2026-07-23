import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');
const root = createRoot(rootEl);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Dismiss splash screen after React has mounted
const splashScreen = document.getElementById('splash-screen');
if (splashScreen) {
  splashScreen.style.opacity = '0';
  setTimeout(() => {
    splashScreen.remove();
  }, 500);
}

// Service worker registration is handled by vite-plugin-pwa via UpdatePrompt
// using virtual:pwa-register/react. Do not register manually here.
