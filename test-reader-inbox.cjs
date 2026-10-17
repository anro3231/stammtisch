// Synthetic inbox records and a mock persistence call; no Supabase access.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const calls=[],alerts=[],listeners={};let failure=false,pending=null,renders=0;
const source=fs.readFileSync(__dirname+'/lesen.js','utf8');
const ctx=vm.createContext({window:{},console,scrollTo(){},alert:x=>alerts.push(x),document:{addEventListener:(kind,fn)=>listeners[kind]=fn}});
const run=js=>vm.runInContext(js,ctx);
run(source.split("document.addEventListener('submit'")[0]);
ctx.mockRender=()=>renders++;
ctx.upsert=async(rows,options)=>{calls.push({rows,options});if(pending)await pending;return {error:failure?{message:'Keine Verbindung'}:null};};
run(`user={id:'reader-a'};cloud={from:table=>{if(table!=='fantastix_update_reads')throw Error('Wrong table');return {upsert};}};renderApp=mockRender;
readerUpdates=[{id:1,kind:'fine',title:'Alt',body:'Zu spät',created_at:'2026-10-01T10:00:00Z'},
{id:2,kind:'organizer_vote',title:'Neu <Test>',body:'Anna hat zugesagt.',created_at:'2026-10-17T10:00:00Z'},
{id:3,kind:'announcement',title:'Schon gelesen',body:'Eine Nachricht.',created_at:'2026-10-15T10:00:00Z'}];readerUpdateReads=new Set([3]);readerInboxOpen=true;`);
let html=run('readerInbox()');
assert.ok(html.indexOf('id="reader-read-all"')<html.indexOf('<article'),'Bulk action is above messages');
assert.match(html,/2 ungelesen · 3 Meldungen/);
assert.ok(html.indexOf('Neu &lt;Test&gt;')<html.indexOf('<strong>Alt</strong>'));
assert.equal((html.match(/data-reader-read=/g)||[]).length,2);
assert.doesNotMatch(html,/data-reader-read="3"/);
run(source.slice(source.indexOf("document.addEventListener('click'"),source.indexOf("$('#notice-dialog').addEventListener")));
(async()=>{
 await run("readerReadOne('2')");
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0].rows)),[{update_id:2,user_id:'reader-a'}]);
 assert.equal(calls[0].options.onConflict,'update_id,user_id');
 assert.equal(run('readerUpdateReads.has(2)'),true);assert.equal(run('readerUpdateReads.has(1)'),false);
 assert.match(run('readerInbox()'),/1 ungelesen/);assert.doesNotMatch(run('readerInbox()'),/data-reader-read="2"/);
 await run("readerReadOne('999')");assert.equal(calls.length,1,'Unknown messages cannot be marked');
 failure=true;await run('readerReadAll()');assert.equal(run('readerUpdateReads.has(1)'),false);assert.equal(alerts.length,1);assert.equal(run('readerReadBusy'),false);
 failure=false;let release;pending=new Promise(resolve=>release=resolve);
 const saving=run('readerReadAll()');assert.equal(run('readerReadBusy'),true);
 assert.match(run('readerInbox()'),/id="reader-read-all" disabled/);
 const before=calls.length;await run('readerReadAll()');assert.equal(calls.length,before,'Double clicks do not create parallel writes');
 release();await saving;pending=null;
 assert.equal(run('readerUpdateReads.size'),3);assert.match(run('readerInbox()'),/0 ungelesen/);
 assert.match(run('readerInbox()'),/id="reader-read-all" disabled/);assert.doesNotMatch(run('readerInbox()'),/data-reader-read=/);
 assert.equal(run('readerInboxOpen'),true,'Reading keeps the menu open');
 run('readerUpdateReads=new Set()');
 listeners.click({target:{closest:s=>s==='[data-reader-read]'?{dataset:{readerRead:'1'}}:null}});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(run('readerUpdateReads.has(1)'),true,'Single-message click is wired');
 run('readerUpdates=[]');assert.match(run('readerInbox()'),/Noch keine Benachrichtigungen/);
 assert.ok(renders>0);
 console.log('PASS reader inbox: top bulk action, single-message clicks, per-user persistence, unread count, chronology, escaping, disabled/busy states and failed writes.');
})().catch(e=>{console.error(e);process.exitCode=1;});
