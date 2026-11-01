/* Aura Push — service worker.
 *
 * Deux façons de l'utiliser :
 *   1. workbox.importScripts: ["push-sw.js"] (vite-plugin-pwa, generateSW) ;
 *   2. copier ce fichier comme service worker principal et y ajouter ton cache.
 *
 * Payload attendu :
 *   { title, body, url, tag, icon, badge, actions: [{ action, title }] }
 */

const DEFAULT_TITLE = "Aura";
const DEFAULT_BODY = "Nouvelle notification";
const DEFAULT_URL = "/";

function parsePayload(event) {
  const fallback = { title: DEFAULT_TITLE, body: DEFAULT_BODY, url: DEFAULT_URL };
  if (!event.data) return fallback;

  try {
    return { ...fallback, ...JSON.parse(event.data.text()) };
  } catch {
    return { ...fallback, body: event.data.text() || fallback.body };
  }
}

function scopeOrigin() {
  return new URL(self.registration.scope).origin;
}

function sameAppClient(client) {
  try {
    return new URL(client.url).origin === scopeOrigin();
  } catch {
    return false;
  }
}

async function notifyClients(payload) {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of clients) {
    if (sameAppClient(client)) {
      client.postMessage({ type: "AURA_PUSH", payload });
    }
  }
}

async function showNotification(data) {
  const options = {
    body: data.body,
    tag: data.tag ?? `aura-${Date.now()}`,
    data: {
      url: data.url ?? DEFAULT_URL,
      ...(data.data ?? {}),
    },
  };

  if (data.icon) options.icon = data.icon;
  if (data.badge) options.badge = data.badge;
  if (Array.isArray(data.actions) && data.actions.length > 0) {
    options.actions = data.actions.slice(0, 2);
  }
  if (data.silent) options.silent = true;

  await self.registration.showNotification(data.title || DEFAULT_TITLE, options);
}

self.addEventListener("push", (event) => {
  const data = parsePayload(event);

  event.waitUntil(
    (async () => {
      try {
        await showNotification(data);
      } catch {
        await self.registration.showNotification(data.title || DEFAULT_TITLE, {
          body: data.body,
          data: { url: data.url ?? DEFAULT_URL },
        });
      }
      await notifyClients(data);
    })(),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (sameAppClient(client)) {
            client.postMessage({ type: "AURA_PUSH_RESUBSCRIBE" });
          }
        }
      }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data ?? {};
  const url = data.url ?? DEFAULT_URL;
  const payload = { ...data, url };

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        const appClients = clients.filter(sameAppClient);
        if (appClients.length > 0) {
          const client = appClients[0];
          await client.focus();
          client.postMessage({ type: "AURA_NAV", payload });
          return;
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      }),
  );
});
