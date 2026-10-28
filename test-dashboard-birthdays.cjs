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
const fixture={members:[{id:'a',name:'Anna',active:true}],meetings:[
 {id:'today',date:'2026-10-17',location:'HEUTE'},
 {id:'old1',date:'2026-10-16',location:'ALT1'},
 {id:'old2',date:'2026-10-15',location:'ALT2'},
 {id:'old3',date:'2026-10-14',location:'ALT3'},
 {id:'old4',date:'2026-10-13',location:'ALT4'}
],excursions:[],fines:[],payments:[],sections:{members:true,meetings:true,fines:true,cash:true,excursions:true}};
const admin=environment('app.js'),reader=environment('lesen.js');
for(const env of [admin,reader]){
 env.ctx.fixture=structuredClone(fixture);env.run('data=fixture');
 const dashboard=()=>env.run(env===admin?'homeHTML()':'dashboard()');
 let html=dashboard();let recent=html.split('Letzte 3 Stammtische')[1].split('</section>')[0];
 assert.match(recent,/ALT1/);assert.match(recent,/ALT2/);assert.match(recent,/ALT3/);
 assert.doesNotMatch(recent,/HEUTE|ALT4/);
 assert.match(html,/metric beer-countdown beer-today/);assert.match(html,/Heute gibt es Lecker Bierchen! 🍺/);
 assert.doesNotMatch(env.run('strongestStreakHTML()'),/Absagen und fehlende/);
 env.ctx.Date=class extends FixedDate {constructor(...args){super(...(args.length?args:['2026-10-18T12:00:00Z']));}};
 html=dashboard();recent=html.split('Letzte 3 Stammtische')[1].split('</section>')[0];
 assert.match(recent,/HEUTE/);assert.doesNotMatch(recent,/ALT3|ALT4/);
 assert.match(html,/metric beer-countdown/);assert.doesNotMatch(html,/beer-countdown beer-today|Heute gibt es Lecker Bierchen!/);
 env.run("data.meetings.push({id:'next',date:'2026-10-20'})");
 assert.match(dashboard(),/Lecker Bierchen[\s\S]*?class="value">2 Tage</);
}
const alerts=[];admin.ctx.alert=message=>alerts.push(message);
admin.run("cloudReady=true;cloudUser={id:'admin'};birthdays=[{member_id:'a',month:2,day:29}];memberForm('a')");
assert.match(admin.elements.get('#app').innerHTML,/name="birthdayDay"/);
assert.match(admin.elements.get('#app').innerHTML,/value="29"/);
assert.match(admin.elements.get('#app').innerHTML,/value="2" selected/);
admin.run('adminEditorRoot=()=>({querySelector:()=>null})');
let calls=[],rows=[],dbError=null;
admin.ctx.cloudMock={from(table){assert.equal(table,'fantastix_birthdays');return {
 upsert(value){calls.push(['upsert',value]);rows=[value];return this;},
 delete(){calls.push(['delete']);return this;},eq(key,value){calls.push(['eq',key,value]);return this;},
 async select(){return {data:rows,error:dbError};}
 };}};
admin.run(`cloudClient=cloudMock;persist=()=>{};closeModal=()=>{};function birthdayFD(month,day){const fields={id:'a',name:'Anna',memberNumber:'',active:'on',birthdayMonth:month===null?'':String(month),birthdayDay:day===null?'':String(day)};return {get:key=>fields[key]??null,has:key=>key in fields};}`);
(async()=>{
 await admin.run("saveMember(birthdayFD(2,30))");assert.equal(calls.length,0);assert.match(alerts.pop(),/gültigen/);
 admin.run('birthdays=[]');await admin.run("saveMember(birthdayFD(2,29))");assert.equal(calls[0][0],'upsert');assert.equal(admin.run('birthdays[0].day'),29);
 dbError={message:'Keine Berechtigung'};
 await admin.run("saveMember(birthdayFD(3,10))");assert.equal(admin.run('birthdays[0].month'),2);assert.match(alerts.pop(),/Keine Berechtigung/);
 dbError=null;rows=[{member_id:'a',month:2,day:29}];
 await admin.run("saveMember(birthdayFD(null,null))");assert.equal(admin.run('birthdays.length'),0);
 calls=[];admin.run('cloudReady=false');await admin.run("saveMember(birthdayFD(1,1))");assert.equal(calls.length,0);assert.match(alerts.pop(),/Cloud/);
 console.log('PASS dashboard day boundaries, latest three, today tile, future countdown, streak hints, birthday editing/leap day/validation/cloud failure/deletion/offline.');
})().catch(error=>{console.error(error);process.exitCode=1;});
