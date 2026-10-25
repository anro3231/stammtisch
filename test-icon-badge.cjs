// Synthetic records only; no network or live member data.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class FixedDate extends Date {constructor(...args){super(...(args.length?args:['2026-10-17T12:00:00Z']));}static now(){return new FixedDate().getTime();}}
function environment(file){
 const elements=new Map(),listeners={};let confirmation=true;
 const el=()=>({innerHTML:'',textContent:'',hidden:false,open:false,setAttribute(){},focus(){},showModal(){this.open=true;},close(){this.open=false;}});
 const ctx=vm.createContext({Date:FixedDate,console,crypto:require('node:crypto'),window:{scrollTo(){}},scrollTo(){},navigator:{onLine:false},
  localStorage:{getItem:()=>null},alert:msg=>{throw Error(msg);},confirm:()=>confirmation,
  document:{querySelector:s=>{if(s==='#admin-entry')return elements.get('#app')?.innerHTML.includes('id="admin-entry"')?el():null;if(!elements.has(s))elements.set(s,el());return elements.get(s);},addEventListener:(kind,fn)=>listeners[kind]=fn}});
 const source=fs.readFileSync(__dirname+'/'+file,'utf8');
 vm.runInContext(source.split(file==='app.js'?'/* Interaktionen */':"document.addEventListener('submit'")[0],ctx);
 const run=s=>vm.runInContext(s,ctx);
 return {ctx,run,elements,listeners,source,confirm:value=>confirmation=value};
}

(async()=>{
 const reader=environment('lesen.js'),calls=[];reader.ctx.navigator.setAppBadge=async value=>calls.push(value);reader.ctx.navigator.clearAppBadge=async()=>calls.push('clear');
 await reader.run('fxSetIconBadge(true)');await reader.run('fxSetIconBadge(false)');assert.deepEqual(calls,[1,'clear']);calls.length=0;
 reader.run("user={id:'r'};readerUpdates=[{id:1},{id:2}];readerUpdateReads=new Set();renderApp=()=>{};cloud={from:()=>({upsert:async()=>({error:null})})}");
 await reader.run('readerMarkRead([1])');await reader.run('fxBadgeQueue');assert.deepEqual(calls,[1]);
 await reader.run('readerMarkRead([2])');await reader.run('fxBadgeQueue');assert.deepEqual(calls,[1,'clear']);
 reader.ctx.navigator.setAppBadge=async()=>{throw Error('Unsupported settings');};await reader.run('fxSetIconBadge(true)');
 delete reader.ctx.navigator.clearAppBadge;reader.ctx.navigator.setAppBadge=async value=>calls.push(value);await reader.run('fxSetIconBadge(false)');assert.equal(calls.at(-1),0);
 delete reader.ctx.navigator.setAppBadge;await reader.run('fxSetIconBadge(true)');
 const admin=environment('app.js'),adminCalls=[];admin.ctx.navigator.setAppBadge=async value=>adminCalls.push(value);admin.ctx.navigator.clearAppBadge=async()=>adminCalls.push('clear');
 admin.run("cloudUser={id:'a'};fxBadgeLegacyUser='a';fxAlerts=[];fxSyncIconBadge()");await admin.run('fxBadgeQueue');assert.equal(adminCalls.length,0,'Do not clear before both inbox sources loaded');
 admin.run("fxBadgeNewUser='a';fxNewAlerts=[{id:1}];fxSyncIconBadge()");await admin.run('fxBadgeQueue');assert.equal(adminCalls.at(-1),1);
 admin.run("fxNewAlerts[0].read_at='now';fxSyncIconBadge()");await admin.run('fxBadgeQueue');assert.equal(adminCalls.at(-1),'clear');
 adminCalls.length=0;admin.run("cloudUser={id:'other'};fxSyncIconBadge()");await admin.run('fxBadgeQueue');assert.equal(adminCalls.length,0,'Ignore another account cache');
 // Push sets 1 in the background; a diagnostic test must not invent a bell item.
 const handlers={},pushCalls=[],shown=[];let pending;
 const worker=vm.createContext({URL,Date,console,navigator:{setAppBadge:async value=>pushCalls.push(value)},self:{registration:{showNotification:async()=>shown.push(true)},addEventListener:(type,fn)=>handlers[type]=fn}});
 vm.runInContext(fs.readFileSync(__dirname+'/service-worker.js','utf8'),worker);
 async function push(kind){handlers.push({data:{json:()=>({kind})},waitUntil:p=>pending=p});await pending;}
 await push('meeting_new');await push('event_new');await push('announcement');assert.deepEqual(pushCalls,[1,1,1]);assert.equal(shown.length,3);
 await push('admin_test');assert.equal(pushCalls.length,3);assert.equal(shown.length,4);
 worker.navigator.setAppBadge=async()=>{throw Error('Badge unavailable');};await push('meeting_new');assert.equal(shown.length,5,'Badge failure never suppresses notification');
 console.log('PASS icon badge: fixed 1, clear/read state, unsupported/denied API, two admin inbox sources, account separation, background push and test exclusion.');
})().catch(e=>{console.error(e);process.exitCode=1;});
