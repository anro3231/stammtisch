// Runs the SQL in embedded PostgreSQL (PGlite); never connects to Supabase.
// Optional dependencies: npm install --no-save @electric-sql/pglite@0.3.14 web-push@3.6.7
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dep=name=>require(process.env.FANTASTIX_TEST_DEPS?path.join(process.env.FANTASTIX_TEST_DEPS,name):name);
const {PGlite}=dep('@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 const exec=s=>db.exec(s),query=async(s,args=[]) => (await db.query(s,args)).rows;
 await exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table public.fantastix_reader_profiles(user_id uuid,member_id text);
 create table public.fantastix_private(id text,content jsonb);
 create table public.fantastix_public(id text,content jsonb,is_published boolean);
 create table public.fantastix_updates(id bigint generated always as identity,kind text,title text,body text,recipient_member_id text);
 create schema vault;create table vault.decrypted_secrets(name text,decrypted_secret text);
 create schema net;create function net.http_post(url text,headers jsonb,body jsonb) returns bigint language sql as $$select 1::bigint$$;
 create schema cron;create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;`);
 const sql=fs.readFileSync(__dirname+'/24_ABSTIMMUNGSERINNERUNGEN.sql','utf8');
 const withoutExtensions=sql.replace(/^create extension .*;$/gm,'');
 await exec(withoutExtensions);await exec(withoutExtensions); // Idempotent migration.
 const users=['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003'];
 for(let i=0;i<users.length;i++){
  await query('insert into auth.users values($1);',[users[i]]);
  await query('insert into fantastix_reader_profiles values($1,$2)',[users[i],['a','b','archived'][i]]);
 }
 const [{date,time}]=await query(`select to_char((now()+interval '2 hours') at time zone 'Europe/Vienna','YYYY-MM-DD') as date,to_char((now()+interval '2 hours') at time zone 'Europe/Vienna','HH24:MI') as time`);
 const document={members:[{id:'a',active:true},{id:'b',active:true},{id:'archived',active:false}],meetings:[{id:'m1',date,time,attendance:{a:{status:'present'}}}],rsvpCutoffHours:0,rsvpReminderHours:24,rsvpReminderEnabled:true};
 await query('insert into fantastix_private values(\'main\',$1)',[JSON.stringify(document)]);
 await query('insert into fantastix_public values(\'main\',$1,true)',[JSON.stringify({...document,sections:{meetings:true}})]);
 const sub=ep=>({endpoint:'https://fcm.googleapis.com/fcm/send/'+ep,keys:{p256dh:'A'.repeat(87),auth:'A'.repeat(22)}});
 await assert.rejects(()=>query('select fantastix_reminder_subscribe($1)',[JSON.stringify(sub('unauthorized'))]),/Mitglied/);
 for(let i=0;i<users.length;i++){
  await query("select set_config('test.uid',$1,false)",[users[i]]);
  await query('select fantastix_reminder_subscribe($1)',[JSON.stringify(sub(String(i)))]);
 }
 await assert.rejects(()=>query('select fantastix_reminder_subscribe($1)',[JSON.stringify({endpoint:'http://localhost/test',keys:{}})]),/Ungültiges/);
 assert.equal((await query('select fantastix_reminder_enqueue() as n'))[0].n,1);
 assert.equal((await query('select fantastix_reminder_enqueue() as n'))[0].n,0,'Repeated ticks never create another event');
 assert.equal((await query('select * from fantastix_updates')).length,2,'Both voters and nonvoters receive an entry; archived members do not');
 let jobs=await query('select * from fantastix_reminder_claim(30)');assert.equal(jobs.length,2);
 assert.ok(jobs.every(x=>x.payload.kind==='vote_reminder'));
 assert.equal((await query('select * from fantastix_reminder_claim(30)')).length,0,'Leases prevent simultaneous delivery');
 await query('select fantastix_reminder_finish($1,$2,201)',[jobs[0].id,jobs[0].lease_token]);
 await query('select fantastix_reminder_finish($1,$2,503)',[jobs[1].id,jobs[1].lease_token]);
 assert.equal((await query('select * from fantastix_reminder_claim(30)')).length,0,'Transient failures back off');
 await exec("update fantastix_reminder_deliveries set next_attempt_at=now()-interval '1 minute' where status='pending'");
 const retry=(await query('select * from fantastix_reminder_claim(30)'))[0];assert.equal(retry.id,jobs[1].id);
 await query('select fantastix_reminder_finish($1,$2,201)',[retry.id,jobs[1].lease_token]);
 assert.equal((await query('select status from fantastix_reminder_deliveries where id=$1',[retry.id]))[0].status,'sending','Old lease cannot acknowledge a new attempt');
 await query('select fantastix_reminder_finish($1,$2,410)',[retry.id,retry.lease_token]);
 assert.equal((await query('select * from fantastix_reminder_subscriptions')).length,2,'Expired endpoint removed');
 async function setDoc(doc){await query('update fantastix_private set content=$1',[JSON.stringify(doc)]);await query('update fantastix_public set content=$1',[JSON.stringify({...doc,sections:{meetings:true}})]);}
 document.meetings[0].id='m2';document.rsvpReminderEnabled=false;await setDoc(document);
 assert.equal((await query('select fantastix_reminder_enqueue() as n'))[0].n,0,'Disabled reminder does not enqueue');
 document.rsvpReminderEnabled=true;document.rsvpReminderHours=1;await setDoc(document);
 assert.equal((await query('select fantastix_reminder_enqueue() as n'))[0].n,0,'Lead time is relative to deadline');
 document.rsvpReminderHours=24;await setDoc(document);await query('select fantastix_reminder_enqueue()');
 document.rsvpReminderEnabled=false;await setDoc(document);
 assert.equal((await query('select * from fantastix_reminder_claim(30)')).length,0,'Disabling cancels queued work');
 document.rsvpReminderEnabled=true;document.meetings[0].id='m3';await setDoc(document);await query('select fantastix_reminder_enqueue()');
 await exec("update fantastix_public set is_published=false");
 assert.equal((await query('select * from fantastix_reminder_claim(30)')).length,0,'Unpublishing cancels pending delivery');
 await exec("update fantastix_public set is_published=true");
 document.meetings[0].id='m4';await setDoc(document);await query('select fantastix_reminder_enqueue()');
 await exec("delete from fantastix_reader_profiles where member_id in ('a','b')");
 assert.equal((await query('select * from fantastix_reminder_claim(30)')).length,0,'Unlinked and expired endpoints do not get sent');
 // Exact time-zone semantics, including the DST boundary.
 await query('delete from fantastix_private');await query('delete from fantastix_public');
 const futureYear=new Date().getUTCFullYear()+2;
 for(const [month,expectedHour] of [['07','16'],['12','17']]){
  document.meetings=[{id:'tz',date:`${futureYear}-${month}-15`,time:'18:30'}];document.rsvpCutoffHours=24;
  await query('insert into fantastix_private values(\'main\',$1)',[JSON.stringify(document)]);
  await query('insert into fantastix_public values(\'main\',$1,true)',[JSON.stringify({...document,sections:{meetings:true}})]);
  const w=(await query('select * from fantastix_reminder_windows()'))[0];assert.ok(new Date(w.deadline_at).toISOString().includes(`14T${expectedHour}:30`));
  await exec('delete from fantastix_private;delete from fantastix_public');
 }
 assert.equal((await query("select has_function_privilege('authenticated','public.fantastix_reminder_claim(integer)','EXECUTE') as ok"))[0].ok,false);
 assert.equal((await query("select has_table_privilege('authenticated','public.fantastix_reminder_subscriptions','SELECT') as ok"))[0].ok,false);
 await exec("select fantastix_reminder_tick()");
 await db.close();
 console.log('PASS reminder SQL: migration replay, auth/RLS, recipients, idempotency, lead time, disabled/unpublished/unlinked cases, retries, leases, endpoint cleanup and Vienna time zones.');
})().catch(e=>{console.error(e);process.exitCode=1;});
