/// <reference lib="webworker" />

/**
 * Service Worker para notificações em segundo plano.
 * Recebe mensagens do app principal e exibe notificações nativas,
 * que funcionam mesmo quando a aba está em background ou fechada.
 */

const SW_VERSION = '1.0.0';

// ─── Instalação ────────────────────────────────────────────────────
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Mensagens do app principal ────────────────────────────────────
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  if (type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, icon, badge, data } = payload;
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        tag: tag || `trackcore-${Date.now()}`,
        icon: icon || '/favicon.ico',
        badge: badge || '/favicon.ico',
        data: data || {},
        requireInteraction: false,
        silent: false,
      })
    );
  }

  if (type === 'PING') {
    event.source?.postMessage({ type: 'PONG', version: SW_VERSION });
  }
});

// ─── Clique na notificação ─────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = '/map';

  // Construir URL com parâmetros relevantes
  if (data.deviceId) {
    targetUrl = `/map?deviceId=${data.deviceId}`;
  }
  if (data.speedAlertId) {
    targetUrl += `${targetUrl.includes('?') ? '&' : '?'}alertId=${data.speedAlertId}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se já tem uma aba aberta, foca nela e navega
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            url: targetUrl,
            data,
          });
          return;
        }
      }
      // Nenhuma aba aberta: abre uma nova
      return self.clients.openWindow(targetUrl);
    })
  );
});
