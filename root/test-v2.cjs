// node test-v2.cjs — browser-agnostic domain and migration tests.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const storage=new Map(),alerts=[];
const elements={'#app':{innerHTML:''},'#nav':{innerHTML:''},'#dialog':{open:false,innerHTML:'',addEventListener(){},showModal(){this.open=true},close(){this.open=false}}};
const ctx=vm.createContext({console,Intl,Date,Number,String,Object,Array,Math,Set,Promise,RegExp,JSON,crypto,URL,Blob,FormData,clearTimeout,setTimeout,
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
 document:{querySelector:s=>elements[s],addEventListener(){},hidden:false},navigator:{onLine:true},
 window:{addEventListener(){},isSecureContext:false,scrollTo(){}},alert:msg=>alerts.push(msg),confirm:()=>true});
vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),ctx);
const run=(js)=>vm.runInContext(js,ctx);
const fd=(values)=>({get:k=>values[k]??null,has:k=>Object.hasOwn(values,k)});
ctx.testFD=fd;
const addMember=(name,no,all,yr,active=true)=>run(`saveMember(testFD(${JSON.stringify({name,memberNumber:String(no),historicalCount:String(all),historical2026Count:String(yr),...(active?{active:'on'}:{})})}))`);
addMember('Ada',2,90,14); addMember('Berta',5,41,7); addMember('Clemens',9,12,3);
assert.equal(run('data.members.length'),3);
assert.equal(run("rankRows('2026')[0].count"),14);
assert.equal(run("rankRows(null)[0].count"),90);
assert.equal(run('suggestedOrganizer("2026-10-15").name'),'Ada');
assert.equal(run('rotationMembers().map(m=>m.memberNumber).join(",")'),'2,5,9');
const ids=run('data.members.map(m=>m.id)');
// Date and organizer saved — move from #2 -> #5 -> #9 -> #2.
run(`saveMeeting(testFD(${JSON.stringify({date:'2026-10-01',organizerId:ids[0],finalized:'on', ['status-'+ids[0]]:'present',['status-'+ids[1]]:'present',['status-'+ids[2]]:'absent',['reason-'+ids[2]]:'Urlaub'})}))`);
assert.equal(run('suggestedOrganizer("2026-10-15").name'),'Berta');
assert.equal(run('yearCount(data.members[0].id,"2026")'),15);
assert.equal(run('allTime(data.members[0].id)'),91,'The 2026 baseline must NOT be added twice to the all-time total');
run(`saveMeeting(testFD(${JSON.stringify({date:'2026-10-02',organizerId:ids[1]})}))`);
assert.equal(run('suggestedOrganizer("2026-10-15").name'),'Clemens');
run(`saveMeeting(testFD(${JSON.stringify({date:'2026-10-03',organizerId:ids[2]})}))`);
assert.equal(run('suggestedOrganizer("2026-10-15").name'),'Ada','wrap after highest number');
assert.equal(run('suggestedOrganizer("2026-10-02").name'),'Clemens','same-date meeting advances the rotation');
const before=alerts.length;
run(`saveMember(testFD({name:'Andreas',memberNumber:'5',historicalCount:'10',historical2026Count:'5'}));`);
assert.equal(alerts.length,before+1,'duplicate member numbers must be rejected');
assert.equal(run('data.members.length'),3);
run(`saveMember(testFD({name:'Andreas',memberNumber:'8',historicalCount:'6',historical2026Count:'7'}));`);
assert.equal(run('data.members.length'),3,'2026 baseline greater than all-time baseline is rejected');
run(`saveMember(testFD({name:'Andreas',memberNumber:'8',historicalCount:'10',historical2026Count:'7',active:'on'}));`);
assert.equal(run('rotationMembers().map(m=>m.memberNumber).join(",")'),'2,5,8,9');
assert.equal(run('suggestedOrganizer("2026-10-15").name'),'Ada','wrap goes back to lowest');
const memberId=run('data.members[0].id');
run(`saveMember(testFD({id:'${memberId}',name:'Ada',memberNumber:'2',historicalCount:'90',historical2026Count:'14',active:'on'}));`);
assert.equal(run('data.members[0].historicalCount'),90);
ctx.testFD=fd;
// Bulk input shouldn't make partial changes if one row violates invariants
let values={}; for(const m of run('data.members')) values['baseline-'+m.id]=String(m.historical2026Count);
values['baseline-'+ids[1]]='1000';
ctx.testBulk=fd(values);
run('saveBulk2026(testBulk)');
assert.equal(run('data.members[1].historical2026Count'),7);
values['baseline-'+ids[1]]='15';
ctx.testBulk=fd(values);
run('saveBulk2026(testBulk)');
assert.equal(run('data.members[1].historical2026Count'),15);
assert.equal(run('yearCount(data.members[1].id,"2026")'),16);
assert.equal(run('allTime(data.members[1].id)'),42,'All time unchanged by bulk 2026 adjustment');
// Legacy backup simulation: fields absent, should not crash or change ranking.
run('data.members[0].memberNumber=undefined;data.members[0].historical2026Count=undefined');
assert.equal(run('yearCount(data.members[0].id,"2026")'),1);
assert.equal(run('allTime(data.members[0].id)'),91);
assert.equal(run('memberNo(data.members[0])'),null);
assert.match(run('meetingForm() || ""'),/undefined|^$/); // modal call returns undefined but must not throw
console.log('PASS v2: manual 2026 counts, no double count, member numbers, validation, organizer rotation, chronology, edits, migration, bulk save.');
