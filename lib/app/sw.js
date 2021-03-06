self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Make sure some files aren't cached
  if (/^\/test|^\/info|\/manifest\.json$|livereload\.js$/.test(url.pathname)) {
    event.respondWith(fetch(event.request));
  }
});
self.addEventListener('error', onUnhandledError);
self.addEventListener('unhandledrejection', onUnhandledError);

async function onUnhandledError(event) {
  // throw Error('Panic! Unhandled error');
  const clients = await self.clients.matchAll();

  clients.forEach(client => {
    client.postMessage({ error: `unhandled error: ${event.reason || event}` });
  });
}