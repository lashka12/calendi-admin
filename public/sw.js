// Service worker for PWA + Push Notifications
// Minimal caching - only offline page for graceful degradation

const CACHE_NAME = 'calendi-offline-v1';
const OFFLINE_URL = '/offline.html';

// Import Firebase scripts for push notifications
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Initialize Firebase in service worker
firebase.initializeApp({
  apiKey: "AIzaSyA9AcvY6S2AB_sPUh8QxID-S10TANMgfbs",
  authDomain: "bussiness-managment-syst-da008.firebaseapp.com",
  projectId: "bussiness-managment-syst-da008",
  storageBucket: "bussiness-managment-syst-da008.firebasestorage.app",
  messagingSenderId: "333252803339",
  appId: "1:333252803339:web:74b350a22eeb5f584fc00e"
});

const messaging = firebase.messaging();

// Handle background push notifications (when app is not in focus)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);
  
  const { title, body } = payload.notification || {};
  const data = payload.data || {};
  
  self.registration.showNotification(title || 'New Request', {
    body: body || 'You have a new booking request',
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    vibrate: [200, 100, 200],
    tag: 'new-request', // Replaces previous notification of same tag
    renotify: true,
    data: {
      url: data.url || '/requests' // URL to open when notification clicked
    }
  });
});

// Handle notification click - open the app to requests page
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/requests';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // If not open, open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// PWA lifecycle events - cache offline page on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.add(new Request(OFFLINE_URL, { cache: 'reload' }));
    })
  );
  self.skipWaiting();
});

// Clean up old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => clients.claim())
  );
});

// Network-first strategy: try network, fallback to offline page on failure
self.addEventListener('fetch', (event) => {
  // Only handle navigation requests (HTML pages)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Network failed, show offline page
          return caches.open(CACHE_NAME).then((cache) => {
            return cache.match(OFFLINE_URL);
          });
        })
    );
    return;
  }
  
  // For all other requests (JS, CSS, images, API calls), just try network
  event.respondWith(
    fetch(event.request).catch(() => {
      // Return empty response for non-navigation requests that fail
      return new Response('', { status: 503, statusText: 'Service Unavailable' });
    })
  );
});
