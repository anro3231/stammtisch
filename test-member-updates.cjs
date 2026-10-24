// Synthetic accounts only. JSDOM validates real form ownership and click handlers.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.FANTASTIX_JSDOM||'jsdom');
function environment(file){
 const dom=new JSDOM(fs.readFileSync(__dirname+'/'+(file==='app.js'?'index.html':'lesen.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://example.test/app/',runScripts:'outside-only'});
 const w=dom.window;w.scrollTo=()=>{};w.alert=()=>{};w.confirm=()=>true;w.Notification={permission:'granted'};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const BaseDate=w.Date;w.Date=class extends BaseDate{constructor(...args){super(...(args.length?args:['2026-10-24T12:00:00Z']));}static now(){return new this().getTime();}};
 const source=fs.readFileSync(__dirname+'/'+file,'utf8');w.eval(source.split(file==='app.js'?'/* Interaktionen */':"document.addEventListener('submit'")[0]+'\nwindow.testRun=code=>eval(code);');
 const clickStart=source.indexOf("document.addEventListener('click'");const clickEnd=source.indexOf(file==='app.js'?"document.addEventListener('submit'":"$('#notice-dialog').addEventListener",clickStart);w.testRun(source.slice(clickStart,clickEnd));
 const fixture={members:[{id:'a',name:'Anna <A>',memberNumber:12},{id:'b',name:'Berta'}],meetings:Array.from({length:25},(_,i)=>({id:'m'+i,date:'2026-09-'+String(i+1).padStart(2,'0'),location:'Ort '+i,organizerId:'a',attendance:{a:{status:'present'}}})).concat([{id:'today',date:'2026-10-24'},{id:'future',date:'2099-01-01'}]),excursions:[{id:'past',title:'Past',date:'2026-10-23'},{id:'future',title:'Future',date:'2099-01-01'},{id:'today',title:'Today',date:'2026-10-24'},{id:'ongoing',title:'Ongoing',date:'2026-10-23',endDate:'2026-10-25'},{id:'closed',title:'Closed',completed:true},{id:'open',title:'Open'}],fines:[],payments:[],sections:{members:true,meetings:true,excursions:true,fines:true}};
 w.fixture=fixture;w.testRun("data=fixture;"+(file==='lesen.js'?"profile={member_id:'a'};user={id:'reader'};":''));
 return {dom,w,run:s=>w.testRun(s),doc:w.document};
}
const admin=environment('app.js'),reader=environment('lesen.js');
admin.run("page='members';cloudReady=true;cloudUser={id:'admin'};birthdays=[{member_id:'a',day:29,month:2}];memberForm('a')");
const main=admin.doc.querySelector('form[data-form="member"]'),birthday=admin.doc.querySelector('form[data-form="member-birthday"]');
assert.equal(main.querySelector('form'),null,'No nested forms');assert.equal(birthday.querySelector('form'),null);
assert.equal(admin.doc.querySelector('#birthday-day').form,birthday);
assert.ok(admin.doc.querySelector('#mnumber').compareDocumentPosition(admin.doc.querySelector('#birthday-day'))&4);
assert.ok(admin.doc.querySelector('#birthday-month').compareDocumentPosition(main.querySelector('[name="active"]'))&4);
const fd=new admin.w.FormData(main),bfd=new admin.w.FormData(birthday);assert.equal(fd.get('id'),'a');assert.equal(fd.has('day'),false);assert.equal(bfd.get('day'),'29');assert.equal(bfd.get('month'),'2');assert.equal(bfd.get('id'),'a');
admin.doc.querySelector('#mname').value='Unsaved name';admin.run('adminEntry.dirty=true');
for(const count of [10,20,26]){
 assert.equal(admin.doc.querySelectorAll('.member-history .item').length,count);
 const more=admin.doc.querySelector('[data-action="member-history-more"]');if(count<26){assert.ok(more);more.click();}else assert.equal(more,null);
}
assert.equal(admin.doc.querySelector('#mname').value,'Unsaved name');assert.equal(admin.run('adminEntry.dirty'),true,'History loading preserves the edit draft');
reader.run("openReaderEntry('member','a')");
for(const count of [10,20,26]){
 assert.equal(reader.doc.querySelectorAll('.member-history .item').length,count);
 const more=reader.doc.querySelector('[data-member-history-more]');if(count<26){assert.ok(more);more.click();}else assert.equal(more,null);
}
reader.run("openReaderEntry('member','b')");assert.equal(reader.doc.querySelectorAll('.member-history .item').length,10);
reader.run("readerEntry=null;tab='members';renderApp()");
assert.match(reader.doc.querySelector('[data-reader-member="a"] strong').textContent,/Nr. 12 · Anna <A>/);assert.equal(reader.doc.querySelector('[data-reader-member="b"] strong').textContent,'Berta');
assert.equal(reader.doc.querySelector('#content > section:last-child h2').textContent,'Nachricht an alle');
for(const env of [admin,reader]){
 const get=(page)=>env.run(env===admin?(page==='meetings'?'meetingsHTML()':'excursionsHTML()'):(page==='meetings'?'readerEntry=null;meetings()':'readerEntry=null;excursions()'));
 const root=env.doc.createElement('div');root.innerHTML=get('meetings');const meet=id=>root.querySelector(env===admin?`[data-action="meeting-edit"][data-id="${id}"]`:`[data-reader-meeting="${id}"]`);
 assert.equal(meet('m0').classList.contains('past-entry'),false);assert.ok(meet('m0').querySelector('.meeting-status.status-past')); assert.equal(meet('today').classList.contains('past-entry'),false);assert.match(meet('today').textContent,/Heute/);assert.equal(meet('future').classList.contains('past-entry'),false);
 root.innerHTML=get('events');const event=id=>root.querySelector(env===admin?`[data-action="excursion-edit"][data-id="${id}"]`:`[data-reader-excursion="${id}"]`);
 for(const [id,status] of [['past','Vergangen'],['future','Geplant'],['today','Heute'],['ongoing','Läuft'],['closed','Abgeschlossen'],['open','In Planung']])assert.ok(event(id).textContent.includes(status),id);
 assert.equal(event('past').classList.contains('past-entry'),false);assert.equal(event('closed').classList.contains('past-entry'),false);assert.ok(event('past').querySelector('.meeting-status.status-past'));assert.ok(event('closed').querySelector('.meeting-status.status-closed')); assert.equal(event('ongoing').classList.contains('past-entry'),false);
}
admin.dom.window.close();reader.dom.window.close();console.log('PASS member updates: 10/20/26 pagination, draft preservation, valid birthday forms/position, member numbers/escaping, message placement, status badges and neutral past rows.');
