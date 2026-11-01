# PWA — check-list Aura

## Icônes

Le kit fournit deux SVG sources :

- `icons/aura-icon.svg` — icône classique
- `icons/aura-icon-maskable.svg` — zone sûre Android

Générer tous les PNG en une commande (Vite ou Next) :

```bash
npx @vite-pwa/assets-generator@latest \
  --preset minimal \
  public/aura-icon.svg
```

Puis vérifier dans `public/` : `pwa-192.png`, `pwa-512.png`,
`pwa-512-maskable.png`, `apple-touch-icon.png`, `favicon.svg`.

Alternative sans Node : <https://www.pwabuilder.com/imageGenerator>.

## Manifest

- `display: "standalone"` (pas `fullscreen` : casse les gestes système).
- `id: "/"` + `scope: "/"` pour éviter les doublons d'installation.
- `theme_color` = couleur de la barre système ; `background_color` = écran de
  démarrage. Les deux doivent correspondre aux tokens `--aura-bg` / `--aura-ink`.
- `screenshots` : ajouter 2 captures (mobile + desktop) pour la fiche
  d'installation. Format conseillé : 1080×1920 et 1920×1080.
- `shortcuts` : 2 à 3 actions fréquentes (nouveau, recherche, réglages).

## Service worker

- Vite : `vite-plugin-pwa` (voir `vite-plugin-pwa.snippet.ts`).
- Next : `@serwist/next` (remplace next-pwa, maintenu).
- Ne jamais mettre en cache les routes d'API privées sans stratégie explicite.
- Prévoir une page `offline.html` et la déclarer dans `navigateFallback`.

## Installation

- Chrome/Edge/Android : `beforeinstallprompt` + `PwaInstallCard`.
- iOS : pas d'API ; afficher « Partager → Sur l'écran d'accueil ».
- Vérifier `start_url` en mode avion après installation.

## Test

```bash
npm run build && npm run preview
# DevTools → Application → Manifest / Service Workers
# Lighthouse → PWA (installable, offline)
```
