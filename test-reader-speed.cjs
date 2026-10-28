// Deterministic slow-network tests; no live Supabase requests or real waiting.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.FANTASTIX_JSDOM||'jsdom');
const tick=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
function environment(){
 const dom=new JSDOM(fs.readFileSync(__dirname+'/lesen.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://example.test/app/',runScripts:'outside-only'}),w=dom.window;
 w.scrollTo=()=>{};w.alert=()=>{};w.confirm=()=>true;w.Notification={permission:'granted'};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const source=fs.readFileSync(__dirname+'/lesen.js','utf8');w.eval(source.split("document.addEventListener('submit'")[0]+'\nwindow.run=code=>eval(code);');
 const start=source.indexOf("document.addEventListener('click'"),end=source.indexOf("$('#notice-dialog').addEventListener",start);w.run(source.slice(start,end));w.eval(fs.readFileSync(__dirname+'/calendar-view.js','utf8'));
 w.fixture={members:[{id:'a',name:'Anna'}],meetings:[{id:'m',date:'2099-01-01',attendance:{a:{status:'present'}},organizerId:'a'}],excursions:[{id:'e',title:'Ausflug',date:'2099-01-01',organizerIds:['a']}],fines:[],payments:[],sections:{members:true,meetings:true,excursions:true,fines:true,cash:true}};
 w.calls=[];const pending=new Map();
 const request=key=>{w.calls.push(key);return new Promise((resolve,reject)=>{if(!pending.has(key))pending.set(key,[]);pending.get(key).push({resolve,reject});});};
 w.mock={from:table=>{const key=table.replace('fantastix_','');return {select(){return this;},eq(){return this;},maybeSingle(){return request(key);},then(resolve,reject){return request(key).then(resolve,reject);}};},rpc:name=>request(name)};
 // Helpers are optional reads, independently delayed to verify parallelism and early rendering.
 w.getOptional=request;w.pushChecks=0;
 w.run("data=fixture;profile={member_id:'a'};user={id:'u'};cloud=window.mock;tab='dashboard';deadlines=new Map([['m','2098-12-31T00:00:00Z']]);loadAvatars=()=>window.getOptional('avatars');loadBirthdays=()=>window.getOptional('birthdays');refreshReaderExtras=()=>window.getOptional('extras');detectPushSubscription=()=>window.pushChecks++;renderApp();");
 return {dom,w,run:w.run,doc:w.document,pending,resolve(key,value={data:[],error:null}){assert.ok(pending.get(key)?.length,'Pending '+key);pending.get(key).shift().resolve(value);},reject(key,error){pending.get(key).shift().reject(error);}};
}
async function core(env){env.resolve('reader_profiles',{data:{member_id:'a'}});env.resolve('public',{data:{content:structuredClone(env.w.fixture),published_at:'2026-10-28T12:00:00Z'}});env.resolve('fantastix_reader_deadlines',{data:[{meeting_id:'m',deadline_at:'2098-12-31T00:00:00Z'}]});await tick();}
async function optional(env){for(const key of ['fantastix_excursion_votes_read_v2','meeting_notes','birthdays','avatars','fantastix_notice_list','extras'])env.resolve(key);await tick();}
(async()=>{
 const env=environment(),{w,doc,run}=env;
 // A menu must render synchronously before any response arrives.
 doc.querySelector('[data-tab="meetings"]').click();assert.equal(run('tab'),'meetings');assert.match(doc.querySelector('#content h1').textContent,/Stammtische/);assert.equal(doc.querySelector('.navbutton.active').dataset.tab,'meetings');
 assert.equal(w.calls.filter(x=>x==='reader_profiles').length,1);assert.equal(w.calls.length,3,'Core queries started together');
 doc.querySelector('[data-tab="calendar"]').click();assert.match(doc.querySelector('#content h1').textContent,/Kalender/);assert.equal(w.calls.length,3,'Rapid menu changes reuse one in-flight request');
 await core(env);for(const key of ['meeting_notes','birthdays','avatars','extras','fantastix_excursion_votes_read_v2','fantastix_notice_list'])assert.ok(w.calls.includes(key),key+' started without waiting on other optional reads');
 assert.match(doc.querySelector('#content h1').textContent,/Kalender/,'Completion keeps the most recently selected menu');
 await optional(env);assert.equal(w.pushChecks,1);
 const calls=w.calls.length;doc.querySelector('[data-tab="members"]').click();doc.querySelector('[data-tab="meetings"]').click();assert.equal(w.calls.length,calls,'Fresh background snapshot is reused');
 // Even slow optional reads must not erase a note typed after the core render.
 const forced=run('refresh()');await core(env);run("openReaderEntry('meeting','m')");const note=doc.querySelector('[data-meeting-note]');note.value='Entwurf bleibt';note.focus();note.blur();await optional(env);await forced;assert.equal(doc.querySelector('[data-meeting-note]').value,'Entwurf bleibt');
 assert.equal(w.pushChecks,1,'Routine reads do not re-register push subscriptions');
 // A mutation refresh waits for an older background read, then starts a new read.
 run('readerLastSync=0');const bg=run('refresh({background:true})'),afterWrite=run('refresh()');let prior=w.calls.filter(x=>x==='reader_profiles').length;await core(env);await optional(env);await bg;await tick();assert.equal(w.calls.filter(x=>x==='reader_profiles').length,prior+1);await core(env);await optional(env);await afterWrite;
 // A transient network error leaves the already rendered screen available.
 run('readerLastSync=0');const failed=run('refresh({background:true})');env.reject('reader_profiles',Error('Network unavailable'));env.resolve('public');env.resolve('fantastix_reader_deadlines');await failed;assert.ok(run('data'));assert.equal(doc.querySelector('#reader-app').hidden,false);assert.match(doc.querySelector('#updated').textContent,/bisheriger Stand/);
 // An explicit revocation or auth error must still remove the reader data.
 const denied=run('refresh({background:true})');env.resolve('reader_profiles',{error:{status:403,message:'Forbidden'}});env.resolve('public');env.resolve('fantastix_reader_deadlines');await denied;assert.equal(run('data'),null);assert.equal(doc.querySelector('#reader-app').hidden,true);
 env.dom.window.close();
 // Responses belonging to an account that signed out must never restore its data.
 const stale=environment();const abandoned=stale.run('refresh({background:true})');stale.run('user=null;data=null');stale.resolve('reader_profiles',{data:{member_id:'a'}});stale.resolve('public',{data:{content:stale.w.fixture}});stale.resolve('fantastix_reader_deadlines');await abandoned;assert.equal(stale.run('data'),null);stale.dom.window.close();
 console.log('PASS reader speed: synchronous menus, parallel reads, request reuse/throttling, current menu retained, drafts preserved, forced post-write freshness, transient errors, revocation and account separation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
