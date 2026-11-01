# Aura Notify

Notifications in-app et push Web, avec un style paramétrable.

| Couche | Contenu | Dépendances |
|---|---|---|
| `notify.css` | styles `instrument`, `banner`, `card` | aucune |
| `react/` | `NotifyProvider`, `useNotify`, client push VAPID | React |
| `server/` | abonnements, calendrier, envoi | `web-push` (optionnel) |
| `sw/` | service worker push | aucune |

Le style **`auto`** choisit `instrument` sur Android et `banner` sur iOS.
Le rendu final du push reste celui du système : on contrôle l'icône, le titre,
le corps, les actions Android, le `tag` et le son — pas la mise en page.

---

## Installation

```bash
node <chemin>/cli/aura.mjs add notify --dir <projet>
# ou
node <chemin>/cli/aura.mjs init --dir <projet> --stack vite --notify
```

Importer le CSS **après** `aura.css` :

```ts
import "./aura/aura.css"
import "./aura/notify/notify.css"
```

---

## In-app

```tsx
import { NotifyProvider, useNotify } from "./aura/notify/react"

export function Root() {
  return (
    <NotifyProvider appName="Mon App" style="auto">
      <App />
    </NotifyProvider>
  )
}

function SaveButton() {
  const { notify } = useNotify()

  return (
    <button
      onClick={() =>
        notify({
          title: "Sauvegarde",
          message: "La copie serveur est à jour.",
          tone: "success",
          action: { label: "Voir", onClick: () => {} },
        })
      }
    >
      Enregistrer
    </button>
  )
}
```

Options :

| Option | Rôle |
|---|---|
| `title` | libellé court (kicker en instrument, titre en carte/bandeau) |
| `message` | texte principal |
| `tone` | `info`, `success`, `warn`, `danger` |
| `duration` | ms ; `0` = persistante |
| `action` | `{ label, onClick }` |
| `tag` | remplace une notification existante |
| `icon` | icône React (carte) |

Styles :

```tsx
<NotifyProvider style="instrument" /> // rail d'accent, bas
<NotifyProvider style="banner" />     // pleine largeur, haut (iOS)
<NotifyProvider style="card" />       // carte avec icône
<NotifyProvider style="auto" />       // Android → instrument, iOS → banner
```

Le provider expose `resolvedStyle` et `setStyle` pour un sélecteur de réglages.
La position est `bottom` par défaut ; le bandeau force `top`.

---

## Push Web

### 1. Service worker

Avec `vite-plugin-pwa` (`generateSW`), ajouter le script :

```ts
// vite.config.ts
VitePWA({
  workbox: {
    importScripts: ["push-sw.js"],
  },
  devOptions: { enabled: true, type: "classic" },
})
```

Copier `notify/sw/push-sw.js` dans `public/`. Le service worker gère :
`push`, `notificationclick`, `pushsubscriptionchange`, et relaie l'événement
aux onglets (`AURA_PUSH`, `AURA_NAV`).

> Le push ne se teste pas dans le serveur de dev : le SW de dev n'inclut pas
> `importScripts`. Utiliser un build de production (ou l'app installée).

### 2. Client

```ts
import { createPushClient } from "./aura/notify/react"

const push = createPushClient({
  apiBase: "/api",
  getHeaders: () => ({ Authorization: `Bearer ${token}` }),
})

const result = await push.enable()
// { ok: false, reason: "ios-install" | "vapid" | "denied" | ... }

await push.test()
await push.disable()
```

Le client expose `status()`, `enable()`, `disable()`, `sync()`, `test()`,
`showLocal()`. Il détecte iOS et le mode standalone.

**iOS** : le push n'existe que dans la PWA installée (iOS 16.4+). Si
`status.needsInstall`, afficher : « Partager → Sur l'écran d'accueil ».

### 3. Serveur

```js
import { createPushService } from "./aura/notify/server/index.mjs"
import { createWebPushSender } from "./aura/notify/server/webpush.mjs"

const sender = await createWebPushSender({
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: "mailto:admin@exemple.fr",
})

const push = createPushService({
  db, // get / all / run
  sender,
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  appName: "Mon App",
})
```

Routes à exposer (avec ta session) :

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/push/vapid` | `{ configured, publicKey }` (public) |
| POST | `/push/subscribe` | `{ endpoint, keys }` |
| POST | `/push/unsubscribe` | `{ endpoint }` |
| POST | `/push/test` | envoie une notification test |
| POST | `/notifications/schedule` | `{ items: [{ key, at, title, body, url, tag }] }` |

Le **client calcule ses échéances** (rappels, prévision de plein) et les envoie.
Le serveur ne lit pas les données métier : il stocke le calendrier et envoie à
l'heure. C'est ce qui permet de rester local-first.

Envoi périodique :

```js
setInterval(() => push.sendDue().catch(console.error), 5 * 60_000)
```

`sendDue()` envoie les éléments dont `at <= maintenant`, marque `sent_at`,
supprime les abonnements expirés (404/410/403) et abandonne après 5 échecs.

Le schéma SQL est dans `notify/server/schema.sql` (tables préfixées `aura_`).

---

## Configuration

| Variable | Rôle |
|---|---|
| `VAPID_PUBLIC_KEY` | clé publique (exposée au client) |
| `VAPID_PRIVATE_KEY` | clé privée (serveur uniquement) |
| `VAPID_SUBJECT` | `mailto:` ou URL de contact |

Générer une paire :

```bash
npx web-push generate-vapid-keys
```

`web-push` est la seule dépendance du module, et uniquement côté serveur.
Pour rester sans dépendance, passer un `sender` maison à `createPushService`.

---

## Limites

- Pas de push sur iOS hors PWA installée.
- Pas de notification si l'app n'a pas été ouverte récemment : le calendrier
  est calculé côté client (local-first). Les échéances déjà envoyées restent
  stockées côté serveur.
- Les actions de notification sont limitées à 2 sur Android, 0 sur iOS.
- Le service worker de dev n'inclut pas le push : tester en production.
