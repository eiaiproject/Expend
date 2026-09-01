self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname === '/share') {
    event.respondWith(handleShare(event));
  }
});

async function handleShare(event) {
  try {
    const formData = await event.request.formData();
    const file = formData.get('receipt');
    const text = formData.get('text');
    const title = formData.get('title');
    const url = formData.get('url');
    const cache = await caches.open('share-cache');
    if (file && file instanceof File && file.size > 0) {
      const buf = await file.arrayBuffer();
      await cache.put('shared-file', new Response(buf, { headers: { 'content-type': file.type || 'image/png', 'x-file-name': encodeURIComponent(file.name || 'receipt.png') } }));
    }
    if (text || title || url) {
      await cache.put('shared-meta', new Response(JSON.stringify({ title: text || title || '', text: text || '', url: url || '' }), { headers: { 'content-type': 'application/json' } }));
    } else if (!file || !(file instanceof File) || file.size === 0) {
      await cache.delete('shared-file');
    }
    return Response.redirect('/chat?share=1', 303);
  } catch (e) {
    return Response.redirect('/chat?share=1', 303);
  }
}
