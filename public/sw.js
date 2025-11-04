const CACHE_NAME = 'otel-yonetim-v3';
// GitHub Pages alt dizinlerinde doğru çalışması için relatif yollar kullan
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './logo192.png',
  './logo512.png',
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('Cache install failed:', error);
      })
  );
  // Yeni sürümün hemen kontrolü devralması için
  self.skipWaiting();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Navigasyon isteklerinde network-first: güncel index.html’i al, yoksa cache’e dön
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          // Güncel index’i cache’e koy
          const cache = await caches.open(CACHE_NAME);
          cache.put('./index.html', networkResponse.clone());
          return networkResponse;
        } catch (err) {
          // Offline veya hata: cache’teki index.html’e dön
          const cached = await caches.match('./index.html');
          if (cached) return cached;
          throw err;
        }
      })()
    );
    return;
  }

  // Diğer isteklerde cache-first, yoksa network ve başarılıysa cache’e ekle
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        // İkon/manifest gibi isteklerde hata varsa özel bir fallback yok; hatayı yüzeye çıkar
        throw err;
      }
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Yeni SW’in tüm client’ları hemen kontrol etmesi için
  self.clients.claim();
});