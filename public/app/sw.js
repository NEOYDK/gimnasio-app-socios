// Lo que hace que la app del socio de PULSO se instale y abra al instante.
// Páginas: primero la red (siempre lo último), si no hay señal, lo guardado. Estilos, letras e íconos: lo guardado y se renueva atrás.
// La /api nunca se guarda (cuenta, chats y pagos siempre al día).
const VERSION = "pulso-app-7";
const BASICO = ["/app/", "/app/manifest.webmanifest", "/assets/icons/pulso-192.png"];

self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(BASICO)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("pulso-app") && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate" && url.pathname.startsWith("/app")) {
    e.respondWith(fetch(req).then(r => { if (r.ok) caches.open(VERSION).then(c => c.put("/app/", r.clone())); return r; }).catch(() => caches.match("/app/")));
    return;
  }
  if (/\.(css|js|png|svg|webp|woff2|webmanifest)$/.test(url.pathname)) {
    e.respondWith(caches.open(VERSION).then(async c => {
      const g = await c.match(req);
      const red = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => g);
      return g || red;
    }));
  }
});

// Notificaciones (avisos del gimnasio y el mensaje del día): llegan aunque la app esté cerrada
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { texto: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "PULSO", {
    body: d.texto || "", icon: "/assets/icons/pulso-192.png", tag: d.tag || "pulso", renotify: true, lang: "es-AR", data: { url: d.url || "/app/" },
  }));
});
// Al tocarla: abre la app (o la trae al frente si ya estaba abierta)
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/app/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    const w = ws.find(x => x.url.startsWith(self.location.origin + "/app"));
    if (w) return w.focus().then(f => (f && f.navigate ? f.navigate(url) : f));
    return self.clients.openWindow(url);
  }));
});
