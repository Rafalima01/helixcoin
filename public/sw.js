// Push Notifications service worker (Fase X). Deliberately minimal — no
// offline caching / asset precaching, only what Web Push needs: show the
// notification on `push`, react to `notificationclick`. Both handlers fire
// a best-effort beacon back to the API so PushNotificationLog reflects
// "entregue"/"clicado" (Web Push has no built-in server-side delivery ack).

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.icon,
    tag: payload.category,
    requireInteraction: payload.priority === "high",
    data: { deepLink: payload.deepLink, logId: payload.logId },
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(payload.title, options);
      if (!payload.logId) return;
      try {
        await fetch("/api/push/delivered", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ logId: payload.logId }),
        });
      } catch {
        // Best-effort — a failed beacon never blocks the notification from showing.
      }
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { deepLink, logId } = event.notification.data || {};

  event.waitUntil(
    (async () => {
      if (logId) {
        try {
          await fetch("/api/push/clicked", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ logId }),
          });
        } catch {
          // Best-effort.
        }
      }

      if (!deepLink) return;
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if (client.url === deepLink && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(deepLink);
      }
    })()
  );
});
