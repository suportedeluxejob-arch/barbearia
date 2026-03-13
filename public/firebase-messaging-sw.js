// Firebase Cloud Messaging Service Worker
// This file handles background push notifications when the app is not open
// NOTE: Vite env vars are not available in service workers.
//       The config values here must match your .env file.
//       The VAPID key is handled separately in the main app via getToken().

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// These values come from your .env — keep them in sync if you change project.
// Service Workers run outside Vite's module system so they cannot use import.meta.env.
firebase.initializeApp({
  apiKey: self.__FIREBASE_API_KEY__ || '',
  authDomain: self.__FIREBASE_AUTH_DOMAIN__ || '',
  projectId: self.__FIREBASE_PROJECT_ID__ || '',
  storageBucket: self.__FIREBASE_STORAGE_BUCKET__ || '',
  messagingSenderId: self.__FIREBASE_MESSAGING_SENDER_ID__ || '',
  appId: self.__FIREBASE_APP_ID__ || ''
});

const messaging = firebase.messaging();

// Handle background push messages
messaging.onBackgroundMessage(function(payload) {
  const title = payload.notification?.title || 'Barbearia';
  const body = payload.notification?.body || '';
  
  self.registration.showNotification(title, {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    vibrate: [200, 100, 200],
    tag: 'barbershop-notification',
    data: { url: '/' }
  });
});

// Open app when notification is clicked
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
