// Synthetic accounts only. JSDOM validates real form ownership and click handlers.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.FANTASTIX_JSDOM||'jsdom');
function environment(file,day='2026-10-24'){
 const dom=new JSDOM(fs.readFileSync(__dirname+'/'+(file==='app.js'?'index.html':'lesen.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://example.test/app/',runScripts:'outside-only'});
 const w=dom.window;Object.defineProperty(w.navigator,'onLine',{value:false});w.scrollTo=()=>{};w.alert=()=>{};w.confirm=()=>true;w.Notification={permission:'granted'};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const BaseDate=w.Date;w.Date=class extends BaseDate{constructor(...args){super(...(args.length?args:[day+'T12:00:00Z']));}static now(){return new this().getTime();}};
 const source=fs.readFileSync(__dirname+'/'+file,'utf8');w.eval(source.split(file==='app.js'?'/* Interaktionen */':"document.addEventListener('submit'")[0]+'\nwindow.testRun=code=>eval(code);');
 const clickStart=source.indexOf("document.addEventListener('click'");const clickEnd=source.indexOf(file==='app.js'?"document.addEventListener('submit'":"$('#notice-dialog').addEventListener",clickStart);w.testRun(source.slice(clickStart,clickEnd));
 const fixture={members:[{id:'a',name:'Anna <A>',memberNumber:12},{id:'b',name:'Berta'}],meetings:Array.from({length:25},(_,i)=>({id:'m'+i,date:'2026-09-'+String(i+1).padStart(2,'0'),location:'Ort '+i,organizerId:'a',attendance:{a:{status:'present'}}})).concat([{id:'today',date:'2026-10-24'},{id:'future',date:'2099-01-01'}]),excursions:[{id:'past',title:'Past',date:'2026-10-23'},{id:'future',title:'Future',date:'2099-01-01'},{id:'today',title:'Today',date:'2026-10-24'},{id:'ongoing',title:'Ongoing',date:'2026-10-23',endDate:'2026-10-25'},{id:'closed',title:'Closed',completed:true},{id:'open',title:'Open'}],fines:[],payments:[],sections:{members:true,meetings:true,excursions:true,fines:true}};
 w.fixture=fixture;w.testRun("data=fixture;"+(file==='lesen.js'?"profile={member_id:'a'};user={id:'reader'};":''));
 return {dom,w,run:s=>w.testRun(s),doc:w.document};
}

const env=environment('lesen.js');env.w.eval(fs.readFileSync(__dirname+'/calendar-view.js','utf8'));
const selected=()=>env.doc.querySelector('[data-calendar-day][aria-pressed="true"]')?.dataset.calendarDay;
assert.equal(env.run('calendarSelected'),'2026-10-24');assert.equal(env.run('calendarMonth'),'2026-10');
env.run("tab='calendar';renderApp()");assert.equal(selected(),'2026-10-24');
assert.ok(env.doc.querySelector('[data-calendar-day="2026-10-24"]').hasAttribute('aria-current'));
env.doc.querySelector('[data-calendar-day="2026-10-05"]').click();assert.equal(selected(),'2026-10-05');
env.run('renderApp()');assert.equal(selected(),'2026-10-05','Refresh preserves manually selected day');
env.doc.querySelector('[data-calendar-move="1"]').click();assert.equal(env.run('calendarMonth'),'2026-11');assert.equal(selected(),'2026-11-01');
env.doc.querySelector('[data-calendar-move="-1"]').click();assert.equal(selected(),'2026-10-24','Returning to current month selects today');
env.doc.querySelector('[data-calendar-day="2026-10-05"]').click();env.doc.querySelector('[data-calendar-today]').click();assert.equal(selected(),'2026-10-24');
env.doc.querySelector('[data-calendar-day="2026-10-05"]').click();env.doc.querySelector('[data-tab="members"]').click();env.doc.querySelector('[data-tab="calendar"]').click();assert.equal(selected(),'2026-10-24','Reopening calendar defaults to today');
env.dom.window.close();
for(const day of ['2026-01-31','2028-02-29','2026-12-31']){
 const e=environment('lesen.js',day);e.w.eval(fs.readFileSync(__dirname+'/calendar-view.js','utf8'));e.run("tab='calendar';renderApp()");
 assert.equal(e.doc.querySelector('[data-calendar-day][aria-pressed="true"]').dataset.calendarDay,day);e.dom.window.close();
}
console.log('PASS reader calendar selection: initial today, manual date and refresh, month navigation, today button, reopen, month/year boundaries and leap day.');
