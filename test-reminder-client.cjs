const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const alerts=[],dialog={innerHTML:'',showModal(){},open:false},calls=[];
const admin=vm.createContext({window:{},localStorage:{getItem:()=>null},document:{querySelector:()=>dialog},alert:x=>alerts.push(x)});
const run=s=>vm.runInContext(s,admin);
run(fs.readFileSync(__dirname+'/app.js','utf8').split('/* Interaktionen */')[0]);
run('data=DEFAULT();persist=()=>{};closeModal=()=>{}');
assert.equal(run('voteReminderHours()'),24);assert.equal(run('voteReminderEnabled()'),true);
run('voteSettingsForm()');assert.match(dialog.innerHTML,/name="reminderHours"/);assert.match(dialog.innerHTML,/name="reminderEnabled"/);
const form=(hours,reminderHours,enabled)=>({get:k=>({hours,reminderHours}[k]),has:k=>k==='reminderEnabled'&&enabled});
admin.fd=form('24','6',true);run('saveVoteSettings(fd)');assert.equal(run('data.rsvpReminderHours'),6);assert.equal(run('data.rsvpCutoffHours'),24);
admin.fd=form('0','48',false);run('saveVoteSettings(fd)');assert.equal(run('voteReminderEnabled()'),false);
for(const invalid of ['0','-1','1.5','721','x']){admin.fd=form('24',invalid,true);run('saveVoteSettings(fd)');assert.equal(run('data.rsvpReminderHours'),48);}
assert.equal(alerts.length,5);
const source=fs.readFileSync(__dirname+'/lesen.js','utf8');
const reader=vm.createContext({window:{},console:{warn(){}},document:{}});
const rr=s=>vm.runInContext(s,reader);rr(source.split("document.addEventListener('submit'")[0]);
reader.sub={endpoint:'https://fcm.googleapis.com/test',toJSON:()=>({endpoint:'https://fcm.googleapis.com/test',keys:{}})};
reader.rpc=async(name,args)=>{calls.push({name,args});return {error:null};};rr('cloud={rpc};');
(async()=>{
 await rr('registerReminderSubscription(sub)');await rr('unregisterReminderSubscription(sub)');
 assert.deepEqual(calls.map(c=>c.name),['fantastix_reminder_subscribe','fantastix_reminder_unsubscribe']);
 reader.rpc=async()=>{throw Error('offline')};rr('cloud={rpc}');
 await assert.doesNotReject(()=>rr('registerReminderSubscription(sub)'));await assert.doesNotReject(()=>rr('unregisterReminderSubscription(sub)'));
 for(const name of ['index.html','lesen.html'])assert.match(fs.readFileSync(__dirname+'/'+name,'utf8'),/\.vote-countdown\{color:var\(--danger\)/);
 console.log('PASS reminder client: editable settings, defaults, validation, enable/disable, subscription mirroring, graceful backend outages and red countdown.');
})().catch(e=>{console.error(e);process.exitCode=1;});
