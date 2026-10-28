const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.FANTASTIX_JSDOM||'jsdom');
(async()=>{
 const dom=new JSDOM(fs.readFileSync(__dirname+'/lesen.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://example.test/app/',runScripts:'outside-only'}),w=dom.window,doc=w.document;
 w.alerts=[];w.alert=x=>w.alerts.push(x);w.CSS={escape:x=>x};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.eval(fs.readFileSync(__dirname+'/lesen.js','utf8').split("document.addEventListener('submit'")[0]+'\nwindow.run=code=>eval(code);');
 w.writes=[];w.mock={from:()=>({upsert:async record=>{w.writes.push(record);return {error:null};}})};
 w.run("user={id:'u'};profile={member_id:'a'};cloud=window.mock;data={members:[{id:'a',name:'Anna'}],meetings:[{id:'m',date:'2099-01-01',attendance:{a:{status:'unsure',note:'Alt'}}}],sections:{meetings:true,members:true}};deadlines.set('m','2098-12-31T00:00:00Z');window.refreshes=0;refresh=async()=>{window.refreshes++};");
 const run=w.run;
 doc.querySelector('#content').innerHTML=run('votePanel(data.meetings[0])');
 assert.ok(doc.querySelector('[data-meeting-note="m"]'));assert.equal(doc.querySelector('details.meeting-note-editor'),null);assert.equal(doc.querySelector('[data-meeting-note]').value,'Alt');
 doc.querySelector('[data-meeting-note]').value='Vielleicht <ab 20 Uhr>';await run("saveMeetingNote('m')");assert.equal(w.writes[0].note,'Vielleicht <ab 20 Uhr>');assert.equal(w.writes[0].member_id,'a');assert.equal(w.refreshes,1);
 // Simulate the next server read, then render both form and public roster.
 run("meetingNotes=[{meeting_id:'m',member_id:'a',note:'Vielleicht <ab 20 Uhr>'}]");
 doc.querySelector('#content').innerHTML=run('votePanel(data.meetings[0])+rsvpRoster(data.meetings[0])');assert.equal(doc.querySelector('[data-meeting-note]').value,'Vielleicht <ab 20 Uhr>');assert.equal(doc.querySelector('.meeting-note-visible').textContent,'📝 Vielleicht <ab 20 Uhr>');assert.equal(doc.querySelector('.meeting-note-visible ab'),null);
 doc.querySelector('[data-meeting-note]').value='';await run("saveMeetingNote('m')");run("meetingNotes=[{meeting_id:'m',member_id:'a',note:''}]");assert.equal(run('meetingNoteDisplay(data.meetings[0],"a")'),'','An explicitly cleared note overrides legacy JSON text');
 const count=w.writes.length;run("data.meetings[0].attendance.a.status='absent'");await run("saveMeetingNote('m')");assert.equal(w.writes.length,count);assert.match(w.alerts.at(-1),/Zusage oder „Unsicher“/);
 run("data.meetings[0].attendance.a.status='unsure';deadlines.set('m','2000-01-01T00:00:00Z')");await run("saveMeetingNote('m')");assert.equal(w.writes.length,count);assert.match(w.alerts.at(-1),/abgelaufen/);assert.ok(!run('votePanel(data.meetings[0])').includes('data-meeting-note='));
 dom.window.close();console.log('PASS unsure notes: always-visible editor, own note save/read/escaping, cleared text, absence exclusion and deadline checks.');
})().catch(e=>{console.error(e);process.exitCode=1;});
