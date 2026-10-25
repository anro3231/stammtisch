// Actual service-worker handlers with simulated browser clients; no network.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const handlers={},notifications=[],opened=[],messages=[],focused=[];let windows=[],pending;
 const ctx=vm.createContext({URL,Date,console,self:{registration:{scope:'https://example.test/app/',showNotification:async(title,options)=>notifications.push({title,options})},addEventListener:(name,fn)=>handlers[name]=fn},clients:{matchAll:async()=>windows,openWindow:async url=>opened.push(url)}});
 vm.runInContext(fs.readFileSync(__dirname+'/service-worker.js','utf8'),ctx);
 const push=async kind=>{handlers.push({data:{json:()=>({kind,title:'Test',body:'Body',tag:'unique'})},waitUntil:p=>pending=p});await pending;return notifications.at(-1);};
 const click=async notification=>{handlers.notificationclick({notification:{data:notification.options.data,close(){}},waitUntil:p=>pending=p});await pending;};
 const client=(name,url)=>({url,focus:async()=>focused.push(name),postMessage:msg=>messages.push({name,msg})});
 let n=await push('admin_test');assert.equal(n.options.data.audience,'admin');assert.equal(n.options.data.tab,'settings');
 windows=[client('reader','https://example.test/app/lesen.html')];await click(n);assert.equal(new URL(opened.at(-1)).pathname,'/app/index.html');assert.equal(new URL(opened.at(-1)).searchParams.get('push'),'test');assert.equal(focused.length,0,'Admin test must not open reader UI');
 windows.push(client('admin','https://example.test/app/index.html'));await click(n);assert.equal(focused.at(-1),'admin');assert.equal(messages.at(-1).msg.type,'fantastix-admin-push-open');
 n=await push('event_new');await click(n);assert.equal(focused.at(-1),'reader');assert.equal(messages.at(-1).msg.tab,'excursions');assert.equal(messages.at(-1).msg.type,'fantastix-push-open');
 windows=[];n=await push('announcement');await click(n);assert.equal(new URL(opened.at(-1)).pathname,'/app/lesen.html');assert.equal(new URL(opened.at(-1)).searchParams.get('tab'),'dashboard');
 n=await push('meeting_new');assert.equal(n.options.data.tab,'meetings');
 console.log('PASS admin push worker: test routes to admin, reuses correct window, regular event/announcement/meeting routing unchanged.');
})().catch(e=>{console.error(e);process.exitCode=1;});
