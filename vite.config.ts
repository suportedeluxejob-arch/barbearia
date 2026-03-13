import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: 'Intacto Men Barbershop',
          short_name: 'Intacto',
          description: 'Agende seu horário na Intacto Men Barbershop',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    // Inject env vars into the service worker at build time via global defines
    define: {
      'self.__FIREBASE_API_KEY__': JSON.stringify(env.VITE_FIREBASE_API_KEY || ''),
      'self.__FIREBASE_AUTH_DOMAIN__': JSON.stringify(env.VITE_FIREBASE_AUTH_DOMAIN || ''),
      'self.__FIREBASE_PROJECT_ID__': JSON.stringify(env.VITE_FIREBASE_PROJECT_ID || ''),
      'self.__FIREBASE_STORAGE_BUCKET__': JSON.stringify(env.VITE_FIREBASE_STORAGE_BUCKET || ''),
      'self.__FIREBASE_MESSAGING_SENDER_ID__': JSON.stringify(env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''),
      'self.__FIREBASE_APP_ID__': JSON.stringify(env.VITE_FIREBASE_APP_ID || ''),
    }
  };
});
