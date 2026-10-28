import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Actions passes the Pages base path (e.g. `/clock/`); local builds use the root.
function basePath(): string {
  const raw = process.env.BASE_PATH?.trim() || '/'
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`
}

const base = basePath()

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // Updates wait for the user (see usePwaUpdate) so an active timer is never reloaded.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: base,
        name: 'Whale Focus',
        short_name: 'Whale Focus',
        description: 'A Pomodoro-style focus timer where Whale-chan earns a bowl of rice for every finished session.',
        lang: 'en',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fffaf0',
        theme_color: '#fffaf0',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Must match APP_ID in src/adapters/app-id.ts. Cache cleanup never touches localStorage.
        cacheId: 'whale-focus',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
})
