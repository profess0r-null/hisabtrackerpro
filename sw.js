const PREFIX='hisabtracker:'+self.registration.scope+':';
const CACHE=PREFIX+'v96';
const FILES=['./','index.html','assets/css/style.css?v=6.21','assets/js/app.js?v=6.21','assets/js/sync.js?v=6.21','assets/js/safety.js?v=6.21','assets/css/expense.css?v=6.21','assets/css/mobile.css?v=6.21','assets/js/mobile.js?v=6.21','assets/images/icon.png','assets/css/motion.css?v=6.21','assets/js/motion.js?v=6.21','assets/js/security.js?v=6.21','assets/js/usage.js?v=6.21','assets/css/security.css?v=6.21','manifest.json','assets/vendor/supabase.min.js'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url),base=new URL('./',self.location.href);
 if(req.method!=='GET'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname)||url.pathname.includes('/api/')||url.pathname.endsWith('.php'))return;
 event.respondWith(fetch(req).then(response=>{if(response.ok){const cloned=response.clone();caches.open(CACHE).then(cache=>cache.put(req,cloned));}return response;}).catch(async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(req);if(cached)return cached;if(req.mode==='navigate'){const shell=await cache.match(new URL('index.html',base).href);if(shell)return shell;}return new Response('Offline asset unavailable',{status:503,headers:{'Content-Type':'text/plain'}});}));
});
