// Execute actual claim migration in PostgreSQL (PGlite); no real push/network.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.FANTASTIX_PGLITE||'@electric-sql/pglite');
(async()=>{
 const db=new PGlite();await db.exec(`create schema auth;create schema private;
 create function auth.role() returns text language sql as $$select current_setting('test.role',true)$$;
 create table fantastix_private(id text primary key,content jsonb);
 create table fantastix_public(id text primary key,content jsonb,is_published boolean);
 create table fantastix_reader_profiles(user_id uuid primary key,member_id text);
 create table fantastix_push_events(event_key text primary key,object_id text,kind text,title text,body text,created_at timestamptz default now());
 create table fantastix_push_subscriptions(id bigint primary key,user_id uuid,endpoint text,p256dh text,auth_secret text,created_at timestamptz default now()-interval '1 day');
 create table fantastix_push_deliveries(event_key text,subscription_id bigint,user_id uuid,state text default 'pending',next_attempt_at timestamptz default now(),attempts integer default 0,claimed_at timestamptz,primary key(event_key,subscription_id));
 create function private.fantastix_push_eligible(text,text,uuid) returns boolean language sql as $$select true$$;`);
 const user1='00000000-0000-0000-0000-000000000001',user2='00000000-0000-0000-0000-000000000002',user3='00000000-0000-0000-0000-000000000003';
 const doc={members:[{id:'a',name:'Anna'},{id:'b',name:'Berta'}],meetings:[{id:'m1',organizerId:'a'},{id:'m2'}]};
 await db.query("insert into fantastix_private values('main',$1)",[doc]);await db.query("insert into fantastix_public values('main',$1,true)",[doc]);
 await db.query('insert into fantastix_reader_profiles values($1,$2),($3,$4)',[user1,'a',user2,'b']);
 await db.query("insert into fantastix_push_subscriptions(id,user_id,endpoint,p256dh,auth_secret) values(1,$1,'https://push.test/1','key','auth'),(2,$2,'https://push.test/2','key','auth'),(3,$3,'https://push.test/3','key','auth')",[user1,user2,user3]);
 for(const [key,id,kind,body] of [['meeting:m1','m1','meeting_new','Termin und Ort '.repeat(30)],['meeting:m2','m2','meeting_new','Unassigned'],['notice:n1','n1','announcement','Notice unchanged'],['event:e1','e1','event_new','Event unchanged']])await db.query('insert into fantastix_push_events(event_key,object_id,kind,title,body) values($1,$2,$3,$4,$5)',[key,id,kind,'Title',body]);
 const sql=fs.readFileSync(__dirname+'/26_STAMMTISCH_ORGANISATOR_PUSH.sql','utf8');await db.exec(sql);await db.exec(sql);
 await db.exec("select set_config('test.role','authenticated',false)");await assert.rejects(db.query('select * from fantastix_push_claim(100)'),/Nur Push-Server/);
 assert.equal((await db.query('select count(*)::int as n from fantastix_push_deliveries')).rows[0].n,0);
 await db.exec("select set_config('test.role','service_role',false)");const jobs=(await db.query('select * from fantastix_push_claim(100)')).rows;assert.equal(jobs.length,12);
 for(const j of jobs){
  assert.equal(j.title,'Title');
  if(j.event_key==='meeting:m1'){
   assert.match(j.body,/Organisator: Anna/);assert.ok(j.body.length<=220);assert.match(j.body,/Termin und Ort/);
   if(Number(j.subscription_id)===1)assert.match(j.body,/^Du wurdest als Organisator eingetragen\./);else assert.doesNotMatch(j.body,/Du wurdest/);
  }else if(j.event_key==='meeting:m2'){assert.match(j.body,/Organisator: Noch nicht festgelegt/);assert.doesNotMatch(j.body,/Du wurdest/);}
  else assert.equal(j.body,j.kind==='announcement'?'Notice unchanged':'Event unchanged');
 }
 assert.equal((await db.query('select * from fantastix_push_claim(100)')).rows.length,0,'No duplicate while sending');
 await db.exec("update fantastix_push_deliveries set state='sent'");assert.equal((await db.query('select * from fantastix_push_claim(100)')).rows.length,0,'Sent jobs not repeated');
 // Retry reuses current organizer data; previous organizer receives no personal hint.
 doc.meetings[0].organizerId='b';await db.query("update fantastix_private set content=$1 where id='main'",[doc]);
 await db.exec("update fantastix_push_deliveries set state='failed' where event_key='meeting:m1'");const retry=(await db.query('select * from fantastix_push_claim(100)')).rows;
 assert.equal(retry.length,3);assert.match(retry.find(j=>Number(j.subscription_id)===2).body,/^Du wurdest.*Organisator: Berta/);assert.doesNotMatch(retry.find(j=>Number(j.subscription_id)===1).body,/Du wurdest/);
 await db.close();console.log('PASS organizer push: migration rerun, service-role guard, recipient-specific hint, organizer name, missing organizer, length, unchanged event/notice, dedup and current-organizer retries.');
})().catch(e=>{console.error(e);process.exitCode=1;});
