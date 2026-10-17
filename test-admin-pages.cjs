// Synthetic data only: no live Supabase access or real browser storage.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/app.js','utf8');
const storage=new Map(),listeners={},alerts=[],calls=[];
let confirmation=true;
const app={innerHTML:''},nav={innerHTML:''};
const dialog={open:false,innerHTML:'',showModal(){this.open=true;},close(){this.open=false;}};
const counter={textContent:''},voteButton={disabled:false};
const form={elements:{id:{value:'x1'}}};
const editor={querySelector:s=>s==='form[data-form="excursion"]'?form:s==='#excursion-vote-count'?counter:null,querySelectorAll:s=>s==='[data-action="excursion-admin-vote"]'?[voteButton]:[]};
const ctx=vm.createContext({console,URL,Blob,crypto:require('node:crypto'),setTimeout:()=>0,clearTimeout(){},
 window:{scrollTo(){}},navigator:{onLine:false},alert:x=>alerts.push(x),confirm:()=>confirmation,
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
 FormData:class{constructor(form){return form.fd;}},
 document:{querySelector:s=>s==='#app'?app:s==='#nav'?nav:s==='#dialog'?dialog:s==='#admin-entry'&&app.innerHTML.includes('id="admin-entry"')?editor:null,getElementById:()=>null,addEventListener:(kind,fn)=>{listeners[kind]=fn;}}
});
vm.runInContext(source.split('/* Interaktionen */')[0],ctx);
const run=s=>vm.runInContext(s,ctx);
vm.runInContext(source.slice(source.indexOf("document.addEventListener('submit'"),source.indexOf("document.addEventListener('input'")),ctx);
const fd=values=>({get:k=>values[k]??null,has:k=>Object.hasOwn(values,k),getAll:k=>values[k]||[]});
ctx.testFD=fd;
run(`queueSnapshot=()=>Promise.resolve();markCloudDirty=()=>{};queueSync=()=>{};
 data={members:[{id:'a',name:'Anna',active:true},{id:'b',name:'Berta',active:true}],meetings:[{id:'m1',date:'2020-01-01',time:'18:30',attendance:{a:{status:'present'}}}],excursions:[{id:'x1',title:'Hütte <Berg>',date:'2099-11-01',organizerIds:[]}],fines:[],payments:[]};page='meetings';render();`);
assert.match(app.innerHTML,/class="reader-entry" data-action="meeting-edit"/);
assert.match(app.innerHTML,/1 Dabei/);
run("meetingForm('m1')");assert.equal(dialog.open,false);
assert.match(app.innerHTML,/id="admin-entry"/);assert.match(app.innerHTML,/data-form="meeting"/);
assert.match(app.innerHTML,/meeting-delete/);assert.match(app.innerHTML,/data-action="attend"/);
const before=app.innerHTML;run('render()');assert.equal(app.innerHTML,before,'Background rendering preserves the form DOM');
run('adminEntry.dirty=true');confirmation=false;assert.equal(run('leaveAdminEntry()'),false);
assert.ok(run('adminEntry!==null'));
confirmation=true;assert.equal(run('leaveAdminEntry()'),true);assert.equal(run('adminEntry'),null);
run("excursionForm('x1')");assert.equal(dialog.open,false);
assert.match(app.innerHTML,/data-form="excursion"/);assert.match(app.innerHTML,/excursion-delete/);
assert.match(app.innerHTML,/data-action="excursion-admin-vote"/);
run('cloudReady=true;cloudUser={id:"admin"}');
ctx.mockRPC=async(name,args)=>{calls.push({name,args});return {error:null};};
run(`cloudClient={rpc:mockRPC};reloadExcursionVotes=async()=>{excursionVotes=[{excursion_id:'x1',member_id:'a',status:'yes'}];render();};`);
(async()=>{
 await run("adminExcursionVote('x1','a','yes')");
 assert.equal(calls[0].name,'fantastix_excursion_admin_vote');assert.match(counter.textContent,/1 dabei/);
 assert.equal(voteButton.disabled,false);assert.ok(run('adminEntry!==null'));
 run('closeModal()');
 run("saveFine(testFD({memberId:'a',amount:'5',reason:'Zu spät',date:'1900-01-01'}))");
 assert.equal(run('data.fines[0].date'),run('today()'),'Manual date is always the entry day');
 run("saveMeeting(testFD({id:'m1',date:'2020-01-01',time:'18:30','status-a':'present','status-b':'absent','reason-b':'Urlaub','fine-b':'10'}))");
 assert.equal(run("data.fines.find(f=>f.source==='absence').date"),run('today()'),'Absence fine uses entry day, not meeting day');
 run("data.fines.find(f=>f.source==='absence').date='2026-01-01'");
 run("saveMeeting(testFD({id:'m1',date:'2020-02-01',time:'18:30','status-a':'present','status-b':'absent','reason-b':'Urlaub','fine-b':'12'}))");
 assert.equal(run("data.fines.find(f=>f.source==='absence').date"),'2026-01-01','Editing a fine retains its original entry date');
 const snapshot=JSON.parse(run('JSON.stringify(publicSnapshot({members:true,meetings:true,fines:true}))'));
 assert.equal(snapshot.fines[0].date,run('today()'));
 assert.equal(snapshot.fines[1].date,'2026-01-01');
 assert.match(run('finesHTML()'),/Erfasst am:/);
 run("fineView(data.fines[0].id)");assert.match(dialog.innerHTML,/Erfasst am/);dialog.close();
 // Existing dialog forms and new page forms share the same submit handler.
 const fakeForm={dataset:{form:'fine'},matches:()=>true,fd:fd({memberId:'a',amount:'3',reason:'Test'})};
 await listeners.submit({target:fakeForm,preventDefault(){}});
 assert.equal(run('data.fines.length'),3);
 const readerCtx=vm.createContext({window:{}});
 vm.runInContext(fs.readFileSync(__dirname+'/lesen.js','utf8').split("document.addEventListener('submit'")[0],readerCtx);
 readerCtx.fixture=snapshot;
 vm.runInContext('data=fixture;',readerCtx);
 assert.match(vm.runInContext('cash()',readerCtx),/Erfasst am:/);
 assert.match(vm.runInContext('cash()',readerCtx),/01\. Jänner 2026|01\. Januar 2026/);
 assert.equal(alerts.length,0,alerts.join('\n'));
 console.log('PASS admin pages: matching lists, inline forms, retained drafts, discard handling, event votes, form submits, automatic/preserved fine dates and public reader dates.');
})().catch(e=>{console.error(e);process.exitCode=1;});
