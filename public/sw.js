/// <reference lib="webworker" />

/**
 * Service Worker para notificações em segundo plano.
 * Recebe mensagens do app principal e exibe notificações nativas,
 * que funcionam mesmo quando a aba está em background ou fechada.
 */

const SW_VERSION = "2.0.0";

const CACHE_NAME = `trackcore-v${SW_VERSION}`;
const PRECACHE_URLS = [
  "/",
  "/api/manifest",
  "/logos/rastrear-icone-light.png",
  "/logos/rastrear-logo-light.webp",
];

// ─── Instalação ────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── Mensagens do app principal ────────────────────────────────────
self.addEventListener("message", (event) => {
  const { type, payload } = event.data || {};

  if (type === "SHOW_NOTIFICATION") {
    const { title, body, tag, icon, badge, data } = payload;
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        tag: tag || `trackcore-${Date.now()}`,
        icon: icon || "/favicon.ico",
        badge: badge || "/favicon.ico",
        data: data || {},
        requireInteraction: false,
        silent: false,
      }),
    );
  }

  if (type === "PING") {
    event.source?.postMessage({ type: "PONG", version: SW_VERSION });
  }
});

// ─── Web Push do backend Traccar ───────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    try {
      data = { body: event.data?.text() || "Nova notificação" };
    } catch {
      data = { body: "Nova notificação" };
    }
  }

  const title = data.title || "Rastrear";
  const options = {
    body: data.body || data.message || "Você tem uma nova notificação",
    icon: data.icon || "/logos/rastrear-icone-light.png",
    badge: "/logos/rastrear-icone-light.png",
    tag: data.tag || `push-${Date.now()}`,
    data: data.data || data,
    requireInteraction: false,
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Clique na notificação ─────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = "/map";

  // Construir URL com parâmetros relevantes
  if (data.deviceId) {
    targetUrl = `/map?deviceId=${data.deviceId}`;
  }
  if (data.speedAlertId) {
    targetUrl += `${targetUrl.includes("?") ? "&" : "?"}alertId=${data.speedAlertId}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Se já tem uma aba aberta, foca nela e navega
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          client.postMessage({
            type: "NOTIFICATION_CLICK",
            url: targetUrl,
            data,
          });
          return;
        }
      }
      // Nenhuma aba aberta: abre uma nova
      return self.clients.openWindow(targetUrl);
    }),
  );
});
