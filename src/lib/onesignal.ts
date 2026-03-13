// OneSignal integration using CDN (window.OneSignalDeferred pattern for v16)
// SDK is loaded via <script> in index.html

declare global {
  interface Window {
    OneSignalDeferred: Array<(OneSignal: any) => void>;
    OneSignal: any;
  }
}

const APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || '';
const REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY || '';

let initialized = false;

/**
 * Initialize OneSignal and link device to user's Firebase UID.
 * Uses OneSignalDeferred queue (required for v16 CDN SDK).
 */
export function initOneSignal(firebaseUid: string): void {
  if (!APP_ID || initialized || typeof window === 'undefined') return;
  initialized = true;

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      await OneSignal.init({
        appId: APP_ID,
        serviceWorkerPath: '/OneSignalSDKWorker.js',
        notifyButton: { enable: false },
        allowLocalhostAsSecureOrigin: true,
      });
      // Link device to Firebase UID so we can target by UID
      await OneSignal.login(firebaseUid);
      // Ask permission
      await OneSignal.Notifications.requestPermission();
    } catch (err) {
      console.error('OneSignal init error:', err);
    }
  });
}

/**
 * Send push notification to a specific user by their Firebase UID.
 */
export async function sendPushToUser(
  targetUid: string,
  title: string,
  message: string
): Promise<void> {
  if (!APP_ID || !REST_API_KEY) return;
  try {
    await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: APP_ID,
        include_aliases: { external_id: [targetUid] },
        target_channel: 'push',
        headings: { en: title, pt: title },
        contents: { en: message, pt: message },
        small_icon: 'pwa-192x192',
        android_accent_color: 'FFe53935',
      }),
    });
  } catch (err) {
    console.error('Failed to send OneSignal push:', err);
  }
}

/**
 * Send push notification to multiple users (admins/barbers).
 */
export async function sendPushToAdmins(
  adminUids: string[],
  title: string,
  message: string
): Promise<void> {
  if (!APP_ID || !REST_API_KEY || adminUids.length === 0) return;
  try {
    await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: APP_ID,
        include_aliases: { external_id: adminUids },
        target_channel: 'push',
        headings: { en: title, pt: title },
        contents: { en: message, pt: message },
        small_icon: 'pwa-192x192',
        android_accent_color: 'FFe53935',
      }),
    });
  } catch (err) {
    console.error('Failed to send push to admins:', err);
  }
}
