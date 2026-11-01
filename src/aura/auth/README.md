# Aura Auth

Authentification complète pour une app Aura : inscription, connexion, code
OTP par email, mot de passe oublié, session et profil.

Deux couches indépendantes :

| Couche | Contenu | Dépendances |
|---|---|---|
| `server/` | service + OTP + sessions + adaptateurs SQLite / Express / Web | aucune (Node natif) |
| `react/` | `AuthProvider`, `useAuth`, `AuthScreen`, client HTTP typé | React + Aura |

Le serveur ne dépend ni d'Express ni de SQLite : on lui passe une base
(`get` / `all` / `run`) et un mailer. Les adaptateurs ne font que traduire
HTTP.

---

## Installation

```bash
# dans un projet où Aura est déjà installé
node <chemin>/cli/aura.mjs add auth --dir <projet>

# ou directement à l'init
node <chemin>/cli/aura.mjs init --dir <projet> --stack vite --auth
```

Fichiers copiés dans `src/aura/auth/` :

```
auth/
├── auth.css                  # styles de l'écran (à importer après aura.css)
├── server/
│   ├── index.mjs             # createAuthService + utilitaires
│   ├── service.mjs           # flux métier
│   ├── schema.sql            # tables aura_users / aura_email_otps
│   ├── adapters/
│   │   ├── sqlite.mjs        # node:sqlite (Node 22.5+)
│   │   ├── express.mjs       # routeur Express
│   │   ├── node.mjs          # serveur node:http natif
│   │   └── web.mjs           # handler Request → Response (Next, Hono…)
│   └── test/                 # tests node:test
└── react/
    ├── AuthClient.ts         # contrat + client HTTP
    ├── AuthProvider.tsx      # contexte, session, actions
    ├── AuthScreen.tsx        # connexion / inscription / OTP / reset
    └── index.ts
```

Variables d'environnement :

```bash
AUTH_SECRET=...            # obligatoire, 32 caractères minimum
AUTH_APP_NAME="Mon App"    # optionnel (emails + écran)
AUTH_OTP_ON_LOGIN=true     # OTP à chaque connexion (défaut : true)
AUTH_OTP_ECHO=false        # renvoie le code au client — dev uniquement
AUTH_SECURE_COOKIES=true   # forcé en production
AUTH_SESSION_TTL=2592000   # secondes (30 jours par défaut)
```

Générer le secret :

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

---

## Démarrage Express

```js
// server/index.js
import express from "express"
import { createAuthService } from "./src/aura/auth/server/index.mjs"
import { createSqliteDb } from "./src/aura/auth/server/adapters/sqlite.mjs"
import { createExpressAuthRouter } from "./src/aura/auth/server/adapters/express.mjs"
import { createResendMailer } from "./src/aura/auth/server/mailer.mjs"

const db = createSqliteDb({ file: "./data/app.db" })

const auth = createAuthService({
  db,
  mailer: createResendMailer({
    apiKey: process.env.RESEND_API_KEY,
    from: "Mon App <noreply@mon-app.fr>",
    appName: "Mon App",
  }),
  config: { appName: "Mon App" }, // AUTH_SECRET vient de l'env
})

const app = express()
app.use(
  "/api/auth",
  createExpressAuthRouter(auth, {
    cors: "http://localhost:5173", // cookies ⇒ origine explicite obligatoire
  }),
)
```

Côté Vite, deux options :

```ts
// vite.config.ts — proxy same-origin, le plus simple
server: {
  proxy: { "/api": "http://localhost:3000" },
},
```

ou CORS avec credentials :

```ts
// côté client
createHttpAuthClient({ baseUrl: "http://localhost:3000/api/auth" })
// + fetch en credentials: "include" (déjà géré par le client)
```

---

## Démarrage Next.js (App Router)

```ts
// lib/auth.ts
import { createAuthService } from "@/aura/auth/server"
import { createSqliteDb } from "@/aura/auth/server/adapters/sqlite.mjs"

const db = createSqliteDb({ file: "./data/app.db" })

export const auth = createAuthService({ db, config: { appName: "Mon App" } })
```

```ts
// app/api/auth/[...all]/route.ts
import { createWebAuthHandler } from "@/aura/auth/server/adapters/web.mjs"
import { auth } from "@/lib/auth"

const handler = createWebAuthHandler(auth)

export const GET = handler
export const POST = handler
export const PATCH = handler
```

