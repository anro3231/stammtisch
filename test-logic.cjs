// In Node ausführen: node test-logic.cjs (keine externen Dependencies)
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const storage=new Map(),alerts=[];
const elements={'#app':{innerHTML:''},'#nav':{innerHTML:''},'#dialog':{open:false,innerHTML:'',addEventListener(){},showModal(){this.open=true},close(){this.open=false}}};
const context=vm.createContext({console,Intl,Date,Number,String,Object,Array,Math,Set,Promise,RegExp,JSON,crypto,URL,Blob,FormData,clearTimeout,setTimeout,
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
 document:{querySelector:s=>elements[s],addEventListener(){},hidden:false},
 navigator:{onLine:true},window:{addEventListener(){},isSecureContext:false,scrollTo(){}},alert:msg=>alerts.push(msg),confirm:()=>true});
vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),context);
function run(js){return vm.runInContext(js,context)}
function fd(values){return {get:key=>values[key]??null,has:key=>Object.hasOwn(values,key)}}
context.testFD=fd;
run(`saveMember(testFD({name:'Max',historicalCount:'47',active:'on'}));`);
run(`saveMember(testFD({name:'Anna',historicalCount:'12',active:'on'}));`);
const mids=run(`data.members.map(m=>m.id)`);assert.equal(mids.length,2);
assert.equal(run(`allTime(data.members[0].id)`),47);
run(`saveMeeting(testFD({date:'2026-09-13',location:'Gasthaus',finalized:'on',['status-'+data.members[0].id]:'present',['status-'+data.members[1].id]:'absent',['reason-'+data.members[1].id]:'Urlaub',['fine-'+data.members[1].id]:'10,00'}));`);
assert.equal(run('data.meetings.length'),1);
assert.equal(run('data.fines.length'),1);
assert.equal(run(`allTime(data.members[0].id)`),48);
assert.equal(run(`stats(data.members[1].id, '2026').present`),0);
assert.equal(run('fineOpen(data.fines[0])'),1000);
run(`savePayment(testFD({fineId:data.fines[0].id,date:'2026-09-14',amount:'3,50',method:'Bar'}));`);
assert.equal(run('fineOpen(data.fines[0])'),650);
const before=alerts.length;
run(`savePayment(testFD({fineId:data.fines[0].id,date:'2026-09-14',amount:'8',method:'Bar'}));`);
assert.equal(alerts.length,before+1,'Overpayment must be rejected');
assert.equal(run('fineOpen(data.fines[0])'),650);
run(`saveMeeting(testFD({date:'2026-09-21',location:'', ['status-'+data.members[0].id]:'present',['status-'+data.members[1].id]:'present'}));`);
assert.equal(run(`stats(data.members[0].id,'2026').present`),1,'Draft does not count');
assert.equal(run(`rankRows(null)[0].count`),48,'all-time includes initial offset');
assert.equal(run(`rankRows('2026')[0].count`),1,'yearly excludes offset');
run(`saveMeeting(testFD({date:'2027-01-01',finalized:'on',['status-'+data.members[0].id]:'present',['status-'+data.members[1].id]:'present'}));`);
assert.equal(run('stats(data.members[0].id).present'),1,'Future meetups do not count');
run(`saveMember(testFD({name:'Egon',historicalCount:'-1'}));`);
assert.equal(run('data.members.length'),2,'Negative historical attendance rejected');
run(`saveMember(testFD({name:'<img src=x onerror=alert(1)>',historicalCount:'0',active:'on'}));`);
assert.match(run('membersHTML()'),/&lt;img/,'HTML escaped');
assert.equal(run('data.members.length'),3);
console.log('PASS: membership, historical counts, yearly/all-time rankings, absences/fines, part payments, overpayments, drafts, future dates, input validation, HTML escaping.');
