const CACHE_NAME = "wm-2026-companion-v19";
const BASE_PATH = "/wm-2026-companion/";
const STATIC_ASSETS = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}offline.html`,
  `${BASE_PATH}manifest.json`,
  `${BASE_PATH}icons/apple-touch-icon.png`,
  `${BASE_PATH}icons/icon-192.png`,
  `${BASE_PATH}icons/icon-512.png`,
  `${BASE_PATH}icons/icon-1024.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

// --- Tor-Push-Benachrichtigungen ---

const ICON = `${BASE_PATH}icons/icon-192.png`;

async function readBackendUrl() {
  try {
    const cache = await caches.open("wm-push-config");
    const res = await cache.match("/backend-url");
    return res ? (await res.text()).replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

// Payloadloser Push: der Worker "weckt" nur; der SW holt die ausstehenden Tor-Meldungen ab.
async function handlePush(event) {
  let messages = [];
  if (event.data) {
    try {
      const data = event.data.json();
      messages = Array.isArray(data) ? data : [data];
    } catch {
      messages = [{ title: "WM 2026 ⚽", body: event.data.text() }];
    }
  } else {
    const backend = await readBackendUrl();
    const sub = await self.registration.pushManager.getSubscription();
    if (backend && sub) {
      try {
        const res = await fetch(`${backend}/pending?endpoint=${encodeURIComponent(sub.endpoint)}`);
        if (res.ok) messages = await res.json();
      } catch {
        // ignorieren – unten Fallback
      }
    }
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    // iOS verlangt fuer jeden Push eine sichtbare Benachrichtigung.
    messages = [{ title: "WM 2026 ⚽", body: "Es gibt ein Update zu deinem Spiel." }];
  }

  await Promise.all(
    messages.map((m) =>
      self.registration.showNotification(m.title || "WM 2026 ⚽", {
        body: m.body || "",
        icon: ICON,
        badge: ICON,
        tag: m.tag,
        data: { url: m.url || BASE_PATH },
        vibrate: [80, 40, 80],
      }),
    ),
  );
}

self.addEventListener("push", (event) => {
  event.waitUntil(handlePush(event));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || BASE_PATH;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(BASE_PATH));
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // API- und alle Fremd-Requests (z. B. api.fifa.com, flagcdn.com) NIE aus dem Cache
  // beantworten – sonst frieren Live-Ergebnisse ein. Immer direkt ans Netz.
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match(`${BASE_PATH}offline.html`)));
    return;
  }

  // Eigene statische Dateien: cache-first mit Nachladen ins Cache.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(`${BASE_PATH}offline.html`));
    }),
  );
});
