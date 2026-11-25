import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/[/\\]node_modules[/\\](?:react|react-dom|scheduler)[/\\]/.test(id)) return 'react-vendor';
          if (/[/\\]node_modules[/\\]react-router(?:-dom)?[/\\]/.test(id)) return 'router-vendor';
          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'TalkReady',
        short_name: 'TalkReady',
        description: 'Offline-first mock interview practice',
        theme_color: '#4f46e5',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/talkready-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,json,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\/api\/auth(?:\/|$)/,
            handler: 'NetworkOnly',
            method: 'GET',
          },
          {
            urlPattern: /\/api\/(?:.*)/,
            handler: 'NetworkOnly',
            method: 'POST',
          },
          {
            urlPattern: /\/api\/(?:.*)/,
            handler: 'NetworkOnly',
            method: 'PUT',
          },
          {
            urlPattern: /\/api\/(?:.*)/,
            handler: 'NetworkOnly',
            method: 'DELETE',
          },
          {
            urlPattern: /\/api\/questions(?:\/.*)?$/,
            handler: 'StaleWhileRevalidate',
            method: 'GET',
            options: {
              cacheName: 'talkready-questions-v1',
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\/api\/(?:health|reports)(?:\/.*)?$/,
            handler: 'NetworkOnly',
            method: 'GET',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    restoreMocks: true,
  },
});
