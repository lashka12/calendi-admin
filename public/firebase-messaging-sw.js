// Service worker for PWA + Push Notifications
// No offline caching - app requires internet connection

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
  
  // Read from data (we send data-only messages to avoid duplicates)
  const data = payload.data || {};
  const title = data.title || 'New Request';
  const body = data.body || 'A new booking request requires your attention';
  
  self.registration.showNotification(title, {
    body: body,
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

// PWA lifecycle events
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Pass through all fetch requests to network (no caching)
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
