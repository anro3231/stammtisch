// No database/network calls: test rendering and navigation against synthetic data.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map();
const element=()=>({innerHTML:'',textContent:'',hidden:false,open:false,showModal(){this.open=true;},close(){this.open=false;},setAttribute(){},focus(){}});
const listeners={};
const context=vm.createContext({window:{},navigator:{onLine:false},scrollTo(){},console,
 document:{querySelector:s=>{if(!elements.has(s))elements.set(s,element());return elements.get(s);},addEventListener:(kind,fn)=>{listeners[kind]=fn;}}});
const source=fs.readFileSync(__dirname+'/lesen.js','utf8');
vm.runInContext(fs.readFileSync(__dirname+'/calendar-view.js','utf8'),context);
vm.runInContext(source.split("document.addEventListener('submit'")[0],context);
vm.runInContext(source.slice(source.indexOf("document.addEventListener('click'"),source.indexOf("$('#notice-dialog').addEventListener")),context);
const run=code=>vm.runInContext(code,context);
const content=()=>elements.get('#content').innerHTML;
const click=(selector,dataset={},attrs=[])=>listeners.click({target:{closest:s=>s===selector?{dataset,hasAttribute:name=>attrs.includes(name)}:null}});
run(`profile={member_id:'a'};user={id:'test'};
 data={sections:{members:true,meetings:true,excursions:true,absences:true},members:[{id:'a',name:'Anna'},{id:'b',name:'Berta'}],fines:[],payments:[],meetings:[
 {id:'m1',date:'2099-10-20',time:'18:30',location:'Gasthaus',notes:'Detailnotiz',attendance:{a:{status:'present',note:'Komme später'},b:{status:'absent',reason:'Urlaub'}}},
 {id:'m2',date:'2020-01-01',attendance:{}}
 ],excursions:[{id:'x1',title:'Hütte <Berg>',date:'2099-11-01',notes:'Eventdetails'},{id:'x2',title:'Vergangen',date:'2020-01-01',completed:true}]};
 deadlines=new Map([['m1','2099-10-19T18:30:00Z'],['m2','2020-01-01T00:00:00Z']]);
 excursionVotes=[{excursion_id:'x1',member_id:'a',status:'yes'},{excursion_id:'x1',member_id:'b',status:'no'}];
 renderApp();`);
assert.doesNotMatch(content(),/data-vote=|data-excursion-vote=|meeting-note-editor/,'Dashboard contains no voting controls');
assert.match(content(),/data-reader-meeting="m1"/);
click('[data-reader-meeting],[data-reader-excursion]',{readerMeeting:'m1'},['data-reader-meeting']);
assert.match(content(),/data-vote="present"/);assert.match(content(),/Detailnotiz/);
assert.match(content(),/Dabei/);assert.match(content(),/Nicht dabei/);
assert.match(content(),/Komme später/);
run('renderApp()');assert.match(content(),/data-reader-back/,'Refresh preserves selected entry');
click('[data-reader-back]');assert.equal(run('tab'),'dashboard');
click('[data-tab]',{tab:'meetings'});
assert.equal((content().match(/class="reader-entry(?: past-entry)?"/g)||[]).length,2);
assert.doesNotMatch(content(),/data-vote=|roster-list|Detailnotiz/);
assert.match(content(),/👍 1[\s\S]*👎 1/);
click('[data-reader-meeting],[data-reader-excursion]',{readerMeeting:'m2'},['data-reader-meeting']);
assert.match(content(),/data-vote="present"[^>]*disabled/,'Expired meeting remains closed');
click('[data-tab]',{tab:'excursions'});
assert.equal((content().match(/class="reader-entry(?: past-entry)?"/g)||[]).length,2);
assert.doesNotMatch(content(),/data-excursion-vote=|roster-list|Eventdetails/);
assert.match(content(),/Hütte &lt;Berg&gt;/);assert.match(content(),/👍 1[\s\S]*👎 1/);
click('[data-reader-meeting],[data-reader-excursion]',{readerExcursion:'x1'},[]);
assert.match(content(),/Eventdetails/);assert.match(content(),/data-excursion-vote="yes"/);
run("busy=true;renderApp()");assert.match(content(),/data-excursion-vote="yes"[^>]*disabled/);
run('busy=false');click('[data-reader-back]');assert.equal(run('tab'),'excursions');
run("tab='calendar';openReaderEntry('meeting','m1')");click('[data-reader-back]');assert.equal(run('tab'),'calendar');
run("data.sections.members=false;tab='dashboard';renderApp()");assert.match(content(),/data-reader-meeting="m1"/);
run("openReaderEntry('meeting','m1')");assert.doesNotMatch(content(),/roster-list/);assert.match(content(),/data-vote=/);
run('data.meetings=[];renderApp()');assert.doesNotMatch(content(),/data-vote=/);
run("data.sections.excursions=false;openReaderEntry('excursion','x1')");assert.equal(run('tab'),'meetings','Unavailable section cannot be opened');
assert.doesNotMatch(run('excursions()'),/Eventdetails|data-excursion-vote=/);
assert.doesNotMatch(source,/✓ Da[<'"]|Nicht da[<'"“]/,'Old participation labels removed');
console.log('PASS compact reader: summaries, counts, dashboard/detail/back navigation, refresh state, expired/busy voting, notes, escaping, permissions and removed entries.');
