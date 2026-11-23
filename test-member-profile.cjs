// Both profile modes with synthetic data; no cloud reads, writes or deletion calls.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.FANTASTIX_JSDOM||'jsdom');
function setup(admin){
 const source=fs.readFileSync(__dirname+'/'+(admin?'app.js':'lesen.js'),'utf8');
 const dom=new JSDOM(fs.readFileSync(__dirname+'/'+(admin?'index.html':'lesen.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://example.test/',runScripts:'outside-only'}),w=dom.window;
 w.scrollTo=()=>{};w.alert=m=>{throw Error(m);};w.confirm=()=>true;w.Notification={permission:'granted'};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 const BaseDate=w.Date;w.Date=class extends BaseDate{constructor(...args){super(...(args.length?args:['2026-11-12T12:00:00Z']));}static now(){return new this().getTime();}};
 w.eval(source.split(admin?'/* Interaktionen */':"document.addEventListener('submit'")[0]+'\nwindow.run=code=>eval(code);');w.eval(fs.readFileSync(__dirname+'/ui-icons.js','utf8'));
 const start=source.indexOf("document.addEventListener('click'"),end=source.indexOf(admin?"document.addEventListener('submit'":"$('#notice-dialog').addEventListener",start);w.run(source.slice(start,end));
 w.fixture={annualWinners:[{year:2021,memberIds:['a']},{year:2025,memberIds:['a']}],members:[{id:'a',name:'Alex <A>',memberNumber:7,historicalCount:4000,historical2026Count:2000},{id:'b',name:'Archiv',active:false}],meetings:Array.from({length:25},(_,i)=>({id:'m'+i,date:'2026-10-'+String(i+1).padStart(2,'0'),location:'Gasthaus <Ort>',attendance:{a:{status:'present'}}})).concat([{id:'future',date:'2099-01-01',attendance:{a:{status:'absent'}}}]),excursions:[],fines:[{id:'f1',memberId:'a',amountCents:1000},{id:'f2',memberId:'a',amountCents:500},{id:'f3',memberId:'a',amountCents:100}],payments:[{fineId:'f1',amountCents:300},{fineId:'f2',amountCents:500}],sections:{members:true,meetings:true,fines:true,excursions:true}};
 w.run("data=window.fixture;avatarUrls={a:'https://example.test/avatar.png'};"+(admin?"page='members';memberForm('a');":"profile={member_id:'a'};user={id:'reader'};tab='members';openReaderEntry('member','a');"));
 return {dom,w,doc:w.document,run:w.run};
}
(async()=>{
 for(const admin of [false,true]){
  const {dom,w,doc,run}=setup(admin),root=()=>doc.querySelector(admin?'#admin-entry':'#content');
  assert.equal(doc.querySelector('.title').textContent,'Mitglied');assert.equal(root().querySelector('.member-profile-name').textContent,'Alex <A>');assert.equal(root().querySelector('.member-profile-name a'),null);
  assert.match(root().querySelector('.member-profile-number').textContent,/Nr. 7/);assert.equal(root().querySelector('.member-profile-status').textContent,'Aktives Mitglied');
  assert.equal(root().querySelectorAll('.member-stat').length,2);assert.deepEqual([...root().querySelectorAll('.member-trophies .item strong')].map(x=>x.textContent),['Jahressieger 2021','Jahressieger 2025']);assert.deepEqual([...root().querySelectorAll('.member-trophies .annual-winner-trophy')].map(x=>x.textContent),['🏆','🏅']);assert.deepEqual([...root().querySelectorAll('.member-stat .value')].map(x=>x.textContent),['25','2']);assert.match(root().querySelector('.member-summary').textContent,/8,00/);assert.equal(root().querySelectorAll('.member-stat-value svg').length,2);
  assert.doesNotMatch(root().textContent,/4000|2000|Teilnahmen gesamt|Ewig:|Jahresführung/,'Ranking totals are absent from the detail view');
  assert.equal(root().querySelectorAll('.member-history .item').length,10);assert.equal(root().querySelectorAll('.member-history .term-date-badge').length,10);assert.equal(root().querySelectorAll('.member-history-place svg').length,10);assert.doesNotMatch(root().querySelector('.member-history').textContent,/2099/);
  const photo=root().querySelector('[data-profile-photo]');photo.click();assert.ok(doc.querySelector('#profile-photo-viewer').open);doc.querySelector('.photo-viewer-close').click();assert.equal(run(admin?'adminEntry.id':'readerEntry.id'),'a');
  if(admin){
   const form=root().querySelector('form[data-form=member]');assert.ok(form);assert.equal(form.querySelector('form'),null);assert.equal(doc.querySelector('#birthday-day').form,form);assert.equal(doc.querySelector('#birthday-month').form,form);
   assert.equal(root().querySelectorAll('form').length,1);assert.equal(root().querySelector('.member-danger').open,false);assert.ok(root().querySelector('.member-danger [data-action=member-delete-confirm]'));
   form.querySelector('[name=name]').value='Alex Entwurf';run('adminEntry.dirty=true');root().querySelector('[data-action=member-history-more]').click();assert.equal(form.querySelector('[name=name]').value,'Alex Entwurf','History paging keeps unsaved editor fields');assert.equal(run('adminEntry.dirty'),true);
  }else{
   assert.equal(root().querySelector('form,input,select,.member-editor,.member-danger'),null);root().querySelector('[data-member-history-more]').click();
  }
  assert.equal(root().querySelectorAll('.member-history .item').length,20);root().querySelector('.history-more').click();assert.equal(root().querySelectorAll('.member-history .item').length,25);assert.equal(root().querySelector('.history-more'),null);
  assert.equal(run("member('a').historicalCount"),4000);assert.equal(run("member('a').historical2026Count"),2000);assert.equal(run('data.meetings.length'),26);
  if(!admin){run("data.sections.meetings=false;data.sections.fines=false;renderApp()");assert.equal(root().querySelectorAll('.member-history .item').length,0);assert.match(root().textContent,/Strafen nicht freigegeben/);assert.match(root().textContent,/Stammtische sind nicht freigegeben/);assert.doesNotMatch(root().textContent,/8,00|Gasthaus/);}
  run(admin?"adminEntry=null;memberForm('b');":"readerEntry=null;openReaderEntry('member','b');");assert.equal(root().querySelector('.member-profile-number'),null);assert.equal(root().querySelector('.member-profile-status').textContent,'Archiviertes Mitglied');assert.equal(root().querySelector('[data-profile-photo]'),null,'Missing avatar uses the existing placeholder');
  dom.window.close();
 }
 console.log('PASS member profiles: shared header/summary/history, no ranking totals, correct partial fines/streaks, safe names, photo lightbox, archive/no-photo states, read-only permissions, form ownership, collapsed removal and draft-safe history paging.');
})().catch(e=>{console.error(e);process.exitCode=1;});
