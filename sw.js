// Daylign service worker — network-first with cache fallback.
// Online: every request hits the network (no stale code), responses refresh the cache.
// Offline: the cached app shell serves, and data loads from localStorage.
const CACHE = 'daylign-v93';
const ASSETS = [
  '.',
  'index.html',
  'style.css',
  'manifest.json',
  'js/utils.js',
  'js/state.js',
  'js/modal.js',
  'js/dashboard.js',
  'js/tasks.js',
  'js/board.js',
  'js/calendar.js',
  'js/gym.js',
  'js/cardio.js',
  'js/training.js',
  'js/strength.js',
  'js/coach.js',
  'js/brief.js',
  'js/settings-prefs.js',
  'js/layout.js',
  'js/insights.js',
  'js/sleep.js',
  'js/today.js',
  'js/weight-sheet.js',
  'js/collapsible.js',
  'js/preferences.js',
  'js/ai-usage.js',
  'js/diet-data.js',
  'js/diet-core.js',
  'js/diet-view.js',
  'js/diet-food.js',
  'js/diet-goals.js',
  'js/food-photo.js',
  'js/pull-refresh.js',
  'js/voice.js',
  'js/app.js',
  'js/onboarding.js',
  'js/enhancements.js',
  'js/firebase-sync.js',
  // Without this the profile gate never loads offline and startup throws.
  'js/profile.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Only handle same-origin GETs — Firebase/API traffic passes straight through
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // `fetch(e.request)` uses the DEFAULT cache mode, which consults the browser
  // HTTP cache first. GitHub Pages serves these assets with max-age=600, so for
  // ten minutes after a deploy that cache answers with the OLD file, the SW
  // never reaches the server, and it then stores that stale copy in its own
  // cache too — an update could be invisible even after a reload. Forcing
  // 'no-cache' revalidates with the server every time; unchanged files come
  // back as a cheap 304, so this costs almost nothing but guarantees freshness.
  e.respondWith(
    fetch(new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }))
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((m) => m || caches.match('index.html'))
      )
  );
});
