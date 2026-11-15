import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Elemen root tidak ditemukan')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

function watchServiceWorker(registration: ServiceWorkerRegistration) {
  const notify = () => {
    if (navigator.serviceWorker.controller) {
      window.dispatchEvent(new Event('expend:sw-update'))
    }
  }

  if (registration.waiting) notify()

  registration.addEventListener('updatefound', () => {
    const worker = registration.installing
    if (!worker) return
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') notify()
    })
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void registration.update()
  })
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(watchServiceWorker)
      .catch(() => {
        // Mode offline tidak aktif, aplikasi tetap berjalan selama online.
      })
  })
}
