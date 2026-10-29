// Synthetic data only; tests real DOM controls and save paths without contacting Supabase.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.FANTASTIX_JSDOM||'jsdom');
function environment(file){
 const dom=new JSDOM(fs.readFileSync(__dirname+'/'+(file==='app.js'?'index.html':'lesen.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://example.test/app/',runScripts:'outside-only'}),w=dom.window;
 w.scrollTo=()=>{};w.alerts=[];w.alert=x=>w.alerts.push(x);w.confirm=()=>true;w.Notification={permission:'granted'};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 const BaseDate=w.Date;w.Date=class extends BaseDate{constructor(...args){super(...(args.length?args:['2026-10-28T12:00:00Z']));}static now(){return new this().getTime();}};
 const source=fs.readFileSync(__dirname+'/'+file,'utf8');w.eval(source.split(file==='app.js'?'/* Interaktionen */':"document.addEventListener('submit'")[0]+'\nwindow.run=code=>eval(code);');
 const clickStart=source.indexOf("document.addEventListener('click'"),clickEnd=source.indexOf(file==='app.js'?"document.addEventListener('submit'":"$('#notice-dialog').addEventListener",clickStart);w.run(source.slice(clickStart,clickEnd));
 const changeStart=source.indexOf("document.addEventListener('change'"),changeEnd=source.indexOf(file==='app.js'?"if(t?.id!=='backupFile')":"navigator.serviceWorker?",changeStart);
 if(file==='app.js')w.run(source.slice(changeStart,changeEnd)+'});');else w.run(source.slice(changeStart,changeEnd));
 w.eval(fs.readFileSync(__dirname+'/ui-icons.js','utf8'));
 w.fixture={members:[{id:'a',name:'Anna <A>',memberNumber:1},{id:'b',name:'Berta',memberNumber:2},{id:'c',name:'Claus',memberNumber:3},{id:'d',name:'Dora',memberNumber:4}],meetings:[{id:'m',date:'2099-01-01',location:'Gasthaus <Alt>',attendance:{a:{status:'present'},b:{status:'unsure'},c:{status:'absent',reason:'Urlaub'}},organizerId:'a'}],excursions:[{id:'e',title:'Ausflug',date:'2099-01-01',organizerIds:['a']}],fines:[{id:'f1',memberId:'a',date:'2026-10-28',reason:'Zu spät',amountCents:500},{id:'f2',memberId:'b',date:'2026-10-27',reason:'Handy',amountCents:300}],payments:[],sections:{members:true,meetings:true,excursions:true,fines:true,cash:true}};
 w.run("data=fixture;avatarUrls={a:'https://example.test/photo.jpg'};"+(file==='app.js'?"page='home';":"profile={member_id:'a'};user={id:'reader'};tab='dashboard';deadlines.set('m','2098-12-31T00:00:00Z');"));
 return {dom,w,doc:w.document,run:w.run};
}
(async()=>{
 for(const file of ['app.js','lesen.js']){
  const env=environment(file),{w,doc,run}=env,admin=file==='app.js';
  run(admin?'render()':'renderApp()');
  run("excursionVotes=[{excursion_id:'e',member_id:'a',status:'yes'},{excursion_id:'e',member_id:'b',status:'unsure'},{excursion_id:'e',member_id:'c',status:'no'}]");
  const summary=run(admin?'adminCountSummary(excursionVoteCounts("e"))':'readerCountSummary(excursionCount("e"))');const counts=doc.createElement('div');counts.innerHTML=summary;assert.match(counts.textContent,/👍 1.*👎 1.*❓ 1/);assert.doesNotMatch(counts.textContent,/offen|Dabei|Zusagen|Absagen|Unsicher/);assert.equal(counts.querySelectorAll('[role="img"]').length,3);for(const [status,emoji,label] of [['present','👍','Dabei'],['absent','👎','Nicht dabei'],['unsure','❓','Unsicher']]){const badge=doc.createElement('div');badge.innerHTML=run(`voteStatusHTML('${status}')`);assert.equal(badge.textContent,emoji);assert.equal(badge.firstElementChild.getAttribute('aria-label'),label);}assert.equal(run('voteStatusHTML(undefined)'),'Noch offen', 'Unanswered members keep their visible status');
  if(admin)assert.match(run('eventVoteSummary("e")'),/👍 1 · 👎 1 · ❓ 1/);
  else{const roster=doc.createElement('div');roster.innerHTML=run('excursionRoster(data.excursions[0])');assert.match(roster.querySelector('.roster-header').textContent,/👍 1.*👎 1.*❓ 1/);assert.match(roster.textContent,/❓/,'Individual unsure votes remain visible');assert.match(roster.querySelector('.roster-list').textContent,/DoraNoch offen/);assert.doesNotMatch(roster.querySelector('.roster-header').textContent,/Noch offen/,'Unanswered votes remain excluded from totals');}
  const preview=doc.querySelector('.rsvp-preview');assert.match(preview.textContent,/👍 1.*👎 1.*❓ 1/);assert.equal(preview.querySelectorAll('[data-profile-photo]').length,1);
  preview.querySelector('img').click();assert.ok(doc.querySelector('#profile-photo-viewer').open);assert.equal(doc.querySelector('.profile-photo-large').src,'https://example.test/photo.jpg');doc.querySelector('.photo-viewer-close').click();assert.equal(doc.querySelector('.profile-photo-large').hasAttribute('src'),false);
  run(admin?"page='members';render()":"tab='members';renderApp()");
  assert.ok(!doc.querySelector('.member-list-row').textContent.includes('Ewig'));assert.equal(doc.querySelectorAll('.member-list-row [data-profile-photo]').length,1);assert.equal(doc.querySelector('button [data-profile-photo]'),null,'No nested interactive photo control');
  const photo=doc.querySelector('[data-profile-photo]');photo.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.ok(doc.querySelector('#profile-photo-viewer').open);assert.equal(run(admin?'adminEntry':'readerEntry'),null,'Photo does not open member editor');doc.querySelector('.photo-viewer-close').click();
  if(!admin){assert.equal(doc.querySelector('#birthday-form'),null);assert.ok(!doc.body.textContent.includes('Geburtstag speichern'));}
  run(admin?"page='fines';render()":"tab='cash';renderApp()");
  // Reader uses the nav key cash in this version; render directly to avoid navigation assumptions.
  if(!doc.querySelector('#fine-member-filter'))doc.querySelector('#content').innerHTML=run('cash()');
  const headings=[...doc.querySelectorAll(admin?'#app h2':'#content h2')].map(x=>x.textContent);
  assert.ok(headings.indexOf('Offene Strafen pro Mitglied')<headings.indexOf('Einzelne Strafen'),'Same fine section order in both modes');
  assert.equal(doc.querySelectorAll('[data-fine-row]').length,2);const select=doc.querySelector('#fine-member-filter');select.value='a';select.dispatchEvent(new w.Event('change',{bubbles:true}));
  if(!doc.querySelector('#fine-member-filter'))doc.querySelector('#content').innerHTML=run('cash()');
  assert.equal(doc.querySelectorAll('[data-fine-row]').length,1);assert.ok(doc.querySelector('[data-fine-row="f1"]'));assert.equal(run('data.fines.length'),2);
  run("data.fines=Array.from({length:27},(_,i)=>({id:'page'+i,memberId:i<23?'a':'b',date:'2026-10-'+String(i+1).padStart(2,'0'),reason:'Strafe '+i,amountCents:100}));fineMemberFilter='';fineListLimit=10;");
  run(admin?"page='fines';render()":"tab='cash';renderApp()");
  for(const expected of [10,20,27]){
   assert.equal(doc.querySelectorAll('[data-fine-row]').length,expected);const more=doc.querySelector('[data-fines-more]');if(expected<27){assert.ok(more);more.click();}else assert.equal(more,null);
  }
  const memberFilter=doc.querySelector('#fine-member-filter');memberFilter.value='a';memberFilter.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(doc.querySelectorAll('[data-fine-row]').length,10,'Changing member resets pagination');
  assert.equal(doc.querySelector('[data-fine-row]').dataset.fineRow,'page22','Newest matching fine first');doc.querySelector('[data-fines-more]').click();assert.equal(doc.querySelectorAll('[data-fine-row]').length,20);doc.querySelector('[data-fines-more]').click();assert.equal(doc.querySelectorAll('[data-fine-row]').length,23);assert.equal(doc.querySelector('[data-fines-more]'),null);assert.equal(run('data.fines.length'),27,'Loading more never changes fine data');
  run(admin?"page='ranking';render()":"tab='ranking';renderApp()");
  assert.equal(doc.querySelector('.ranking-filters select'),null);const all=doc.querySelector(admin?'[data-action="rank-year"][data-year="all"]':'[data-year="all"]');assert.ok(all);all.click();assert.equal(doc.querySelector('[data-year="all"]').getAttribute('aria-pressed'),'true');
  if(admin){
   assert.ok(!run('meetingsHTML()').includes('Nächster Organisator'));
   run("page='meetings';meetingForm('m')");assert.equal(doc.querySelector('input[name="location"]').getAttribute('list'),'known-inns');assert.equal(doc.querySelector('#known-inns option').value,'Gasthaus <Alt>');
   assert.deepEqual([...doc.querySelector('.member-att').querySelectorAll('[data-action="attend"]')].map(b=>b.dataset.status),['present','unsure','absent']);
   const before=run('allTime("b")');assert.equal(before,0,'Unsure is not attendance');run("data.meetings.push({id:'past',date:'2026-01-01',attendance:{b:{status:'unsure'}}})");assert.equal(run("stats('b').eligible"),0,'Unsure does not affect attendance percentage');
   run("rememberInn('Neues Wirtshaus');data.meetings=[]");assert.ok(run('knownInns().includes("Neues Wirtshaus")'));
  }else{
   doc.querySelector('#content').innerHTML=run("votePanel(data.meetings[0])");assert.deepEqual([...doc.querySelectorAll('[data-vote]')].map(b=>b.dataset.vote),['present','unsure','absent']);assert.equal(doc.querySelector('details.meeting-note-editor'),null);assert.ok(doc.querySelector('.meeting-note-input'));
   w.sent=[];run("castVote=(id,status)=>window.sent.push([id,status]);");doc.querySelector('[data-vote="unsure"]').click();assert.deepEqual(JSON.parse(JSON.stringify(w.sent)),[['m','unsure']]);
   run("data.meetings[0].attendance.a={status:'unsure'};");doc.querySelector('#content').innerHTML=run('votePanel(data.meetings[0])');assert.ok(doc.querySelector('.meeting-note-input'));assert.equal(doc.querySelector('[aria-label="Unsicher"]').getAttribute('aria-pressed'),'true');
   run("excursionVotes=[{excursion_id:'e',member_id:'a',status:'unsure'}]");assert.equal(run('excursionCount("e").unsure'),1);
  }
  env.dom.window.close();
 }
 const env=environment('app.js'),{w,doc,run}=env;
 run("page='members';cloudReady=true;cloudUser={id:'admin'};birthdays=[{member_id:'a',day:29,month:2}];memberForm('a');persist=()=>{};closeModal=()=>{};");
 const form=doc.querySelector('form[data-form="member"]');assert.equal(doc.querySelector('#birthday-day').form,form);assert.equal(doc.querySelector('form form'),null);assert.equal(doc.querySelector('[data-action="member-birthday-remove"]'),null);
 w.saved=[];w.backendError=null;w.cloudMock={from:table=>({upsert(value){w.saved.push({table,value});return this;},delete(){w.saved.push({table,deleted:true});return this;},eq(){return this;},async select(){return {data:[{member_id:'a'}],error:w.backendError};}})};run('cloudClient=window.cloudMock;');
 const fd=()=>new w.FormData(form);doc.querySelector('#birthday-day').value='30';await run('saveMember')(fd());assert.equal(w.saved.length,0,'Invalid February date is rejected');
 doc.querySelector('#birthday-day').value='28';doc.querySelector('#mname').value='Anna neu';w.backendError={message:'offline'};await run('saveMember')(fd());assert.equal(run('member("a").name'),'Anna <A>','Failed birthday write keeps member editor and original name');assert.equal(run('birthdays[0].day'),29);
 w.backendError=null;await run('saveMember')(fd());assert.equal(run('member("a").name'),'Anna neu');assert.equal(run('birthdays[0].day'),28);assert.equal(w.saved.at(-1).value.day,28);
 doc.querySelector('#birthday-day').value='';doc.querySelector('#birthday-month').value='';await run('saveMember')(fd());assert.equal(run('birthdays.length'),0);assert.ok(w.saved.at(-1).deleted);
 env.dom.window.close();console.log('PASS member experience: photo lightbox/keyboard, compact members, birthday save/error/delete, fine filter/order, ranking buttons, three-state votes, notes and remembered inns.');
})().catch(e=>{console.error(e);process.exitCode=1;});
