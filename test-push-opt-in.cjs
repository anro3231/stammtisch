// No network/live account access. Browser permission is simulated.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/lesen.js','utf8'),storage=new Map();
function environment(permission='default',supported=true,blockedStorage=false){
 const elements=new Map(),listeners={},alerts=[];let requests=0;
 const el=()=>({innerHTML:'',textContent:'',hidden:false,open:false,dataset:{},setAttribute(){},showModal(){this.open=true;},close(){this.open=false;}});
 const Notification={permission,requestPermission(){requests++;this.permission='granted';return Promise.resolve('granted');}};
 const ctx=vm.createContext({URL,console,Notification,window:{isSecureContext:supported,Notification,PushManager:{},FANTASTIX_PUSH_PUBLIC_KEY:'test'},navigator:{serviceWorker:{},onLine:false},scrollTo(){},alert:msg=>alerts.push(msg),
 localStorage:{getItem:key=>{if(blockedStorage)throw Error('blocked');return storage.get(key)||null;},setItem:(key,value)=>{if(blockedStorage)throw Error('blocked');storage.set(key,value);}},
 document:{querySelector:s=>{if(!elements.has(s))elements.set(s,el());return elements.get(s);},addEventListener:(type,fn)=>listeners[type]=fn}});
 const run=s=>vm.runInContext(s,ctx);
 run(source.split("document.addEventListener('submit'")[0]);
 run(source.slice(source.indexOf("document.addEventListener('click'"),source.indexOf("$('#notice-dialog').addEventListener")));
 run("user={id:'opt-in-user'};profile={member_id:'a'};data={sections:{members:true,meetings:true,excursions:true},members:[{id:'a',name:'Anna'}],meetings:[],excursions:[],fines:[],payments:[]};");
 return {ctx,run,elements,alerts,requests:()=>requests,click:selector=>listeners.click({target:{closest:s=>s===selector?{}:null}})};
}
(async()=>{
 let env=environment();env.run('renderApp()');let dlg=env.elements.get('#push-opt-in-dialog');
 assert.equal(dlg.open,true);assert.match(dlg.innerHTML,/push-opt-in-allow/);assert.equal(env.requests(),0,'Never request system permission automatically');
 const dashboard=env.run('dashboard()');assert.ok(dashboard.indexOf('push-setup')>dashboard.indexOf('Stärkste Stammtischserie'));assert.doesNotMatch(env.run('members()'),/push-setup|push-enable|push-disable/);
 await env.click('#push-opt-in-dismiss');assert.equal(dlg.open,false);env.run('renderApp()');assert.equal(dlg.open,false,'Dismiss is once only');
 env=environment();env.run('renderApp()');assert.equal(env.elements.get('#push-opt-in-dialog')?.open??false,false,'Remembered across reloads');
 env.run("user={id:'other-user'};showPushOptIn()");assert.equal(env.elements.get('#push-opt-in-dialog').open,true,'Separate invitation per account');
 env=environment('granted');env.run('renderApp()');assert.equal(env.elements.get('#push-opt-in-dialog')?.open??false,false);assert.equal(env.requests(),0);assert.match(env.run('dashboard()'),/Gerät noch nicht verbunden/);
 env.run('pushEnabled=true');assert.match(env.run('dashboard()'),/Mitteilungen aktiviert/);
 storage.clear();env=environment('denied');env.run('renderApp()');dlg=env.elements.get('#push-opt-in-dialog');assert.match(dlg.innerHTML,/blockiert/);assert.doesNotMatch(dlg.innerHTML,/push-opt-in-allow/);assert.equal(env.requests(),0);assert.match(env.run('dashboard()'),/Mitteilungen blockiert/);assert.doesNotMatch(env.run('dashboard()'),/id="push-enable"/);
 storage.clear();env=environment('default',false);env.run('renderApp()');dlg=env.elements.get('#push-opt-in-dialog');assert.match(dlg.innerHTML,/Home-Bildschirm/);assert.doesNotMatch(dlg.innerHTML,/push-opt-in-allow/);
 storage.clear();env=environment();env.run("noticeQueue=[{id:1}];renderApp()");assert.equal(env.elements.get('#push-opt-in-dialog').open,false);assert.equal(storage.size,0,'Do not consume invitation while blocked');
 env.run("noticeQueue=[];$('#notice-dialog').open=true");env.run('showPushOptIn()');assert.equal(env.elements.get('#push-opt-in-dialog').open,false);
 env.elements.get('#notice-dialog').open=false;env.run('showNextNotice()');assert.equal(env.elements.get('#push-opt-in-dialog').open,true,'Deferred until notices are handled');
 storage.clear();env=environment('default',true,true);env.run('renderApp()');env.elements.get('#push-opt-in-dialog').close();env.run('renderApp()');assert.equal(env.elements.get('#push-opt-in-dialog').open,false,'Session fallback when storage is blocked');
 storage.clear();env=environment();env.run(`cloud={rpc:async()=>({error:null})};activePushRegistration=async()=>({pushManager:{getSubscription:async()=>({toJSON:()=>({endpoint:'https://example.test'})})}});base64UrlToUint8Array=()=>new Uint8Array();renderApp();const realEnablePush=enablePush;let pendingEnable;enablePush=()=>pendingEnable=realEnablePush();`);
 await env.click('#push-opt-in-allow');await env.run('pendingEnable');assert.equal(env.requests(),1,'Permission requested only from explicit click');assert.equal(env.run('pushEnabled'),true);assert.equal(env.elements.get('#push-opt-in-dialog').open,false);
 console.log('PASS push invitation: dashboard placement, member removal, once/account/device, reload/dismiss, granted/denied/unsupported, notice deferral, blocked storage, explicit permission click.');
})().catch(e=>{console.error(e);process.exitCode=1;});
