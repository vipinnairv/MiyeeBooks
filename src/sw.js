// MiyeeBooks service worker  makes the app installable and usable offline.
// ----------------------------------------------------------------------------
// The app is fully client-side, so once the shell and its libraries are cached
// the whole thing runs with no network - which is what an MSME owner needs when
// they open it on a patchy connection at a counter or in transit.
//
// Strategy:
//   * navigations (the HTML page)  -> network-first, fall back to cache offline,
//     so a fresh deploy is always picked up when online but the app still opens
//     when it isn't.
//   * everything else (hashed app JS/CSS, CDN libraries, fonts) -> stale-while-
//     revalidate: serve the cached copy instantly and refresh it in the
//     background. The app's ?v=<hash> filenames mean a changed file is a new
//     URL, so this never serves stale code.
// User data is NOT the SW's job - it lives in IndexedDB/localStorage and, when
// signed in, Firestore. The SW only caches the program, never the books.
const CACHE = 'miyeebooks-shell-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.add('./').catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Do not touch Firebase/Firestore/Storage or the Anthropic API: those are
  // live data + auth calls that must always hit the network.
  const url = new URL(req.url);
  if (/firebase|firestore|googleapis|gstatic|anthropic\.com/.test(url.host)) return;

  const isNav = req.mode === 'navigate'
    || (req.headers.get('accept') || '').includes('text/html');

  if (isNav) {
    event.respondWith(
      fetch(req)
        .then((res) => { cachePut(req, res.clone()); return res; })
        .catch(() => caches.match(req).then((c) => c || caches.match('./')))
    );
    return;
  }

  // stale-while-revalidate for assets
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => { cachePut(req, res.clone()); return res; })
        .catch(() => cached);
      return cached || network;
    })
  );
});

function cachePut(req, res) {
  // Cache successful and opaque (cross-origin CDN) responses so offline works.
  if (res && (res.ok || res.type === 'opaque')) {
    caches.open(CACHE).then((c) => c.put(req, res)).catch(() => {});
  }
}
