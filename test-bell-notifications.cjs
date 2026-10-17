// Synthetic PostgreSQL + render tests. No messages are sent to real accounts.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.FANTASTIX_TEST_DEPS?path.join(process.env.FANTASTIX_TEST_DEPS,'@electric-sql/pglite'):'@electric-sql/pglite');
(async()=>{
 const db=new PGlite(),q=async(sql,args=[]) => (await db.query(sql,args)).rows;
 const ids=Array.from({length:5},(_,i)=>`00000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`);
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table fantastix_private(id text,content jsonb);
 create table fantastix_public(id text,content jsonb,is_published boolean);
 create table fantastix_reader_profiles(user_id uuid,member_id text);
 create table fantastix_excursion_votes(excursion_id text,member_id text,status text,note text);
 alter table fantastix_private enable row level security;
 create policy admin_only on fantastix_private using(auth.uid()='${ids[0]}'::uuid);
 alter table fantastix_reader_profiles enable row level security;
 create policy own_profile on fantastix_reader_profiles using(user_id=auth.uid());
 grant usage on schema auth,public to authenticated;
 grant select on fantastix_private,fantastix_reader_profiles to authenticated;`);
 for(const name of ['20_BENACHRICHTIGUNGEN_ONLINE.sql','21_ADMIN_EVENT_ABSTIMMUNGEN.sql','22_BENACHRICHTIGUNGEN_KORREKTUR.sql'])await db.exec(fs.readFileSync(__dirname+'/'+name,'utf8'));
 const doc={members:[{id:'o1',name:'Anna'},{id:'o2',name:'Berta'},{id:'v',name:'Clemens'},{id:'other',name:'Dora'}],meetings:[{id:'m',date:'2026-10-20',location:'Gasthaus',attendance:{}}],excursions:[{id:'e',title:'Hüttenausflug',organizerIds:[]}],fines:[],payments:[]};
 await q("insert into fantastix_private values('main',$1)",[JSON.stringify(doc)]);
 await q("insert into fantastix_public values('main',$1,true)",[JSON.stringify(doc)]);
 for(let i=0;i<ids.length;i++){
  await q('insert into auth.users values($1)',[ids[i]]);
  if(i>0)await q('insert into fantastix_reader_profiles values($1,$2)',[ids[i],['o1','o2','v','other'][i-1]]);
 }
 const migration=fs.readFileSync(__dirname+'/25_GLOCKEN_ORGANISATOREN.sql','utf8');
 await db.exec(migration);await db.exec(migration);
 assert.equal((await q('select * from fantastix_updates')).length,0,'No historical notifications');
 const save=()=>q('update fantastix_private set content=$1',[JSON.stringify(doc)]);
 const notices=()=>q('select * from fantastix_updates order by id');
 doc.meetings[0].organizerId='o1';doc.meetings[0].attendance.v={status:'present'};
 doc.excursions[0].organizerIds=['o1','o2','o2'];doc.fines=[{id:'f',memberId:'v',reason:'Zu spät',amountCents:500}];
 await save();let rows=await notices();
 assert.equal(rows.length,6);
 assert.equal(rows.filter(x=>x.kind==='organizer_assignment').length,3);
 assert.equal(rows.filter(x=>x.kind==='organizer_vote'&&x.recipient_member_id==='o1').length,1);
 assert.equal(rows.filter(x=>x.kind==='vote'&&x.recipient_member_id==='ADMIN').length,1);
 assert.match(rows.find(x=>x.kind==='fine').body,/Du hast eine neue Strafe erhalten.*5,00 €/);
 assert.ok(rows.every(x=>/[.!?]$/.test(x.body)),'Every new body is a sentence');
 await save();await q('update fantastix_public set content=$1',[JSON.stringify(doc)]);
 assert.equal((await notices()).length,6,'No duplicate from sync/publication');
 await q("insert into fantastix_excursion_votes values('e','v','yes','')");
 rows=await notices();assert.equal(rows.length,9);assert.equal(rows.filter(x=>x.title==='Event-Zusage').length,3);
 await q("update fantastix_excursion_votes set note='Komme später'");assert.equal((await notices()).length,9);
 await q("update fantastix_excursion_votes set status='no'");await q("update fantastix_excursion_votes set status='yes'");
 assert.equal((await notices()).length,15,'Rapid repeated status changes are valid');
 await q('delete from fantastix_excursion_votes');assert.equal((await notices()).length,18,'Withdrawals reach admin and both organizers');
 doc.meetings[0].attendance.v={status:'absent'};await save();assert.equal((await notices()).length,20);
 delete doc.meetings[0].attendance.v;await save();assert.equal((await notices()).length,22);
 doc.meetings[0].organizerId='o2';doc.excursions[0].organizerIds=['o1','o2','v'];await save();
 rows=await notices();assert.equal(rows.length,24,'Only newly assigned organizers notified');
 assert.equal(rows.filter(x=>x.kind==='organizer_assignment'&&x.recipient_member_id==='v').length,1);
 doc.meetings[0].attendance.v={status:'present'};await save();
 rows=await notices();assert.equal(rows.at(-1).recipient_member_id,'o2','Current organizer receives votes');
 doc.fines[0].reason='Zu spät geändert';await save();assert.equal((await notices()).length,26,'Editing fine does not create another fine notice');
 doc.payments=[{id:'p',fineId:'f',amountCents:200}];await save();assert.equal((await notices()).length,26);
 doc.payments[0].amountCents=500;await save();assert.equal((await notices()).length,27);
 // RLS: organizers see only their own organizer messages; admin votes remain private.
 await db.exec('set role authenticated');
 for(let i=1;i<ids.length;i++){
  await q("select set_config('test.uid',$1,false)",[ids[i]]);
  const own=await notices(),mid=['o1','o2','v','other'][i-1];
  assert.ok(own.every(x=>x.recipient_member_id===mid||x.recipient_member_id===null));
  assert.ok(own.every(x=>x.kind!=='vote'));
  if(mid==='other')assert.equal(own.length,0);
 }
 await q("select set_config('test.uid',$1,false)",[ids[0]]);
 assert.ok((await notices()).some(x=>x.kind==='vote'));
 await db.exec('reset role');await db.close();
 // Both inboxes translate old terse content and render readable labels safely.
 const adminSource=fs.readFileSync(__dirname+'/app.js','utf8');
 const ctx=vm.createContext({window:{},localStorage:{getItem:()=>null}});
 vm.runInContext(adminSource.split('/* Interaktionen */')[0],ctx);
 vm.runInContext(`fxNewAlerts=[{id:1,kind:'vote',title:'Event-Zusage',body:'Anna · Hütte <Nord>',created_at:'2026-10-17T10:00:00Z'}]`,ctx);
 assert.match(vm.runInContext('fxInboxHTML()',ctx),/Anna hat für das Event Hütte &lt;Nord&gt; zugesagt/);
 const reader=vm.createContext({window:{}});
 vm.runInContext(fs.readFileSync(__dirname+'/lesen.js','utf8').split("document.addEventListener('submit'")[0],reader);
 vm.runInContext(`readerUpdates=[{id:1,kind:'organizer_vote',title:'Event-Zusage',body:'Anna hat für dein Event „Hütte“ zugesagt.',created_at:'2026-10-17T10:00:00Z'}]`,reader);
 const html=vm.runInContext('readerInbox()',reader);assert.match(html,/Abstimmung zu deinem Termin/);assert.doesNotMatch(html,/>organizer_vote</);
 console.log('PASS bell notifications: admin votes, multi-organizer assignments/votes, withdrawals, current ownership, private fines/payments, no publication duplicates, RLS and readable escaped sentences.');
})().catch(e=>{console.error(e);process.exitCode=1;});
