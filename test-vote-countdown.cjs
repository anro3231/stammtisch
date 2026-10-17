// No live database calls. Verify Vienna deadlines across DST and the dashboard hint.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
for(const file of ['app.js','lesen.js']){
 const node={dataset:{voteDeadline:'60000'},textContent:''};
 const ctx=vm.createContext({window:{},localStorage:{getItem:()=>null},document:{querySelectorAll:()=>[node]}});
 const run=js=>vm.runInContext(js,ctx);
 run(fs.readFileSync(__dirname+'/'+file,'utf8').split(file==='app.js'?'/* Interaktionen */':"document.addEventListener('submit'")[0]);
 assert.equal(run('voteTimeRemaining(60000,0)'),'Noch 1 Min. abstimmen');
 assert.equal(run('voteTimeRemaining(1,0)'),'Noch 1 Min. abstimmen');
 assert.equal(run('voteTimeRemaining(183840000,0)'),'Noch 2 Tage 3 Std. 4 Min. abstimmen');
 assert.equal(run('voteTimeRemaining(3600000,0)'),'Noch 1 Std. abstimmen');
 assert.equal(run('voteTimeRemaining(0,0)'),'Abstimmung geschlossen.');
 assert.equal(run('voteTimeRemaining(null,0)'),'Abstimmungsfrist nicht verfügbar.');
 assert.equal(run('voteTimeRemaining(NaN,0)'),'Abstimmungsfrist nicht verfügbar.');
 assert.match(run('voteCountdownHTML(null)'),/data-vote-deadline=""/);
 run('refreshVoteCountdowns()');assert.equal(node.textContent,'Abstimmung geschlossen.');
 run("data={members:[],meetings:[{id:'m',date:'2099-01-01',time:'18:30'}],fines:[],payments:[],excursions:[],sections:{members:true,meetings:true,cash:true,fines:true}}");
 if(file==='app.js'){
  run('data.rsvpCutoffHours=24');
  assert.equal(run("new Date(meetingVoteDeadline({date:'2026-07-15',time:'18:30'})).toISOString()"),'2026-07-14T16:30:00.000Z');
  assert.equal(run("new Date(meetingVoteDeadline({date:'2026-12-15',time:'18:30'})).toISOString()"),'2026-12-14T17:30:00.000Z');
  assert.equal(run("new Date(meetingVoteDeadline({date:'2026-03-29',time:'18:30'})).toISOString()"),'2026-03-28T16:30:00.000Z','Cutoff is elapsed hours across DST');
  run('data.rsvpCutoffHours=0');
  assert.equal(run("new Date(meetingVoteDeadline({date:'2026-12-15'})).toISOString()"),'2026-12-15T17:30:00.000Z');
  assert.equal(run("meetingVoteDeadline({date:'2026-03-29',time:'02:30'})"),null,'Nonexistent Vienna time is not fabricated');
  assert.match(run('homeHTML()'),/class="hint vote-countdown"[\s\S]*abstimmen/);
  run('data.meetings=[]');assert.doesNotMatch(run('homeHTML()'),/vote-countdown/);
 }else{
  run("deadlines=new Map([['m','2000-01-01T00:00:00Z']])");
  assert.match(run('dashboard()'),/Abstimmung geschlossen/,'Server deadline takes precedence over future meeting date');
  run("deadlines.set('m','2098-12-31T17:30:00Z')");assert.match(run('dashboard()'),/abstimmen/);
  run('deadlines.clear()');assert.match(run('dashboard()'),/Abstimmungsfrist nicht verfügbar/);
  run('data.meetings=[]');assert.doesNotMatch(run('dashboard()'),/vote-countdown/);
 }
}
console.log('PASS vote countdown: text, rounding, closure, missing deadlines, Vienna summer/winter/DST, server deadlines, timer update and no-meeting states.');