En production serverless, `:memory:` ne convient pas : utilise une base
persistante (Turso/libSQL, Postgres via un adaptateur maison) et un mailer HTTP.

---

## Démarrage node:http (sans Express)

```js
import http from "node:http"
import { createAuthService } from "./src/aura/auth/server/index.mjs"
import { createSqliteDb } from "./src/aura/auth/server/adapters/sqlite.mjs"
import { createNodeAuthHandler } from "./src/aura/auth/server/adapters/node.mjs"

const db = createSqliteDb({ file: "./data/app.db" })
const auth = createAuthService({ db, config: { appName: "Mon App" } })
const handleAuth = createNodeAuthHandler(auth, { basePath: "/api/auth" })

const server = http.createServer(async (req, res) => {
  if (await handleAuth(req, res)) return
  res.writeHead(404).end()
})
```

`handleAuth` renvoie `true` quand la requête concerne `/api/auth`, `false`
sinon : le reste du routeur continue normalement.

---

## Client React

```tsx
import "./aura/auth/auth.css"
import { AuthProvider, AuthScreen, useAuth } from "./aura/auth/react"
import { createHttpAuthClient } from "./aura/auth/react"

const client = createHttpAuthClient({ baseUrl: "/api/auth" })

export function Root() {
  return (
    <AuthProvider client={client}>
      <Gate />
    </AuthProvider>
  )
}

function Gate() {
  const { status } = useAuth()
  if (status === "loading") return null
  if (status === "anonymous") {
    return <AuthScreen appName="Mon App" onSuccess={() => {}} />
  }
  return <App />
}
```

`AuthScreen` gère seul les étapes : connexion, inscription, code OTP,
mot de passe oublié, nouveau mot de passe. Il affiche le code en clair quand
`echoOtp` est actif (développement uniquement).

Actions disponibles via `useAuth()` :

```ts
const {
  user, status, error,
  signIn, signUp, verifyOtp, resendOtp,
  forgotPassword, resetPassword,
  signOut, refresh, changePassword, updateProfile,
} = useAuth()
```

Mode mobile / Expo (token au lieu du cookie) :

```ts
createHttpAuthClient({ mode: "bearer", baseUrl: "https://api.exemple.fr/api/auth" })
```

Dans ce cas, côté serveur : `config: { exposeToken: true }` et
`allowTokenInProduction: true` (explicite, car le token quitte le cookie
httpOnly).

---

## Configuration

| Option | Défaut | Rôle |
|---|---|---|
| `secret` | `AUTH_SECRET` | signature des tokens et poivre des OTP |
| `appName` | `Aura` | emails et écran |
| `requireOtpOnLogin` | `true` | code à chaque connexion |
| `requireEmailVerification` | `true` | vérifier l'email à l'inscription |
| `minPasswordLength` | `8` | validation |
| `sessionTtlSeconds` | 30 jours | durée de session |
| `otpTtlMs` | 10 min | validité du code |
| `otpMaxAttempts` | 5 | essais avant invalidation |
| `otpResendMs` | 30 s | cooldown de renvoi |
| `cookieName` | `aura_session` | nom du cookie |
| `cookieSameSite` | `Lax` | `None` exige HTTPS |
| `secureCookies` | prod | cookie `Secure` |
| `exposeToken` | `false` | renvoyer le token dans le JSON |
| `echoOtp` | `false` | renvoyer `devOtp` (jamais en prod) |
| `rateLimitMax` | 20 / 15 min | tentatives par IP |
| `rateLimitOtpMax` | 8 / 15 min | envois d'OTP par IP |
| `registrationCode` | `null` | code exigé pour créer un compte (serveur privé) |

`resolveConfig` refuse un secret faible en production et interdit
`echoOtp` / `exposeToken` implicites.

---

## Contrat d'API

Toutes les réponses sont du JSON. Les erreurs suivent
`{ error, code, retryAfter? }`.

