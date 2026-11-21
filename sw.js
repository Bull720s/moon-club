const C='moon-v3';
const A=['./','index.html','exercises.js','img/logo-full.png','img/gym-1.jpg','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{const u=new URL(e.request.url);if((r.ok&&u.origin===location.origin)||(u.hostname==='cdn.jsdelivr.net'&&u.pathname.startsWith('/gh/yuhonas/')&&(r.ok||r.type==='opaque'))){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp)).catch(()=>{})}return r}).catch(()=>caches.match(e.request)));
});
