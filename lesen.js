/* FantastiX 3.6 · Authentifizierte Leseransicht mit eigener Stammtisch-Abstimmung. */
const $=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=x=>Math.max(0,Number.isFinite(+x)?Math.round(+x):0);
const money=c=>new Intl.NumberFormat('de-AT',{style:'currency',currency:'EUR'}).format((Number(c)||0)/100);
const dateLabel=s=>s?new Date(s+'T12:00:00').toLocaleDateString('de-AT',{day:'2-digit',month:'long',year:'numeric'}):'–';
const timeLabel=s=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s||'')?s:'19:00';
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const currentYear=()=>today().slice(0,4);
const dateTime=s=>{if(!s)return '–';const dt=new Date(s);return Number.isNaN(dt.valueOf())?'–':dt.toLocaleString('de-AT');};
const deadlineLabel=s=>{if(!s)return '–';return new Intl.DateTimeFormat('de-AT',{timeZone:'Europe/Vienna',weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(s))+' Uhr';};
const empty=msg=>`<section class="card"><p class="muted">${esc(msg)}</p></section>`;
const heading=txt=>`<h1 class="title">${esc(txt)}</h1>`;
let cloud=null,user=null,profile=null,data=null,votes=[],deadlines=new Map(),tab='dashboard',year=currentYear(),lastFetched='',busy=false,authMode='login';
const section=k=>!!data?.sections?.[k];
const member=id=>data?.members?.find(m=>m.id===id);
const memberName=id=>member(id)?.name||'Mitglied';
const voteFor=(meetingId,memberId)=>votes.find(v=>v.meeting_id===meetingId&&v.member_id===memberId);
function effective(m,id){
 // Verbindliche Anwesenheit: nur die ausdrückliche Eintragung des Administrators.
 // Mitgliederzusagen sind getrennte, vorläufige Informationen und zählen NICHT für Ranglisten.
 const a=m.attendance?.[id];
 return a&&['present','absent'].includes(a.status)?{...a,source:'admin'}:null;
}
function readerStatus(m,id){const v=voteFor(m.id,id);return v?{status:v.status,updatedAt:v.updated_at}:null;}
function memberOrder(){return [...(data?.members||[])].sort((a,b)=>(Number(a.memberNumber)||99999)-(Number(b.memberNumber)||99999)||a.name.localeCompare(b.name,'de'));}
function rsvpCounts(m){const list=memberOrder().filter(p=>p.active!==false);const values=list.map(p=>readerStatus(m,p.id));return {yes:values.filter(v=>v?.status==='present').length,no:values.filter(v=>v?.status==='absent').length,open:values.filter(v=>!v).length,total:list.length};}
function rsvpRoster(m){
 if(!section('members'))return '';
 const count=rsvpCounts(m);
 return `<div class="attendee-block"><div class="roster-header"><strong>Abstimmungsstand</strong><small>${count.yes} da · ${count.no} nicht da · ${count.open} offen</small></div>
 <div class="roster-list">${memberOrder().filter(p=>p.active!==false).map(p=>{
 const response=readerStatus(m,p.id);const admin=effective(m,p.id);
 return `<div class="roster-row"><span class="roster-name">${esc(p.name)}</span>
 <div class="roster-right"><span class="chip ${!response?'gray':response.status==='present'?'yes-chip':'no-chip'}">${response?response.status==='present'?'✓ Da':'× Nicht da':'Noch offen'}</span>${admin?`<small class="roster-sub">Admin: ${admin.status==='present'?'Da':'Nicht da'}</small>`:''}</div></div>`;
 }).join('')}</div></div>`;
}
function actualAttendance(m){
 if(!section('members'))return '';
 const recorded=memberOrder().filter(p=>effective(m,p.id));
 const present=recorded.filter(p=>effective(m,p.id).status==='present').length;
 const absent=recorded.length-present;
 return `<div class="attendee-block"><div class="roster-header"><strong>Tatsächliche Anwesenheit</strong><small>${present} da · ${absent} nicht da</small></div>
 <div class="roster-list">${memberOrder().map(p=>{
 const a=effective(m,p.id);return `<div class="roster-row"><div class="roster-name">${esc(p.name)}${a?.status==='absent'&&section('absences')&&a.reason?`<small class="absence-reason">Grund: ${esc(a.reason)}</small>`:''}${a?.status==='absent'&&section('absences')&&a.note?`<small class="absence-reason">${esc(a.note)}</small>`:''}</div>
 <span class="chip ${!a?'gray':a.status==='present'?'yes-chip':'no-chip'}">${!a?'Nicht erfasst':a.status==='present'?'✓ Da':'× Nicht da'}</span></div>`;
 }).join('')}</div></div>`;
}

const stats=(id,y)=>data.meetings.filter(m=>m.date<=today()&&(!y||m.date.startsWith(y))&&effective(m,id)?.status==='present').length;
const count=(m,y)=>y?stats(m.id,y)+(y==='2026'?n(m.historical2026Count):0):stats(m.id)+n(m.historicalCount);
const ranks=y=>[...data.members].map(m=>({...m,count:count(m,y)})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'de'));
function leaders(y){const rows=ranks(y);return rows.length&&rows[0].count>0?rows.filter(m=>m.count===rows[0].count):[];}
function daysUntil(s){const parts=s?.split('-').map(Number),t=today().split('-').map(Number);if(!parts||parts.length!==3)return null;return Math.max(0,Math.round((Date.UTC(parts[0],parts[1]-1,parts[2])-Date.UTC(t[0],t[1]-1,t[2]))/86400000));}
function renderGate(msg=''){
 $('#reader-app').hidden=true;$('#auth-gate').hidden=false;$('#tabs').innerHTML='';
 if(!user){
  $('#auth-gate').innerHTML=`<section class="card auth-card"><div class="auth-top">${heading('Willkommen bei FantastiX')}<p class="muted">${authMode==='signup'?'Neues Leserkonto erstellen':'Melde dich mit deinem FantastiX-Konto an.'}</p></div>
   ${msg?`<div class="notice ${msg.includes('fehlgeschlagen')?'warning':''}">${esc(msg)}</div>`:''}
   <form id="reader-auth-form" class="stack"><div class="field"><label>E-Mail</label><input name="email" type="email" autocomplete="email" required></div>
   <div class="field"><label>Passwort (mindestens 6 Zeichen)</label><input name="password" type="password" minlength="6" autocomplete="${authMode==='signup'?'new-password':'current-password'}" required></div>
   <button class="button" type="submit">${authMode==='signup'?'Konto erstellen':'Anmelden'}</button></form>
   <button class="ghost auth-toggle" type="button" id="auth-mode-toggle">${authMode==='signup'?'Ich habe schon ein Konto':'Noch kein Konto? Jetzt registrieren'}</button>
   <p class="hint">Nach der Registrierung verknüpft der Administrator dein Konto mit deinem Mitglied. Erst dann werden Daten freigegeben.</p></section>`;
  return;
 }
 $('#auth-gate').innerHTML=`<section class="card auth-card"><h2>Freigabe ausstehend</h2><p class="muted">${esc(user.email||'Dein Konto')} ist angemeldet, aber noch keinem Mitglied zugeordnet. Bitte den Administrator um Freischaltung.</p>${msg?`<p class="notice warning">${esc(msg)}</p>`:''}<div class="stack"><button class="button" id="reader-retry" type="button">Freigabe prüfen</button><button class="ghost" id="reader-logout" type="button">Abmelden</button></div></section>`;
}
function renderApp(){
 if(!data||!profile?.member_id)return renderGate();
 $('#auth-gate').hidden=true;$('#reader-app').hidden=false;
 const tabs=[['dashboard','Start','⌂',true],['meetings','Stammtisch','▣',section('meetings')],['ranking','Rangliste','★',section('members')],['members','Mitglieder','♙',section('members')],['cash','Kassa','€',section('cash')||section('fines')],['profile','Profil','◉',true]].filter(t=>t[3]);
 if(!tabs.some(t=>t[0]===tab))tab='dashboard';
 $('#tabs').innerHTML=tabs.map(([id,label,icon])=>`<button class="navbutton ${tab===id?'active':''}" data-tab="${id}" aria-label="${label}"><span class="tab-icon">${esc(icon)}</span><span>${esc(label)}</span></button>`).join('');
 $('#content').innerHTML=({dashboard,meetings,ranking,members,cash,profilePage}[tab])();
 $('#updated').textContent='Stand: '+dateTime(data.publishedAt||lastFetched);
}
function dashboard(){
 const completed=data.meetings.filter(m=>m.date<=today()).sort((a,b)=>b.date.localeCompare(a.date));
 const next=[...data.meetings].filter(m=>m.date>=today()).sort((a,b)=>a.date.localeCompare(b.date))[0];
 const yr=section('members')?leaders(currentYear()):[],all=section('members')?leaders(null):[];
 const pending=section('fines')?data.fines.reduce((s,f)=>s+n(f.amountCents),0)-data.payments.reduce((s,p)=>s+n(p.amountCents),0):null;
 const leaderHTML=lst=>lst.length?`<div class="leader-list">${lst.map(m=>`<span>${esc(m.name)}</span>`).join('')}</div><small>${lst[0].count} Teilnahmen</small>`:'<div class="value">–</div>';
 return `${heading('Dashboard')}<div class="metric-grid dashboard-v36">
  <div class="metric"><small>Tage bis zum Stammtisch</small><div class="value">${next?daysUntil(next.date):'–'}</div></div>
  <div class="metric"><small>Jahresführung ${currentYear()}</small>${leaderHTML(yr)}</div>
  <div class="metric"><small>Ewige Führung</small>${leaderHTML(all)}</div>
  <div class="metric"><small>Kontostand</small><div class="value balance-tile">${section('cash')?money(data.cashbook?.balanceCents):'–'}</div><small>Offene Strafen: ${pending!==null?money(Math.max(0,pending)):'–'}</small></div>
 </div>
 <section class="card next-card"><div class="row"><h2>Nächster Stammtisch</h2><span class="chip">${next?daysUntil(next.date)===0?'Heute':`In ${daysUntil(next.date)} Tagen`:'Nicht geplant'}</span></div>
 ${next?`<strong class="next-date">${dateLabel(next.date)}</strong><p class="next-place">${esc(next.location||'Gasthaus noch offen')} · ${esc(timeLabel(next.time))} Uhr</p><p class="muted tiny">Organisator: ${esc(memberName(next.organizerId))}</p>${votePanel(next,true)}${section('members')?`<div class="rsvp-short">${(()=>{const c=rsvpCounts(next);return `${c.yes} Zusagen · ${c.no} Absagen · ${c.open} offen`;})()} <button type="button" class="smallbtn" data-tab="meetings">Alle ansehen →</button></div>`:''}`:'<p class="muted">Noch kein nächster Stammtisch eingetragen.</p>'}</section>
 <section class="card"><h2>Letzte 2 Stammtische</h2>${completed.slice(0,2).length?completed.slice(0,2).map(m=>`<div class="item"><div class="avatar">${esc(m.date.slice(-2))}</div><div class="details"><strong>${dateLabel(m.date)}</strong><small>${esc(m.location||'Ohne Gasthaus')} · ${data.members.filter(p=>effective(m,p.id)?.status==='present').length} anwesend</small></div></div>`).join(''):'<p class="muted">Noch keine Stammtische.</p>'}</section>`;
}
function votePanel(m,compact=false){
 if(!profile?.member_id||!section('meetings'))return '';
 const admin=m.attendance?.[profile.member_id];
 const locked=admin&&['present','absent'].includes(admin.status)&&admin.source!=='reader';
 const deadline=deadlines.get(m.id),closed=deadline?! (Date.now()<new Date(deadline).getTime()):true;
 const own=locked?effective(m,profile.member_id):readerStatus(m,profile.member_id),status=own?.status||'';
 const summary=locked?'Vom Admin festgelegt':closed?'Abstimmung geschlossen':`Abstimmung bis ${deadlineLabel(deadline)}`;
 return `<div class="vote-panel ${compact?'compact':''}"><div class="vote-header"><strong>Deine Teilnahme</strong><span class="chip ${locked||closed?'gray':''}">${esc(summary)}</span></div>
 <div class="vote-actions"><button type="button" class="vote-btn ${status==='present'?'selected yes':''}" data-vote="present" data-meeting-id="${esc(m.id)}" ${locked||closed||busy?'disabled':''}>✓ Da</button>
 <button type="button" class="vote-btn ${status==='absent'?'selected no':''}" data-vote="absent" data-meeting-id="${esc(m.id)}" ${locked||closed||busy?'disabled':''}>× Nicht da</button></div>
 ${status?`<small class="muted">Deine Antwort: ${status==='present'?'Da':'Nicht da'}${locked?' (Admin)':''}</small>`:'<small class="muted">Noch keine Antwort</small>'}</div>`;
}
function meetings(){
 if(!section('meetings'))return empty('Stammtische sind nicht freigegeben.');
 const items=[...data.meetings].sort((a,b)=>b.date.localeCompare(a.date));
 return `${heading('Stammtische')}${items.length?items.map(m=>`<section class="card meeting-card">
 <div class="row"><h2>${dateLabel(m.date)}</h2><span class="chip ${m.date>today()?'':'gray'}">${m.date>today()?'Geplant':'Vergangen'}</span></div>
 <p>${esc(m.location||'Gasthaus offen')} · ${esc(timeLabel(m.time))} Uhr</p>
 ${section('members')?`<p class="muted tiny">Organisator: ${esc(memberName(m.organizerId))}</p>`:''}
 ${votePanel(m)}
 ${rsvpRoster(m)}
 ${m.date<=today()?actualAttendance(m):''}
 ${section('absences')&&m.notes?`<p class="hint">${esc(m.notes)}</p>`:''}
 </section>`).join(''):empty('Noch keine Stammtische.')}`;
}