| Méthode | Route | Corps | Réponse |
|---|---|---|---|
| POST | `/register` | `email, password, displayName?, username?, emailToken?, code?` | `{ user }` ou `{ needsOtp, otpToken, emailMasked }` |
| POST | `/login` | `identifier, password` | `{ user }` ou `{ needsOtp, … }` |
| POST | `/send-otp` | `email` | `{ ok, emailMasked }` |
| POST | `/verify-otp` | `otpToken, code` ou `email, code` | `{ user }` ou `{ needsProfile, emailToken }` |
| POST | `/resend-otp` | `otpToken` | `{ needsOtp, otpToken, emailMasked }` |
| POST | `/forgot-password` | `email` | `{ ok: true }` (toujours) |
| POST | `/reset-password` | `email, code, password` | `{ ok: true }` |
| POST | `/change-password` | `currentPassword, newPassword` | `{ ok, user }` + nouvelle session |
| GET | `/me` | — | `{ user }` |
| PATCH | `/me` | `displayName?, username?` | `{ user }` |
| POST | `/logout` | — | `{ ok: true }` + cookie effacé |

Codes d'erreur utiles : `invalid_credentials`, `email_taken`,
`username_taken`, `otp_invalid`, `otp_expired`, `otp_attempts`,
`otp_cooldown`, `rate_limited`, `session_revoked`, `mail_failed`.

---

## Sécurité

- **Mots de passe** : scrypt (N=16384, r=8, p=1, 64 octets), sel aléatoire par
  hash, comparaison à temps constant. Format versionné, paramètres relus.
- **Sessions** : JWT HS256 maison (aucune dépendance), 30 jours,
  `token_version` en base : changer ou réinitialiser le mot de passe révoque
  toutes les sessions existantes.
- **OTP** : 6 chiffres via `crypto.randomInt`, stockés en HMAC-SHA256 avec le
  secret de l'app, 10 minutes, 5 essais, un seul code actif, cooldown 30 s.
- **Cookies** : `HttpOnly`, `SameSite=Lax`, `Secure` en production, `Path=/`.
- **Énumération** : `login` renvoie toujours « Identifiants incorrects » et
  compare un hash factice quand le compte n'existe pas ; `forgot-password`
  répond `{ ok: true }` même pour une adresse inconnue.
- **Rate limit** : 20 tentatives / 15 min et 8 OTP / 15 min par IP.
- **Inscriptions** : `registrationCode` permet de fermer la création de comptes
  à un serveur privé (le code est comparé à temps constant).
- **IP de confiance** : `req.ip` (Express) et `x-forwarded-for` (Web) ne sont
  fiables que derrière un proxy maîtrisé. Configure `trust proxy` côté Express,
  sinon un client peut changer d'IP à chaque requête.
- **Codes en clair** : jamais loggés en production. En dev, le mailer console
  les affiche, et `echoOtp` permet de les renvoyer à l'écran.

Limites assumées :

- rate limit **en mémoire** : une seule instance Node (Redis nécessaire en
  multi-instance / serverless) ;
- pas d'OAuth, pas de magic link, pas de 2FA TOTP ;
- le changement d'email n'est pas encore couvert ;
- `node:sqlite` est synchrone : parfait pour un serveur mono-processus, à
  remplacer par un adaptateur async pour Postgres.

---

## Personnalisation

**Mailer** : n'importe quelle fonction `async ({ to, code, purpose }) => {}`.

```js
const auth = createAuthService({
  db,
  mailer: async ({ to, code, purpose }) => {
    await monServiceMail.send({ to, subject: "Ton code", text: code })
  },
})
```

`createResendMailer` est fourni (API HTTP, zéro dépendance). Pour SMTP, passe
ta propre fonction basée sur nodemailer — l'application porte la dépendance,
pas le kit.

**Base de données** : objet `{ get(sql, params), all(sql, params), run(sql, params) }`.
`run` renvoie `{ lastInsertRowid, changes }`. Le schéma SQL est dans
`schema.sql` (tables préfixées `aura_`).

**Routes protégées** : le service expose `auth.requireSession({ token })` et
renvoie l'utilisateur public, ou lève une `AuthError(401)`.

```js
app.get("/api/private", async (req, res) => {
  const user = await auth.requireSession({ token: readCookie(req.headers.cookie, "aura_session") })
  res.json({ hello: user.displayName })
})
```

---

## Tests

```bash
node --test kit/auth/server/test/auth.test.mjs
node --test kit/auth/server/test/express.test.mjs   # si express est installé
```

La suite couvre : inscription → OTP → session, connexion, mauvais mot de
passe, 5 essais OTP, cooldown, reset, révocation de session, token falsifié,
email déjà pris, rate limit, parcours email-d'abord et adaptateur Web.
