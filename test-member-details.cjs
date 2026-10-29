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
const fixture={members:[{id:'a',name:'Anna <A>',memberNumber:1,historicalCount:40,historical2026Count:2},{id:'b',name:'Berta',memberNumber:2},{id:'c',name:'Archiv',active:false}],meetings:[
 {id:'future',date:'2099-01-01',attendance:{a:{status:'absent'},b:{status:'present'}}},
 {id:'old',date:'2026-01-01',attendance:{a:{status:'absent'},b:{status:'absent'}}},
 {id:'middle',date:'2026-10-01',location:'Gasthaus <Nord>',attendance:{a:{status:'present'},b:{status:'present'}}},
 {id:'latest',date:'2026-10-16',attendance:{a:{status:'present'},b:{status:'present'}}}
],excursions:[],fines:[{id:'f1',memberId:'a',amountCents:1000},{id:'f2',memberId:'a',amountCents:500},{id:'f3',memberId:'a',amountCents:100}],payments:[{id:'p1',fineId:'f1',amountCents:300},{id:'p2',fineId:'f2',amountCents:500}],sections:{members:true,meetings:true,fines:true,cash:true,excursions:true}};
const admin=environment('app.js'),reader=environment('lesen.js');
for(const env of [admin,reader]){
 env.ctx.fixture=structuredClone(fixture);env.run('data=fixture');
 assert.equal(env.run("currentStreak('a')"),2,'Historical totals and future RSVPs do not affect series');
 assert.equal(env.run("currentStreak('b')"),2);
 const card=env.run('strongestStreakHTML()');
 assert.match(card,/Anna &lt;A&gt;/);assert.match(card,/Berta/);assert.doesNotMatch(card,/Archiv/);
 env.run("data.meetings.find(m=>m.id==='latest').attendance.a={status:'absent'}");assert.equal(env.run("currentStreak('a')"),0);
 env.run("delete data.meetings.find(m=>m.id==='latest').attendance.a");assert.equal(env.run("currentStreak('a')"),0,'Unknown attendance breaks series');
 env.run("data.meetings.find(m=>m.id==='latest').attendance.a={status:'present'}");
 const html=env.run(env===admin?'homeHTML()':'dashboard()');
 assert.ok(html.indexOf('Kontostand')<html.indexOf('Ewige Rangliste'));
 assert.ok(html.indexOf('Ewige Rangliste')<html.indexOf('Jahresführ'));
 assert.ok(html.indexOf('Stärkste Stammtischserie')>html.indexOf('Nächster Event'));
 assert.match(html,/💰/);assert.match(html,/👑/);assert.match(html,/🔥/);
}
admin.run("page='members';render();memberForm('a')");
let detail=admin.elements.get('#app').innerHTML;
assert.equal(admin.run('adminEntry.kind'),'member');assert.equal(admin.run('page'),'members');
assert.equal(admin.elements.get('#dialog')?.open??false,false,'Member details open as a page');
assert.match(detail,/name="name"/);assert.match(detail,/name="memberNumber"/);assert.match(detail,/name="active"/);
assert.match(detail,/Aktuelle Stammtischserie/);assert.match(detail,/Offene Strafen[\s\S]*class="value">2/);
assert.match(detail,/8,00/);assert.match(detail,/aria-label="Dabei">👍/);assert.match(detail,/aria-label="Nicht dabei">👎/);
assert.match(detail,/Gasthaus &lt;Nord&gt;/);assert.doesNotMatch(detail,/2099/);
admin.run('adminEntry.dirty=true');admin.confirm(false);assert.equal(admin.run('leaveAdminEntry()'),false);
admin.confirm(true);assert.equal(admin.run('leaveAdminEntry()'),true);assert.equal(admin.run('page'),'members');
admin.run("persist=()=>{};queueSnapshot=()=>{};memberForm('a')");
admin.ctx.fd={get:key=>({id:'a',name:'Anna neu',memberNumber:'3'}[key]??null),has:key=>key==='active'};
admin.run('saveMember(fd)');assert.equal(admin.run("member('a').name"),'Anna neu');
assert.equal(admin.run("member('a').historicalCount"),40);assert.equal(admin.run("member('a').historical2026Count"),2);
assert.equal(admin.run('adminEntry'),null,'Saving returns to the member list');
reader.run("profile={member_id:'a'};tab='members';renderApp()");assert.match(reader.elements.get('#content').innerHTML,/data-reader-member="a"/);
vm.runInContext(reader.source.slice(reader.source.indexOf("document.addEventListener('click'"),reader.source.indexOf("$('#notice-dialog').addEventListener")),reader.ctx);
reader.listeners.click({target:{closest:s=>s==='[data-reader-member]'?{dataset:{readerMember:'a'}}:null}});
detail=reader.elements.get('#content').innerHTML;
assert.equal(reader.run('readerEntry.kind'),'member');assert.match(detail,/Anna &lt;A&gt;/);
assert.match(detail,/Offene Strafen[\s\S]*class="value">2/);assert.match(detail,/8,00/);
assert.match(detail,/aria-label="Dabei">👍/);assert.match(detail,/aria-label="Nicht dabei">👎/);assert.doesNotMatch(detail,/<form|<input|<select|data-vote|data-action=/,'Reader details contain no edit actions');
reader.run('renderApp()');assert.match(reader.elements.get('#content').innerHTML,/Aktuelle Stammtischserie/,'Refresh keeps member details open');
reader.listeners.click({target:{closest:s=>s==='[data-reader-back]'?{}:null}});assert.equal(reader.run('readerEntry'),null);assert.equal(reader.run('tab'),'members');
reader.run("data.sections.fines=false;data.sections.meetings=false");
detail=reader.run("memberDetails('a')");assert.match(detail,/Strafen nicht freigegeben/);assert.match(detail,/Stammtische sind nicht freigegeben/);assert.doesNotMatch(detail,/8,00|Gasthaus/);
assert.match(reader.run('strongestStreakHTML()'),/nicht freigegeben/);
reader.run("data.sections.members=false;openReaderEntry('member','a')");assert.equal(reader.run('readerEntry'),null,'Member permission is checked on navigation');
for(const env of [admin,reader]){env.run('data.members=[];data.meetings=[]');assert.equal(env.run("currentStreak('a')"),0);assert.doesNotThrow(()=>env.run('strongestStreakHTML()'));}
console.log('PASS member details: dashboard order, bottom series, streak breaks/ties, future exclusions, partial fines, admin editing/save/back, reader navigation/read-only, escaping and sharing permissions.');
