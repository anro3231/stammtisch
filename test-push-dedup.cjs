// Real worker handlers with durable cache shared across worker restarts; no network.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const storage=new Map(),shown=[];let rejectNext=false;
 const key=r=>typeof r==='string'?r:r.url;
 const cache={match:async r=>storage.get(key(r))?.clone(),put:async(r,v)=>storage.set(key(r),v.clone()),keys:async()=>[...storage.keys()].map(url=>({url})),delete:async r=>storage.delete(key(r))};
 const makeWorker=()=>{
  const handlers={};const context={URL,Response,Date,console,caches:{open:async()=>cache},self:{registration:{scope:'https://example.test/app/',showNotification:async(title,options)=>{if(rejectNext){rejectNext=false;throw Error('display failed');}shown.push({title,options});}},addEventListener:(type,fn)=>handlers[type]=fn},clients:{}};
  vm.runInNewContext(fs.readFileSync(__dirname+'/service-worker.js','utf8'),context);
  return payload=>{let pending;handlers.push({data:{json:()=>payload},waitUntil:p=>pending=p});return pending;};
 };
 let push=makeWorker();const msg={kind:'meeting_new',tag:'new:m1',title:'Neuer Stammtisch',body:'Bitte abstimmen'};
 await Promise.all([push(msg),push(msg),push(msg)]);assert.equal(shown.length,1,'Concurrent deliveries display once');
 await push(msg);assert.equal(shown.length,1,'Dismissed notification is not shown again');
 push=makeWorker();await push(msg);assert.equal(shown.length,1,'Receipts survive a service worker restart/update');
 await push({...msg,tag:'meeting_organizer:assignment-1'});assert.equal(shown.length,2,'Distinct organizer assignment still displays');
 const long='x'.repeat(180);await push({...msg,tag:long+'a'});await push({...msg,tag:long+'b'});assert.equal(shown.length,4,'Long identifiers do not collide');
 rejectNext=true;await assert.rejects(()=>push({...msg,tag:'new:retry'}),/display failed/);await push({...msg,tag:'new:retry'});assert.equal(shown.length,5,'Failed display does not poison receipt or block later messages');
 console.log('PASS push dedup: concurrent/repeated delivery, dismissal, worker restart/update, distinct events, long IDs and display failure retry.');
})().catch(e=>{console.error(e);process.exitCode=1;});
