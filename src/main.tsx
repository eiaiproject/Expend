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

// Dismiss splash screen after React has mounted
const splashScreen = document.getElementById('splash-screen');
if (splashScreen) {
  splashScreen.style.opacity = '0';
  setTimeout(() => {
    splashScreen.remove();
  }, 500);
}
