import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Installable app (home screen icon, full screen) with a service worker.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['App-logo.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'myWorkSchedule',
        short_name: 'Schedule',
        description: 'Work shifts of the bar',
        start_url: '/',
        display: 'standalone',
        background_color: '#faf9fc',
        theme_color: '#faf9fc',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // The app shell is precached; API calls are never answered with index.html.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Bar data the app reads, so the last loaded schedule can be shown
            // offline. Admin routes and all writes always go to the network.
            // This function is copied into sw.js as text, so it can't use
            // anything defined outside it.
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              url.origin === self.location.origin &&
              /^\/api\/(me|bar|employees|shifts|schedule-weeks|day-orders)(\/|$)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 200, maxAgeSeconds: 14 * 24 * 60 * 60 }
            }
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './testSetup.js'
  }
})
