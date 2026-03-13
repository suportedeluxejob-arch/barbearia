import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { app, db } from './firebase';

// Your VAPID key from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
// You need to generate one if you haven't yet.
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

let messaging: ReturnType<typeof getMessaging> | null = null;

function getMessagingInstance() {
  if (!messaging) {
    messaging = getMessaging(app);
  }
  return messaging;
}

/**
 * Requests notification permission and saves the FCM token to Firestore.
 * Call this after a user logs in.
 */
export async function requestAndSaveToken(userId: string): Promise<string | null> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications.');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('Notification permission denied.');
    return null;
  }

  try {
    const m = getMessagingInstance();
    // Register service worker for background push
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(m, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    
    if (token) {
      // Save to user's Firestore document
      await updateDoc(doc(db, 'users', userId), { fcmToken: token });
      return token;
    }
    return null;
  } catch (err) {
    console.error('Failed to get FCM token:', err);
    return null;
  }
}

/**
 * Listen for foreground push messages and show native notifications.
 */
export function listenForMessages(onNotif: (title: string, body: string) => void) {
  try {
    const m = getMessagingInstance();
    return onMessage(m, (payload) => {
      const title = payload.notification?.title || 'Barbearia';
      const body = payload.notification?.body || '';
      // Show as native notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/pwa-192x192.png' });
      }
      onNotif(title, body);
    });
  } catch {
    return () => {};
  }
}