function ranking(){
 if(!section('members'))return empty('Ranglisten sind nicht freigegeben.');
 const years=[...new Set(['2026',currentYear(),...data.meetings.map(m=>m.date.slice(0,4))])].sort().reverse();
 return `${heading('Ranglisten')}<div class="card"><div class="pill-group"><button class="pill ${year==='all'?'selected':''}" data-year="all">Ewig</button>${years.map(y=>`<button class="pill ${year===y?'selected':''}" data-year="${y}">${y}</button>`).join('')}</div><div class="separator"></div><div class="tablewrap"><table class="table"><thead><tr><th>Platz</th><th>Mitglied</th><th>Teilnahmen</th></tr></thead><tbody>${ranks(year==='all'?null:year).map((m,i)=>`<tr><td>${i+1}.</td><td>${esc(m.name)}</td><td><strong>${m.count}</strong></td></tr>`).join('')}</tbody></table></div></div>`;
}
function members(){
 if(!section('members'))return empty('Mitglieder sind nicht freigegeben.');
 return `${heading('Mitglieder')}<section class="card"><div class="list">${[...data.members].sort((a,b)=>(a.memberNumber??99999)-(b.memberNumber??99999)).map(m=>`<div class="item"><div class="avatar">${esc(m.memberNumber||m.name.slice(0,1).toUpperCase())}</div><div class="details"><strong>${esc(m.name)}</strong><small>2026: ${count(m,'2026')} · Ewig: ${count(m,null)}</small></div></div>`).join('')||'<p>Keine Mitglieder</p>'}</div></section>`;
}
function cash(){
 const c=data.cashbook||{},fined=data.fines.reduce((s,f)=>s+n(f.amountCents),0),paid=data.payments.reduce((s,p)=>s+n(p.amountCents),0);
 return `${heading('Kassa')}${section('cash')?`<div class="cash-hero"><span>Kontostand</span><div class="cash-balance">${money(c.balanceCents)}</div></div><section class="card"><h2>Kassenbuch</h2><div class="list">${(c.transactions||[]).map(t=>`<div class="item"><div class="details"><strong>${esc(t.type==='expense'?'Ausgabe':t.type==='monthly'?'Monatsbeitrag':t.type==='adjustment'?'Korrektur':'Strafzahlung')}</strong><small>${esc(t.note||'')}</small></div><strong>${t.amountCents>0?'+':''}${money(t.amountCents)}</strong></div>`).join('')||'<p class="muted">Keine Buchungen</p>'}</div></section>`:''}
 ${section('fines')?`<div class="metric-grid"><div class="metric"><small>Strafen gesamt</small><div class="value">${money(fined)}</div></div><div class="metric"><small>Offen</small><div class="value red">${money(Math.max(0,fined-paid))}</div></div></div><section class="card"><h2>Strafen</h2><div class="list">${data.fines.map(f=>{const settled=data.payments.filter(p=>p.fineId===f.id).reduce((s,p)=>s+n(p.amountCents),0);return `<div class="item"><div class="details"><strong>${esc(memberName(f.memberId))}</strong><small>${esc(f.reason||'Strafe')}</small></div><div class="right"><strong>${money(f.amountCents)}</strong><small class="muted">${money(Math.max(0,f.amountCents-settled))} offen</small></div></div>`}).join('')||'<p>Keine Strafen</p>'}</div></section>`:''}`;
}
function profilePage(){return `${heading('Mein Profil')}<section class="card"><h2>${esc(member(profile.member_id)?.name||'Mitglied')}</h2><p class="muted">${esc(user?.email||'')}</p><p class="hint">Mitgliedsnummer: ${esc(member(profile.member_id)?.memberNumber||'–')}</p><div class="stack"><button type="button" class="ghost" id="reader-refresh">Aktualisieren</button><button type="button" class="danger-btn" id="reader-logout">Abmelden</button></div></section>`;}
async function initClient(){
 const cfg=window.FANTASTIX_CLOUD;
 if(!cfg||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(cfg.url||''))||!String(cfg.key||'').startsWith('sb_publishable_')&&!String(cfg.key||'').startsWith('eyJ'))throw Error('Cloud noch nicht eingerichtet.');
 const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.57.0');
 cloud=createClient(cfg.url.replace(/\/$/,''),cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 return cloud;
}
async function refresh(){
 if(!cloud||!user)return renderGate();
 try{
  const {data:account,error:accountError}=await cloud.from('fantastix_reader_profiles').select('member_id,email').eq('user_id',user.id).maybeSingle();
  if(accountError)throw accountError;profile=account;
  if(!profile?.member_id){data=null;return renderGate();}
  const [pub,readerVotes,windows]=await Promise.all([
   cloud.from('fantastix_public').select('content,published_at').eq('id','main').eq('is_published',true).maybeSingle(),
   cloud.from('fantastix_reader_votes').select('meeting_id,member_id,status,updated_at'),
   cloud.rpc('fantastix_reader_deadlines')
  ]);
  if(pub.error)throw pub.error;if(readerVotes.error)throw readerVotes.error;if(windows.error)throw windows.error;
  if(!pub.data?.content){data=null;$('#reader-app').hidden=true;$('#auth-gate').hidden=false;$('#auth-gate').innerHTML=empty('Noch keine Daten für Leser freigegeben.');return;}
  const d=pub.data.content;
  if(!d.sections||!Array.isArray(d.members)||!Array.isArray(d.meetings)||!Array.isArray(d.fines)||!Array.isArray(d.payments))throw Error('Unbekanntes Datenformat.');
  data=d;votes=readerVotes.data||[];deadlines=new Map((windows.data||[]).map(r=>[r.meeting_id,r.deadline_at]));lastFetched=pub.data.published_at||new Date().toISOString();
  renderApp();
 }catch(e){data=null;$('#reader-app').hidden=true;$('#auth-gate').hidden=false;$('#auth-gate').innerHTML=empty('Laden fehlgeschlagen: '+(e.message||String(e))+' · Bitte erneut öffnen.');}
}
async function doAuth(form){
 if(busy)return;busy=true;
 const fd=new FormData(form),email=String(fd.get('email')||'').trim(),password=String(fd.get('password')||'');
 try{
  if(authMode==='signup'){
   const {data:result,error}=await cloud.auth.signUp({email,password,options:{emailRedirectTo:new URL('./lesen.html',location.href).href}});
   if(error)throw error;
   if(result.session){user=result.user;await refresh();}
   else {authMode='login';renderGate('Konto angelegt. Bitte E-Mail bestätigen und danach anmelden.');}
  }else{
   const {data:result,error}=await cloud.auth.signInWithPassword({email,password});if(error)throw error;
   user=result.user;await refresh();
  }
 }catch(e){renderGate('Anmeldung fehlgeschlagen: '+e.message);}finally{busy=false;}
}
async function logout(){if(!cloud)return;await cloud.auth.signOut();user=null;profile=null;data=null;votes=[];deadlines.clear();tab='dashboard';authMode='login';renderGate();}
async function castVote(meetingId,status){
 if(busy||!data||!profile?.member_id)return;
 const m=data.meetings.find(x=>x.id===meetingId);if(!m)return;
 const d=deadlines.get(meetingId);
 if(!d||Date.now()>=new Date(d).getTime())return alert('Die Abstimmungsfrist ist abgelaufen.');
 const own=m.attendance?.[profile.member_id];if(own&&own.source!=='reader'&&['present','absent'].includes(own.status))return alert('Der Admin hat die Anwesenheit festgelegt.');
 busy=true;renderApp();
 try{const {error}=await cloud.rpc('fantastix_cast_vote',{p_meeting_id:meetingId,p_status:status});if(error)throw error;await refresh();}
 catch(e){alert('Abstimmung nicht gespeichert: '+e.message);}
 finally{busy=false;if(data)renderApp();}
}
document.addEventListener('submit',e=>{if(e.target.id==='reader-auth-form'){e.preventDefault();doAuth(e.target);}});
document.addEventListener('click',e=>{
 const toggle=e.target.closest('#auth-mode-toggle');if(toggle){authMode=authMode==='signup'?'login':'signup';renderGate();return;}
 if(e.target.closest('#reader-logout')){logout();return;}
 if(e.target.closest('#reader-retry,#reader-refresh')){refresh();return;}
 const nav=e.target.closest('[data-tab]');if(nav){tab=nav.dataset.tab;renderApp();scrollTo({top:0,behavior:'instant'});return;}
 const y=e.target.closest('[data-year]');if(y){year=y.dataset.year;renderApp();return;}
 const vote=e.target.closest('[data-vote]');if(vote){castVote(vote.dataset.meetingId,vote.dataset.vote);}
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&user)refresh();});
setInterval(()=>{if(!document.hidden&&user&&!busy)refresh();},60000);
(async()=>{try{await initClient();const {data:auth}=await cloud.auth.getUser();user=auth?.user||null;if(user)await refresh();else renderGate();}catch(e){renderGate('Cloud-Verbindung: '+e.message);}})();
