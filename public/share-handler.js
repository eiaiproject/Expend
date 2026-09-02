self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const path = url.pathname;
  if (path === '/share-handler' || path === '/share') {
    if (event.request.method === 'POST') {
      event.respondWith(handlePost(event));
    } else {
      event.respondWith(Response.redirect('/chat?share=1', 303));
    }
  }
});

async function handlePost(event) {
  try {
    const formData = await event.request.formData();
    const file = formData.get('receipt');
    const text = formData.get('text') || formData.get('title') || '';
    const sharedUrl = formData.get('url') || '';
    const cache = await caches.open('share-cache');
    if (file && typeof file === 'object' && 'arrayBuffer' in file && file.size > 0) {
      const buf = await file.arrayBuffer();
      const headers = { 'content-type': file.type || 'image/png', 'x-file-name': encodeURIComponent(file.name || 'receipt.png') };
      await cache.put('shared-file', new Response(buf, { headers }));
    } else {
      await cache.delete('shared-file');
    }
    if (text || sharedUrl) {
      await cache.put('shared-meta', new Response(JSON.stringify({ text, url: sharedUrl }), { headers: { 'content-type': 'application/json' } }));
    } else {
      await cache.delete('shared-meta');
    }
    return Response.redirect('/chat?share=1', 303);
  } catch (_e) { // NOSONAR - share must redirect to chat even if cache fails, error intentionally ignored
    return Response.redirect('/chat?share=1', 303);
  }
}
