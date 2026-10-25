// Synthetic accounts only. JSDOM validates real form ownership and click handlers.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.FANTASTIX_JSDOM||'jsdom');
function environment(file,url='https://example.test/app/'){
 const dom=new JSDOM(fs.readFileSync(__dirname+'/'+(file==='app.js'?'index.html':'lesen.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url,runScripts:'outside-only'});
 const w=dom.window;w.scrollTo=()=>{};w.alert=()=>{};w.confirm=()=>true;w.Notification={permission:'granted'};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const BaseDate=w.Date;w.Date=class extends BaseDate{constructor(...args){super(...(args.length?args:['2026-10-24T12:00:00Z']));}static now(){return new this().getTime();}};
 const source=fs.readFileSync(__dirname+'/'+file,'utf8');w.eval(source.split(file==='app.js'?'/* Interaktionen */':"document.addEventListener('submit'")[0]+'\nwindow.testRun=code=>eval(code);');
 const clickStart=source.indexOf("document.addEventListener('click'");const clickEnd=source.indexOf(file==='app.js'?"document.addEventListener('submit'":"$('#notice-dialog').addEventListener",clickStart);w.testRun(source.slice(clickStart,clickEnd));
 const fixture={members:[{id:'a',name:'Anna <A>',memberNumber:12},{id:'b',name:'Berta'}],meetings:Array.from({length:25},(_,i)=>({id:'m'+i,date:'2026-09-'+String(i+1).padStart(2,'0'),location:'Ort '+i,organizerId:'a',attendance:{a:{status:'present'}}})).concat([{id:'today',date:'2026-10-24'},{id:'future',date:'2099-01-01'}]),excursions:[{id:'past',title:'Past',date:'2026-10-23'},{id:'future',title:'Future',date:'2099-01-01'},{id:'today',title:'Today',date:'2026-10-24'},{id:'ongoing',title:'Ongoing',date:'2026-10-23',endDate:'2026-10-25'},{id:'closed',title:'Closed',completed:true},{id:'open',title:'Open'}],fines:[],payments:[],sections:{members:true,meetings:true,excursions:true,fines:true}};
 w.fixture=fixture;w.testRun("data=fixture;"+(file==='lesen.js'?"profile={member_id:'a'};user={id:'reader'};":''));
 return {dom,w,run:s=>w.testRun(s),doc:w.document};
}

(async()=>{
 const env=environment('app.js'),w=env.w,doc=env.doc,run=env.run,calls=[],alerts=[],timers=new Map();let tick=0,requests=0,sub=null,registered=false,testFailure=false,statusFailure=false,deferred=null;
 Object.defineProperty(w,'isSecureContext',{value:true});Object.defineProperty(doc,'hidden',{value:false});w.PushManager=function(){};w.alert=x=>alerts.push(x);
 w.eval(fs.readFileSync(__dirname+'/push-config.js','utf8'));
 const device={endpoint:'https://fcm.googleapis.com/only-this-device',toJSON(){return {endpoint:this.endpoint,keys:{p256dh:'LOCAL_PUBLIC_KEY',auth:'LOCAL_AUTH_KEY'}};}};
 w.Notification={permission:'default',requestPermission(){requests++;this.permission='granted';return Promise.resolve('granted');}};
 const reg={active:{state:'activated'},pushManager:{getSubscription:async()=>sub,subscribe:async options=>{assert.equal(options.userVisibleOnly,true);sub=device;return device;}}};
 Object.defineProperty(w.navigator,'serviceWorker',{value:{getRegistration:async()=>reg,register:async()=>reg,addEventListener(){},removeEventListener(){}}});
 w.setInterval=fn=>{timers.set(++tick,fn);return tick;};w.clearInterval=id=>timers.delete(id);
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 const source=fs.readFileSync(__dirname+'/app.js','utf8');run(source.split('\n').find(line=>line.startsWith("$('#dialog').addEventListener('close'")));
 const status=()=>({checked_at:'2026-10-25T12:00:00Z',scope_days:30,device_registered:registered,registered_devices:3,own_devices:2,counts:{pending:1,sending:1,sent:2,failed:1,inactive:0},deliveries:[{event_key:'k',device_id:1,recipient:'Anna <A>',title:'<script>unsafe</script>',state:'failed',attempts:1,retry_scheduled:true,next_attempt_at:'2026-10-25T13:00:00Z',last_error:'<img src=x onerror=bad> 503'}]});
 w.rpc=async(name,args)=>{calls.push({name,args});if(name==='fantastix_admin_push_status'){if(deferred){const pending=deferred;deferred=null;return pending;}return {data:status(),error:statusFailure?{message:'Database unavailable'}:null};}if(name==='fantastix_push_subscribe'){registered=true;return {error:null};}if(name==='fantastix_admin_push_test')return {data:{event_key:'test'},error:testFailure?{message:'Eine Minute warten'}:null};throw Error(name);};
 run("cloudReady=true;cloudUser={id:'admin'};cloudClient={rpc};");
 await run('openPushAdmin()');assert.equal(requests,0,'Opening status never asks for permission');assert.equal(doc.querySelector('[data-action="push-admin-test"]').disabled,true);assert.equal(timers.size,1);
 assert.equal(doc.querySelector('#push-admin-panel script'),null);assert.equal(doc.querySelector('#push-admin-panel img'),null);assert.match(doc.querySelector('#push-admin-panel').textContent,/nicht die Anzeige oder das Lesen/);
 run('const originalEnable=enableAdminPush;enableAdminPush=()=>window.enablePending=originalEnable();');doc.querySelector('[data-action="push-admin-enable"]').click();assert.equal(requests,1,'Prompt starts synchronously in explicit click handler');await w.enablePending;
 assert.equal(registered,true);assert.equal(doc.querySelector('[data-action="push-admin-test"]').disabled,false);assert.ok(!doc.querySelector('#push-admin-panel').textContent.includes('LOCAL_AUTH_KEY'));
 await run('sendAdminPushTest()');const testCalls=calls.filter(x=>x.name==='fantastix_admin_push_test');assert.equal(testCalls.length,1);assert.deepEqual(JSON.parse(JSON.stringify(testCalls[0].args)),{p_endpoint:device.endpoint});assert.match(doc.querySelector('#push-admin-panel').textContent,/Testnachricht für dieses Gerät eingereiht/);
 testFailure=true;await run('sendAdminPushTest()');assert.match(doc.querySelector('[role="alert"]').textContent,/Eine Minute warten/);await run('loadPushAdmin(true)');assert.match(doc.querySelector('[role="alert"]').textContent,/Eine Minute warten/,'Automatic refresh retains action error');
 statusFailure=true;await run('loadPushAdmin()');assert.match(doc.querySelector('[role="alert"]').textContent,/Database unavailable/);statusFailure=false;
 let resolveOld;deferred=new Promise(resolve=>resolveOld=resolve);const pending=run('loadPushAdmin()');doc.querySelector('#dialog').close();assert.equal(timers.size,0,'Polling stops when dialog closes');
 run("cloudUser={id:'other-admin'}");await run('openPushAdmin()');const newResult=run('pushAdmin.result');resolveOld({data:{...status(),registered_devices:999},error:null});await pending;assert.equal(run('pushAdmin.result'),newResult,'Ignore response from previous account/modal');assert.notEqual(run('pushAdmin.result.registered_devices'),999);
 doc.querySelector('#dialog').close();w.Notification.permission='denied';await run('openPushAdmin()');assert.match(doc.querySelector('#push-admin-panel').textContent,/blockiert/);assert.equal(doc.querySelector('[data-action="push-admin-enable"]'),null);assert.equal(requests,1);
 doc.querySelector('#dialog').close();run('cloudReady=false');await run('openPushAdmin()');assert.match(alerts.pop(),/Administrator/);assert.equal(doc.querySelector('#dialog').open,false);
 env.dom.window.close();const deep=environment('app.js','https://example.test/app/index.html?push=test');assert.equal(deep.run('page'),'settings');deep.dom.window.close();console.log('PASS admin push client: explicit opt-in, own-device RPC, status/error escaping, polling/cleanup, failures, blocked permissions and stale account responses.');
})().catch(e=>{console.error(e);process.exitCode=1;});
