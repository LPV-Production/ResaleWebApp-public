// ============================================================
// Programme d'arrière-plan du téléphone (service worker).
// Il reçoit les notifications envoyées par le serveur, même appli fermée,
// et ouvre l'écran Relances quand on touche la notification.
// Volontairement : aucune mise en cache, l'appli est toujours à jour.
// ============================================================

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }

  const title = data.title || 'Resale Manager';
  const tasks = [
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag || 'relances', // une nouvelle notification remplace la précédente
      data: { url: data.url || '/?vue=relances' },
    }),
  ];
  // Pastille avec le nombre d'articles à relancer sur l'icône de l'appli
  if (typeof data.count === 'number' && self.navigator.setAppBadge) {
    tasks.push(data.count > 0 ? self.navigator.setAppBadge(data.count) : self.navigator.clearAppBadge());
  }
  event.waitUntil(Promise.all(tasks).catch(() => {}));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (win) return win.focus().then((w) => w.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
