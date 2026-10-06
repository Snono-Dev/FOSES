const CACHE='foses-v48';
const ASSETS=['./','./index.html','./manifest.webmanifest'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
// Network-first: always fresh content when online, cache fallback when offline.
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.origin!==location.origin || u.host.includes('api.github.com')) return;
  if(e.request.method!=='GET') return;
  e.respondWith(
    fetch(e.request).then(r=>{
      if(r.ok){ const c=r.clone(); caches.open(CACHE).then(cc=>cc.put(e.request,c)); }
      return r;
    }).catch(()=>caches.match(e.request).then(hit=>{
      if(hit) return hit;
      if(e.request.mode==='navigate') return caches.match('./index.html');
      throw new Error('offline');
    }))
  );
});

// --- Background reminders (free, on-device) ---
// Reads the reminders snapshot mirrored to IndexedDB and notifies about due items.
function idbGet(key) {
  return new Promise(res => {
    try {
      const q = indexedDB.open('foses', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('meta');
      q.onsuccess = () => {
        const tx = q.result.transaction('meta', 'readonly');
        const g = tx.objectStore('meta').get(key);
        g.onsuccess = () => res(g.result || null);
        g.onerror = () => res(null);
      };
      q.onerror = () => res(null);
    } catch { res(null); }
  });
}
function idbPut(key, val) {
  return new Promise(res => {
    try {
      const q = indexedDB.open('foses', 1);
      q.onsuccess = () => {
        const tx = q.result.transaction('meta', 'readwrite');
        tx.objectStore('meta').put(val, key);
        tx.oncomplete = () => res(true); tx.onerror = () => res(false);
      };
      q.onerror = () => res(false);
    } catch { res(false); }
  });
}
async function checkReminders(source) {
  const snap = await idbGet('reminders');
  if (!snap || !snap.list) return;
  const t = new Date().toISOString().slice(0, 10);
  const due = snap.list.filter(r => r.date && r.date <= t);
  if (!due.length) return;
  const seen = (await idbGet('notified')) || {};
  const fresh = due.filter(r => seen[r.key] !== r.date + t);
  if (!fresh.length) return;
  const first = fresh[0];
  await self.registration.showNotification(
    fresh.length === 1 ? (first.kind === 'exam' ? '◉ تذكير امتحان' : '📖 تذكير درس') : `🔔 لديك ${due.length} تذكيرات مستحقة`,
    { body: fresh.length === 1 ? `${first.title} · ${first.sub || ''}` : fresh.slice(0, 3).map(r => r.title).join('، '), icon: './assets/icons/icon-192.png', badge: './assets/icons/icon-192.png', tag: 'foses-due-' + t, data: { url: './index.html#/reminders' } }
  );
  fresh.forEach(r => { seen[r.key] = r.date + t; });
  await idbPut('notified', seen);
}
self.addEventListener('periodicsync', e => {
  if (e.tag === 'foses-reminders') e.waitUntil(checkReminders('periodic'));
});
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || '🔔 FOSES', {
    body: d.body || '', icon: './assets/icons/icon-192.png', badge: './assets/icons/icon-192.png',
    tag: d.tag || 'foses-push', data: { url: d.url || './index.html#/reminders' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './index.html#/reminders';
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
