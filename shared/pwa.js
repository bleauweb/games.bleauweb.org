// Two small things every page does:
// 1. Register the service worker that makes the suite work offline (generated at build time
//    by scripts/make-sw.mjs; nothing is registered in dev, where files change constantly).
// 2. Note that this game or tool was opened, so the hub can sort by recently and most played.
if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
  });
}

const m = /^\/(games|tools)\/([a-z0-9-]+)\/?/.exec(location.pathname);
if (m) {
  try {
    const KEY = 'bleauweb.hub.v1';
    const hub = JSON.parse(localStorage.getItem(KEY) || '{}');
    hub.plays = hub.plays || {};
    const rec = hub.plays[m[2]] || { count: 0, last: 0 };
    rec.count += 1;
    rec.last = Date.now();
    hub.plays[m[2]] = rec;
    localStorage.setItem(KEY, JSON.stringify(hub));
  } catch {
    // storage unavailable: the hub just will not know
  }
}
