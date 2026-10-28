// Read/render tests with mock notes only. No live Supabase calls.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let html='',status=null;
const notes=[{dataset:{meetingMemberNote:'a'},textContent:'',hidden:true},{dataset:{meetingMemberNote:'b'},textContent:'',hidden:true}];
const inputs=[{name:'status-a',value:'present'},{name:'status-b',value:'absent'}];
const root={querySelectorAll:s=>s==='[data-meeting-member-note]'?notes:s==='input[name]'?inputs:[]};
const ctx=vm.createContext({console,crypto:require('node:crypto'),window:{},
 localStorage:{getItem:()=>null},document:{getElementById:()=>status},alert(){}});
const run=s=>vm.runInContext(s,ctx);
run(fs.readFileSync(__dirname+'/app.js','utf8').split('/* Interaktionen */')[0]);
ctx.capture=value=>{html=value;};ctx.root=root;
run(`openAdminEntry=(title,body,kind,id)=>{capture(body);adminEntry={id,kind};};adminEditorRoot=()=>root;
 data={members:[{id:'a',name:'Anna',active:true},{id:'b',name:'Berta',active:true}],meetings:[{id:'m',date:'2026-10-20',attendance:{a:{status:'present',updatedAt:'2026-10-17T10:00:00Z',note:'Alt'},b:{status:'absent'}}}],excursions:[{id:'x',title:'Event',organizerIds:[]}],fines:[],payments:[]};
 meetingForm('m');`);
assert.match(html,/Abgestimmt:[\s\S]*data-meeting-member-note="a"[^>]*>📝 Alt<\/small>/);
assert.doesNotMatch(html,/Notiz des Mitglieds:|<strong>Notizen der Mitglieder/);
status={isConnected:true,textContent:'',hidden:false};
ctx.mockNotes=()=>Promise.resolve({data:[{member_id:'a',note:'Komme <später>'},{member_id:'b',note:'Alte Zusage'}],error:null});
run(`cloudUser={id:'admin'};cloudClient={from:()=>({select:()=>({eq:mockNotes})})};`);
(async()=>{
 await run("loadAdminMeetingNotes('m')");
 assert.equal(notes[0].textContent,'📝 Komme <später>');assert.equal(notes[0].hidden,false);
 assert.equal(notes[1].hidden,true,'No attendance note is shown for an absence');
 assert.equal(status.hidden,true,'No duplicate cloud-note panel after loading');
 // Initial event template must put note after timestamp.
 run(`excursionVotes=[{excursion_id:'x',member_id:'a',status:'yes',note:'Eventnotiz',updated_at:'2026-10-17T10:00:00Z'}];excursionForm('x');`);
 assert.match(html,/Abgestimmt:[^<]*<\/small><small class="vote-note">📝 Eventnotiz<\/small>/);
 // Updating an existing row also reorders an old note behind its timestamp.
 const parent={children:[],appendChild(node){this.children=this.children.filter(x=>x!==node);this.children.push(node);node.parentElement=this;}};
 const label={className:'excursion-vote-label',parentElement:parent};
 const note={className:'vote-note',parentElement:parent};
 const stamp={className:'vote-stamp',parentElement:parent};
 parent.children=[label,note,stamp];
 const row={dataset:{excursionRow:'a'},querySelector:s=>parent.children.find(n=>'.'+n.className===s),querySelectorAll:()=>[]};
 root.querySelector=s=>s==='form[data-form="excursion"]'?{elements:{id:{value:'x'}}}:null;
 root.querySelectorAll=s=>s==='[data-excursion-row]'?[row]:[];
 run("updateExcursionVoteControls('x')");
 assert.equal(parent.children.at(-1),note);
 assert.ok(parent.children.indexOf(note)>parent.children.indexOf(stamp));
 const reader=vm.createContext({window:{}});
 vm.runInContext(fs.readFileSync(__dirname+'/lesen.js','utf8').split("document.addEventListener('submit'")[0],reader);
 vm.runInContext(`profile={member_id:'a'};data={sections:{meetings:true}};deadlines=new Map([['m','2099-01-01T00:00:00Z']]);m={id:'m',attendance:{a:{status:'present'}}};`,reader);
 let panel=vm.runInContext('votePanel(m)',reader);
 assert.match(panel,/<div class="meeting-note-editor"><label[^>]+>Notiz hinzufügen \(optional\)<\/label>/);
 assert.doesNotMatch(panel,/<details/);
 assert.match(panel,/maxlength="160"/);assert.match(panel,/data-save-meeting-note="m"/);
 vm.runInContext("m.attendance.a.note='Bestehende Notiz'",reader);
 panel=vm.runInContext('votePanel(m)',reader);
 assert.doesNotMatch(panel,/<summary>/);assert.match(panel,/value="Bestehende Notiz"/);
 console.log('PASS note layout: admin timestamps before notes, loaded notes per member, absent notes hidden, event updates reordered, compact editor always visible and existing notes retained.');
})().catch(error=>{console.error(error);process.exitCode=1;});
