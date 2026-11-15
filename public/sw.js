const CACHE = 'expend-__BUILD_VERSION__'
const SHARE_CACHE = 'expend-share'
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-maskable.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE && key !== SHARE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

async function handleShare(request) {
  try {
    const form = await request.formData()
    const file = form.get('receipt')
    if (file && typeof file === 'object' && 'size' in file && file.size > 0) {
      const cache = await caches.open(SHARE_CACHE)
      await cache.put(
        '/shared-receipt',
        new Response(file, {
          headers: {
            'content-type': file.type || 'image/jpeg',
            'x-filename': encodeURIComponent(file.name || 'bukti-transfer'),
          },
        }),
      )
    }
  } catch (error) {
    // Berkas tidak bisa dibaca: biarkan aplikasi terbuka tanpa pratinjau.
  }
  return Response.redirect('/?shared=1', 303)
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(handleShare(request))
    return
  }

  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(async () => {
          const cached = await caches.match('/index.html')
          return cached || Response.error()
        }),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached || Response.error())
      return cached || network
    }),
  )
})
