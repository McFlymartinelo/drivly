# Aura dans Drivly

## 1. Importer le CSS

```ts
import "./aura/aura.css"
```

## 2. Envelopper l'application

```tsx
import { ThemeProvider, Screen, AppBar, BottomTabs } from "./aura/react"

export function Root() {
  return (
    <ThemeProvider defaultTheme="system" defaultAccent="teal">
      <div className="aura-app">
        <div className="aura-frame">
          <AppBar title="Drivly" />
          <Screen>{/* écrans */}</Screen>
        </div>
      </div>
    </ThemeProvider>
  )
}
```

## 3. PWA

- Manifest : `public/manifest.webmanifest` (déjà copié).
- Icônes : `src/aura/pwa/icons/` + `npx @vite-pwa/assets-generator`.
- Config Vite : voir `src/aura/pwa/vite-plugin-pwa.snippet.ts`.
- Config Next : voir `src/aura/pwa/next-manifest.ts`.

## Règles

1. Jamais de couleur en dur dans un écran : utiliser les tokens `--aura-*`.
2. Une seule carte héro par écran.
3. Cibles tactiles ≥ 44 px, safe areas respectées.
4. `prefers-reduced-motion` respecté (déjà géré par le CSS).
