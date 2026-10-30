const CACHE='fantastix-v3.26.3';
// App-Icon: bewusst nur 1 für ungelesen; ohne API bleibt die App unverändert nutzbar.
let fxBadgeQueue=Promise.resolve();
function fxSetIconBadge(unread){
 fxBadgeQueue=fxBadgeQueue.catch(()=>{}).then(async()=>{
  if(typeof navigator==='undefined')return;
  if(unread){if(typeof navigator.setAppBadge==='function')await navigator.setAppBadge(1);}
  else if(typeof navigator.clearAppBadge==='function')await navigator.clearAppBadge();
  else if(typeof navigator.setAppBadge==='function')await navigator.setAppBadge(0);
 }).catch(()=>{});return fxBadgeQueue;
}
const FILES=['./','./photo-feature.js?v=3.26.3','./modern.css?v=3.26.3','./ui-icons.js?v=3.26.3','./index.html','./version.js','./app.js','./lesen.html','./lesen.js','./calendar-view.js','./push-config.js','./manifest.webmanifest','./leser-manifest.webmanifest','./fantastix-logo.png','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-180.png'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
 // Kein caches.addAll(): eine einzige fehlende Datei würde die komplette SW-Aktivierung
 // verhindern und PushManager.subscribe() mit "requires an active service worker" abbrechen.
 try{
  const cache=await caches.open(CACHE);
  await Promise.all(FILES.map(async path=>{
   try{
    const req=new Request(new URL(path,self.registration.scope),{cache:'reload'});
    const response=await fetch(req);
    if(response.ok)await cache.put(req,response);
   }catch(err){console.warn('Optionaler FantastiX-Cache-Eintrag fehlgeschlagen:',path,err);}
  }));
 }catch(err){console.warn('Offline-Cache nicht verfügbar, Push bleibt möglich:',err);}
 await self.skipWaiting();
})()));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fantastix-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
 e.respondWith(fetch(e.request).then(resp=>{
   if(resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}
   return resp;
 }).catch(()=>caches.match(e.request)));
});

// Separate from the asset cache: receipts survive app/service-worker updates.
const PUSH_RECEIPTS='fx-push-receipts-v1';
let pushDisplayQueue=Promise.resolve();
const pushMemoryReceipts=new Set();
async function fxShowPushOnce(eventKey,show){
 const key=eventKey?new URL('./__push_receipt__/'+encodeURIComponent(eventKey),self.registration.scope).href:null;
 let cache=null;
 if(key){
  if(pushMemoryReceipts.has(key))return;
  try{cache=await caches.open(PUSH_RECEIPTS);if(await cache.match(key)){pushMemoryReceipts.add(key);return;}}catch(error){console.warn('Push receipt unavailable',error);}
 }
 await show();
 if(key){
  pushMemoryReceipts.add(key);
  if(cache)try{
   await cache.put(key,new Response(String(Date.now())));
   // Server events are eligible for at most 30 days. Keep a 35-day margin.
   for(const request of await cache.keys()){
    const receipt=await cache.match(request),stamp=Number(await receipt.text());
    if(stamp&&Date.now()-stamp>35*86400000)await cache.delete(request);
   }
  }catch(error){console.warn('Push receipt could not be stored',error);}
 }
}

// Echte Web Push Nachricht - auch bei geschlossener FantastiX Web-App.
self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?.json()||{};}catch{payload={};}
 const kind=['meeting_new','announcement','vote_reminder','event_new','admin_test','meeting_organizer','event_organizer','meeting_location','birthday','fine_new'].includes(payload.kind)?payload.kind:'announcement';
 if(kind==='birthday'){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Vienna',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
  if(String(payload.tag||'').split(':')[1]!==`${parts.year}-${parts.month}-${parts.day}`)return;
 }
 if(kind==='vote_reminder'&&Number.isFinite(Date.parse(payload.deadlineAt))&&Date.now()>=Date.parse(payload.deadlineAt))return;
 const title=String(payload.title||'FantastiX').slice(0,100);
 const body=String(payload.body||'Neue Nachricht').slice(0,220);
 const eventKey=typeof payload.tag==='string'&&payload.tag?payload.tag:null;
 const display=()=>fxShowPushOnce(eventKey,()=>Promise.all([kind==='admin_test'?Promise.resolve():fxSetIconBadge(true),self.registration.showNotification(title,{
  body, icon:'./icons/icon-192.png',badge:'./icons/icon-192.png',
  tag:eventKey||('fantastix-'+kind),
  data:{audience:kind==='admin_test'?'admin':'reader',tab:kind==='admin_test'?'settings':['event_new','event_organizer'].includes(kind)?'excursions':kind==='birthday'?'members':kind==='fine_new'?'cash':kind==='announcement'?'dashboard':'meetings'},
  renotify:false
 })]));
 // Serialize overlapping push events, including storage checks and writes.
 const pending=pushDisplayQueue.then(display);
 pushDisplayQueue=pending.catch(()=>{});
 event.waitUntil(pending);
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const admin=event.notification.data?.audience==='admin';
  const targetURL=new URL(admin?'./index.html':'./lesen.html',self.registration.scope);
  const tab=['dashboard','meetings','calendar','excursions','members','cash'].includes(event.notification.data?.tab)?event.notification.data.tab:'dashboard';
  if(admin)targetURL.searchParams.set('push','test');else targetURL.searchParams.set('tab',tab);
  const target=targetURL.href;
  const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(c=>{try{return new URL(c.url).pathname===new URL(target).pathname;}catch{return false;}});
  if(existing){await existing.focus();existing.postMessage(admin?{type:'fantastix-admin-push-open'}:{type:'fantastix-push-open',tab:event.notification.data?.tab||'dashboard'});}
  else if(clients.openWindow)await clients.openWindow(target);
 })());
});
