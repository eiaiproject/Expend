import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Dismiss splash screen after React has mounted.
// pointer-events:none immediately - the overlay must never swallow the
// user's first tap while it fades out (master.md 3.19).
const splashScreen = document.getElementById('splash-screen');
if (splashScreen) {
  splashScreen.style.pointerEvents = 'none';
  splashScreen.style.opacity = '0';
  setTimeout(() => {
    splashScreen.remove();
  }, 500);
}

// Service worker registration is handled by vite-plugin-pwa via UpdatePrompt
// using virtual:pwa-register/react. Do not register manually here.
