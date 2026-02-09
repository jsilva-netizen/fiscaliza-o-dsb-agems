// Service Worker para PWA Offline
// Uso: Este arquivo deve ser servido como /sw.js na raiz do projeto

const CACHE_VERSION = 'agems-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Assets que devem ser precacheados
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// ===== INSTALL =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.log('Some assets failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheName.startsWith(CACHE_VERSION)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ===== FETCH: Estratégia de cache =====
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Assets estáticos: Cache First
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'image'
  ) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) return response;
        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        }).catch(() => {
          // Se offline e não tem cache, retornar erro
          return new Response('Offline - Recurso não disponível', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
    );
    return;
  }

  // API calls: Network First
  if (url.pathname.includes('/api')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((response) => {
            if (response) return response;
            return new Response(JSON.stringify({ offline: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // HTML pages: Network First
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((response) => {
            if (response) return response;
            return caches.match('/index.html');
          });
        })
    );
    return;
  }

  // Default: Network First
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// ===== BACKGROUND SYNC =====
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-fiscalizacao-data') {
    event.waitUntil(handleBackgroundSync());
  }
  if (event.tag === 'sync-fiscalizacao-photos') {
    event.waitUntil(handlePhotoSync());
  }
});

async function handleBackgroundSync() {
  try {
    // Notificar que sincronização começou
    self.registration.showNotification('Sincronizando...', {
      body: 'Enviando dados offline para o banco',
      icon: '/icons/icon-192x192.png',
      tag: 'sync-progress',
      silent: true
    });

    // Notificar cliente de que sync começou
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'sync-started' });
    });
  } catch (error) {
    console.error('Background sync error:', error);
  }
}

async function handlePhotoSync() {
  try {
    self.registration.showNotification('Upload de fotos...', {
      body: 'Enviando fotos para o servidor',
      icon: '/icons/icon-192x192.png',
      tag: 'photo-sync',
      silent: true
    });
  } catch (error) {
    console.error('Photo sync error:', error);
  }
}

// ===== PERIODIC SYNC =====
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-reference-data') {
    event.waitUntil(updateReferenceData());
  }
});

async function updateReferenceData() {
  try {
    self.registration.showNotification('Atualizando dados...', {
      body: 'Dados de referência sendo atualizados',
      icon: '/icons/icon-192x192.png',
      tag: 'reference-update',
      silent: true
    });
  } catch (error) {
    console.error('Periodic sync error:', error);
  }
}

// ===== NOTIFICATION CLICK =====
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { action } = event;
  const data = event.notification.data || {};

  let targetUrl = '/';

  if (action === 'retry-sync') {
    event.waitUntil(self.registration.sync.register('sync-fiscalizacao-data'));
    return;
  }

  if (action === 'view-details' || action === 'view-errors') {
    targetUrl = '/Fiscalizacoes?showSync=true';
  } else if (data.type?.includes('sync')) {
    targetUrl = '/Fiscalizacoes';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if (targetUrl !== '/') client.navigate(targetUrl);
          return;
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

// ===== MESSAGE HANDLER =====
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});