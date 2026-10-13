// Registers the service worker that makes the whole suite work offline. The worker itself is
// generated at build time (scripts/make-sw.mjs) with a list of every page and asset. In dev
// there is no worker: files change too often to cache.
if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
  });
}
