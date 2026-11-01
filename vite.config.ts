import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: [
        "favicon.svg",
        "apple-touch-icon.png",
        "pwa-192.png",
        "pwa-512.png",
        "pwa-512-maskable.png",
      ],
      manifest: {
        name: "Drivly",
        short_name: "Drivly",
        description:
          "Carnet de bord automobile : pleins, entretiens, dépenses et rappels. Local-first, installable, hors ligne.",
        lang: "fr",
        dir: "ltr",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "portrait",
        background_color: "#F4F6F8",
        theme_color: "#F4F6F8",
        categories: ["lifestyle", "utilities", "productivity"],
        prefer_related_applications: false,
        icons: [
          {
            src: "pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff2,json}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/health$/],
        importScripts: ["push-sw.js"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern:
              /^https:\/\/cdn\.jsdelivr\.net\/gh\/filippofilip95\/car-logos-dataset@.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "brand-logos",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: "classic",
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
})
