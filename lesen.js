let calendarMonth=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Vienna'}).slice(0,7), calendarSelected=calendarMonth+'-01';
/* FantastiX 3.14.0 · Einheitliche Anwesenheit, Benutzername + Passwort. */
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
let lastOnlineByMember={},lastOnlineChecked=0,birthdays=[],cloud=null,user=null,profile=null,data=null,deadlines=new Map(),excursionVotes=[],excursionVoteError='',notices=[],noticeQueue=[],noticeAcknowledging=false,avatarUrls={},avatarLoadedAt=0,tab='dashboard',year=currentYear(),lastFetched='',busy=false,authMode='login';
// Supabase Auth benutzt intern eine nicht zustellbare Anmeldekennung. Das Projekt
// MUSS Auth > Sign In / Providers > Email > Confirm Email deaktiviert haben.
// Altkonten (auch Admins) können sich weiterhin mit ihrer E-Mail anmelden.
const USERNAME_RE=/^[a-z][a-z0-9_-]{2,23}$/;
const usernameEmail=name=>'fx-'+name.toLowerCase()+'@example.com';
const usernameOrEmail=value=>value.includes('@')?value:usernameEmail(value);
const displayAccount=()=>profile?.username||((user?.email||'').match(/^fx-([a-z][a-z0-9_-]{2,23})@example\.com$/i)?.[1])||user?.email||'';
const section=k=>!!data?.sections?.[k];
const member=id=>data?.members?.find(m=>m.id===id);
const memberName=id=>member(id)?.name||'Mitglied';
function effective(m,id){
 const v=m.attendance?.[id];
 return v&&['present','absent'].includes(v.status)?v:null;
}
function memberOrder(){return [...(data?.members||[])].sort((a,b)=>(Number(a.memberNumber)||99999)-(Number(b.memberNumber)||99999)||a.name.localeCompare(b.name,'de'));}
function rsvpCounts(m){
 const values=memberOrder().filter(p=>p.active!==false).map(p=>effective(m,p.id));
 return {yes:values.filter(v=>v?.status==='present').length,no:values.filter(v=>v?.status==='absent').length,open:values.filter(v=>!v).length};
}
function lastOnlineText(id){
 const raw=lastOnlineByMember[id];if(!raw)return 'Zuletzt online: Noch keine Aktivität';
 const d=new Date(raw);return Number.isFinite(d.getTime())?'Zuletzt online: '+new Intl.DateTimeFormat('de-AT',{timeZone:'Europe/Vienna',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d)+' Uhr':'Zuletzt online: Unbekannt';
}
async function updateOnlinePresence(force=false){
 if(!cloud||!user||!profile?.member_id||document.hidden)return;
 if(!force&&Date.now()-lastOnlineChecked<60000)return;lastOnlineChecked=Date.now();
 const {error}=await cloud.rpc('fantastix_presence_heartbeat');if(error)console.warn('Online-Status: SQL 19 erforderlich',error.message);
}
async function loadOnlinePresence(){
 if(!cloud||!user||!profile?.member_id)return;
 const {data:rows,error}=await cloud.rpc('fantastix_presence_list');
 if(error){console.warn('Online-Status: SQL 19 erforderlich',error.message);return;}
 lastOnlineByMember=Object.fromEntries((rows||[]).map(r=>[r.member_id,r.last_seen_at]));
}
function avatarFor(id){const url=avatarUrls[id];return url?`<img class="member-photo" src="${esc(url)}" alt="" loading="lazy">`:`<span class="member-photo member-photo-placeholder">${esc((memberName(id)||'?').trim().slice(0,1).toUpperCase())}</span>`;}
async function loadAvatars(force=false){
 if(!cloud||!user||!profile?.member_id||(!force&&Date.now()-avatarLoadedAt<5*60*1000))return;
 const {data:rows,error}=await cloud.rpc('fantastix_avatar_directory');if(error)throw error;
 const result={};
 await Promise.all((rows||[]).map(async row=>{const signed=await cloud.storage.from('fantastix-avatars').createSignedUrl(row.object_name,3600);if(!signed.error&&signed.data?.signedUrl)result[row.member_id]=signed.data.signedUrl;}));
 avatarUrls=result;avatarLoadedAt=Date.now();
}
function fileToJpeg(file){return new Promise((resolve,reject)=>{
 if(!file||!file.type.startsWith('image/')||file.size>12*1024*1024)return reject(Error('Bitte ein Bild mit maximal 12 MB auswählen.'));
 const url=URL.createObjectURL(file),img=new Image();
 img.onload=()=>{try{const size=360,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const context=canvas.getContext('2d');const side=Math.min(img.width,img.height),sx=(img.width-side)/2,sy=(img.height-side)/2;context.drawImage(img,sx,sy,side,side,0,0,size,size);canvas.toBlob(blob=>{URL.revokeObjectURL(url);if(!blob)return reject(Error('Bild konnte nicht verarbeitet werden.'));resolve(blob);},'image/jpeg',0.80);}catch(e){URL.revokeObjectURL(url);reject(e);}};
 img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Bild konnte nicht gelesen werden.'));};img.src=url;
});}
async function uploadMyPhoto(file){
 if(!cloud||!user||!profile?.member_id)return alert('Bitte zuerst anmelden und freischalten lassen.');
 try{const blob=await fileToJpeg(file),name=user.id+'/avatar.jpg';
 const {error}=await cloud.storage.from('fantastix-avatars').upload(name,blob,{contentType:'image/jpeg',upsert:true,cacheControl:'60'});if(error)throw error;
 await loadAvatars(true);renderApp();alert('Profilfoto gespeichert.');
 }catch(e){alert('Foto konnte nicht gespeichert werden: '+(e.message||String(e)));}
}
async function deleteMyPhoto(){
 if(!confirm('Dein Profilfoto entfernen?'))return;
 try{const {error}=await cloud.storage.from('fantastix-avatars').remove([user.id+'/avatar.jpg']);if(error)throw error;await loadAvatars(true);renderApp();}catch(e){alert('Foto konnte nicht entfernt werden: '+(e.message||String(e)));}
}
function voteTime(value){
 if(!value)return '';
 const parsed=new Date(value);
 if(!Number.isFinite(parsed.getTime()))return '';
 return new Intl.DateTimeFormat('de-AT',{timeZone:'Europe/Vienna',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(parsed).replace(',', ' · ')+' Uhr';
}
function rsvpRoster(m){
 if(!section('members'))return '';
 const count=rsvpCounts(m);
 return `<div class="attendee-block"><div class="roster-header"><strong>${m.date<=today()?'Anwesenheit':'Abstimmungsstand'}</strong><small>${count.yes} dabei · ${count.no} nicht dabei · ${count.open} offen</small></div>
 <div class="roster-list">${memberOrder().filter(p=>p.active!==false||effective(m,p.id)).map(p=>{
 const a=effective(m,p.id);
 return `<div class="roster-row"><div class="roster-name">${avatarFor(p.id)} <span class="roster-name-text">${esc(p.name)}${a?.status==='present'&&a.note?`<small class="vote-note">📝 ${esc(a.note)}</small>`:''}${a?.status==='absent'&&section('absences')?`<small class="absence-reason">Grund: ${esc(a.reason||'Keine Angabe aus älterem Datenstand')}</small>`:''}</span></div>
 <div class="roster-right"><span class="chip ${!a?'gray':a.status==='present'?'yes-chip':'no-chip'}">${!a?'Noch offen':a.status==='present'?'✓ Dabei':'× Nicht dabei'}</span>${a?.updatedAt?`<small class="vote-stamp">Abgestimmt: ${esc(voteTime(a.updatedAt))}</small>`:''}</div></div>`;
 }).join('')}</div></div>`;
}

function tripOrganizers(x){const names=(x.organizerIds||[]).map(memberName).filter(Boolean);if(String(x.organizerOther||'').trim())names.push(x.organizerOther.trim());return names.length?names.join(', '):'Noch offen';}
function tripDateLabel(x){return !x.date?'Termin offen':x.endDate&&x.endDate!==x.date?`${dateLabel(x.date)} – ${dateLabel(x.endDate)}`:dateLabel(x.date);}
function tripLastDate(x){return x.endDate||x.date||'';}
function nextTrip(){return [...(data?.excursions||[])].filter(x=>!x.completed&&(!x.date||tripLastDate(x)>=today())).sort((a,b)=>Number(!a.date)-Number(!b.date)||String(a.date||'').localeCompare(String(b.date||''))||a.title.localeCompare(b.title,'de'))[0]||null;}
function excursionOwn(x){return excursionVotes.find(v=>v.excursion_id===x.id&&v.member_id===profile?.member_id);}
function excursionCount(id){const votes=excursionVotes.filter(v=>v.excursion_id===id);return {yes:votes.filter(v=>v.status==='yes').length,no:votes.filter(v=>v.status==='no').length};}
function excursionRoster(x){return `<div class="attendee-block"><div class="roster-header"><strong>Rückmeldungen</strong><small>${excursionCount(x.id).yes} dabei · ${excursionCount(x.id).no} nicht dabei</small></div><div class="roster-list">${memberOrder().filter(m=>m.active!==false||excursionVotes.some(v=>v.excursion_id===x.id&&v.member_id===m.id)).map(m=>{const v=excursionVotes.find(v=>v.excursion_id===x.id&&v.member_id===m.id);return `<div class="roster-row"><span class="roster-name">${avatarFor(m.id)} <span class="roster-name-text">${esc(m.name)}${v?.status==='yes'&&v.note?`<small class="vote-note">📝 ${esc(v.note)}</small>`:''}</span><span class="chip ${v?.status==='yes'?'yes-chip':v?.status==='no'?'no-chip':'gray'}">${v?.status==='yes'?'✓ Dabei':v?.status==='no'?'× Nicht dabei':'Noch offen'}</span>${v?.updated_at?`<small class="vote-stamp">Abgestimmt: ${esc(voteTime(v.updated_at))}</small>`:''}${v?.admin_locked?'<small class="muted">Admin-Korrektur</small>':''}</div>`}).join('')}</div></div>`;}
const stats=(id,y)=>data.meetings.filter(m=>m.date<=today()&&(!y||m.date.startsWith(y))&&effective(m,id)?.status==='present').length;
const count=(m,y)=>y?stats(m.id,y)+(y==='2026'?n(m.historical2026Count):0):stats(m.id)+n(m.historicalCount);
const ranks=y=>[...data.members].map(m=>({...m,count:count(m,y)})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'de'));
function leaders(y){const rows=ranks(y);return rows.length&&rows[0].count>0?rows.filter(m=>m.count===rows[0].count):[];}
function daysUntil(s){const parts=s?.split('-').map(Number),t=today().split('-').map(Number);if(!parts||parts.length!==3)return null;return Math.max(0,Math.round((Date.UTC(parts[0],parts[1]-1,parts[2])-Date.UTC(t[0],t[1]-1,t[2]))/86400000));}
function renderGate(msg=''){
 $('#reader-app').hidden=true;$('#auth-gate').hidden=false;$('#tabs').innerHTML='';
 if(!user){
  const signingUp=authMode==='signup';
  $('#auth-gate').innerHTML=`<section class="card auth-card"><div class="auth-top">${heading(signingUp?'Konto erstellen':'Anmelden')}<p class="muted">${signingUp?'Benutzername und Passwort festlegen.':'Mit FantastiX-Konto anmelden.'}</p></div>
   ${msg?`<div class="notice warning">${esc(msg)}</div>`:''}
   <form id="reader-auth-form" class="stack">
     <div class="field"><label>${signingUp?'Benutzername':'Benutzername oder bisherige E-Mail'}</label>
     <input name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="120" ${signingUp?'minlength="3" maxlength="24" pattern="[A-Za-z][A-Za-z0-9_-]{2,23}"':''} placeholder="z. B. andi8" required></div>
     <div class="field"><label>Passwort${signingUp?' (mindestens 8 Zeichen)':''}</label><input name="password" type="password" minlength="${signingUp?'8':'1'}" autocomplete="${signingUp?'new-password':'current-password'}" required></div>
     <button class="button" type="submit">${signingUp?'Registrieren':'Anmelden'}</button>
   </form>
   <button class="ghost auth-toggle" type="button" id="auth-mode-toggle">${signingUp?'Schon registriert? Anmelden':'Neues Konto registrieren'}</button>
   <p class="hint">${signingUp?'Keine E-Mail erforderlich. Der Admin schaltet dein Konto nach der Registrierung frei.':'Passwort vergessen? Bitte den Administrator kontaktieren.'}</p>
   </section>`;
  return;
 }
 $('#auth-gate').innerHTML=`<section class="card auth-card"><h2>Freigabe ausstehend</h2><p class="muted">${esc(displayAccount())} ist angemeldet, aber noch keinem Mitglied zugeordnet.</p>${msg?`<p class="notice warning">${esc(msg)}</p>`:''}<div class="stack"><button class="button" id="reader-retry" type="button">Freigabe prüfen</button><button class="ghost" id="reader-logout" type="button">Abmelden</button></div></section>`;
}

/* Dauerhafte Benachrichtigungen getrennt von einmaligen Pop-ups */
let fxAlerts=[],fxAlertLastLoad=0;
const fxUnread=()=>fxAlerts.filter(x=>!x.read_at).length;
function fxRenderBell(){const btn=$('#reader-inbox-btn');if(!btn)return;const n=fxUnread();btn.innerHTML=`🔔${n?`<span class="fx-bell-count">${n>99?'99+':n}</span>`:''}`;btn.setAttribute('aria-label',`Benachrichtigungen: ${n} ungelesen`);btn.hidden=!user||!profile?.member_id;}
async function fxLoadAlerts(force=false){if(!cloud||!user||!profile?.member_id)return;if(!force&&Date.now()-fxAlertLastLoad<12000)return;try{const {data:rows,error}=await cloud.rpc('fantastix_inbox_list');if(error)throw error;fxAlerts=rows||[];fxAlertLastLoad=Date.now();fxRenderBell();}catch(e){console.warn('Benachrichtigungen: SQL 18 prüfen',e.message);}}
function fxInboxHTML(){return `<div class="fx-inbox-content"><div class="fx-inbox-head"><h2>🔔 Benachrichtigungen</h2><button id="reader-inbox-close" class="close" type="button">×</button></div><p class="hint">${fxUnread()} ungelesen · Neueste 100 Meldungen</p>${fxAlerts.length?fxAlerts.map(x=>`<div class="fx-inbox-item ${x.read_at?'':'unread'}"><strong>${esc(x.title)}</strong><p>${esc(x.body)}</p><small>${esc(dateTime(x.created_at))}</small>${!x.read_at?`<div class="fx-inbox-buttons"><button data-fx-read="${Number(x.id)}" type="button">Als gelesen markieren</button></div>`:''}</div>`).join(''):'<p class="muted">Noch keine Benachrichtigungen.</p>'}<div class="fx-inbox-buttons"><button id="reader-inbox-all" type="button">Alle als gelesen markieren</button></div></div>`;}
async function fxOpenInbox(){await fxLoadAlerts(true);const dlg=$('#reader-inbox-dialog');dlg.innerHTML=fxInboxHTML();dlg.showModal();}
async function fxMarkAlerts(id=null){const {error}=await cloud.rpc('fantastix_inbox_read',{p_id:id});if(error)return alert(error.message);await fxLoadAlerts(true);const dlg=$('#reader-inbox-dialog');if(dlg.open)dlg.innerHTML=fxInboxHTML();}
function renderApp(){
 if(!data||!profile?.member_id)return renderGate();
 $('#auth-gate').hidden=true;$('#reader-app').hidden=false;
 const tabs=[['dashboard','Start','⌂',true],['meetings','Stammtisch','▣',section('meetings')],['excursions','Events','✈',section('excursions')],['calendar','Kalender','▦',section('meetings')||section('excursions')||section('members')],['ranking','Rangliste','★',section('members')],['members','Mitglieder','♙',section('members')],['cash','Kassa','€',section('cash')||section('fines')]].filter(t=>t[3]);
 if(!tabs.some(t=>t[0]===tab))tab='dashboard';
 $('#tabs').innerHTML=tabs.map(([id,label,icon])=>`<button class="navbutton ${tab===id?'active':''}" data-tab="${id}" aria-label="${label}"><span class="tab-icon">${esc(icon)}</span><span>${esc(label)}</span></button>`).join('');
 $('#content').innerHTML=({dashboard,meetings,excursions,calendar:calendarPage,ranking,members,cash}[tab])();
 $('#updated').textContent='Stand: '+dateTime(lastFetched||data.publishedAt);fxRenderBell();
}
function dashboard(){
 const completed=data.meetings.filter(m=>m.date<=today()).sort((a,b)=>b.date.localeCompare(a.date));
 const next=[...data.meetings].filter(m=>m.date>=today()).sort((a,b)=>a.date.localeCompare(b.date))[0];
 const yr=section('members')?leaders(currentYear()):[],all=section('members')?leaders(null):[];
 const pending=section('fines')?data.fines.reduce((s,f)=>s+n(f.amountCents),0)-data.payments.reduce((s,p)=>s+n(p.amountCents),0):null;
 const leaderHTML=lst=>lst.length?`<div class="leader-list">${lst.map(m=>`<span>${esc(m.name)}</span>`).join('')}</div><small>${lst[0].count} Teilnahmen</small>`:'<div class="value">–</div>';
 return `${heading('Dashboard')}<div class="metric-grid dashboard-v36">
  <div class="metric"><small>Tage bis zum Lecker Bierchen <span class="beer-symbol" aria-hidden="true">🍺</span></small><div class="value">${next?daysUntil(next.date):'–'}</div></div>
  <div class="metric"><small>Kontostand</small><div class="value balance-tile">${section('cash')?money(data.cashbook?.balanceCents):'–'}</div><small>Offene Strafen: ${pending!==null?money(Math.max(0,pending)):'–'}</small></div>
  <div class="metric"><small>Jahresführung ${currentYear()}</small>${leaderHTML(yr)}</div>
  <div class="metric"><small>Ewige Führung</small>${leaderHTML(all)}</div>
 </div>
 <section class="card next-card"><div class="row"><h2>Nächster Stammtisch</h2><span class="chip">${next?daysUntil(next.date)===0?'Heute':`In ${daysUntil(next.date)} Tagen`:'Nicht geplant'}</span></div>
 ${next?`<strong class="next-date">${dateLabel(next.date)}</strong><p class="next-place">${esc(next.location||'Gasthaus noch offen')} · ${esc(timeLabel(next.time))} Uhr</p><p class="muted tiny">Organisator: ${esc(memberName(next.organizerId))}</p>${votePanel(next,true)}${section('members')?`<div class="rsvp-short">${(()=>{const c=rsvpCounts(next);return `${c.yes} Zusagen · ${c.no} Absagen · ${c.open} offen`;})()} <button type="button" class="smallbtn" data-tab="meetings">Alle ansehen →</button></div>`:''}`:'<p class="muted">Noch kein nächster Stammtisch eingetragen.</p>'}</section>
 <section class="card"><h2>Letzte 2 Stammtische</h2>${completed.slice(0,2).length?completed.slice(0,2).map(m=>`<div class="item"><div class="avatar">${esc(m.date.slice(-2))}</div><div class="details"><strong>${dateLabel(m.date)}</strong><small>${esc(m.location||'Ohne Gasthaus')} · ${data.members.filter(p=>effective(m,p.id)?.status==='present').length} anwesend</small></div></div>`).join(''):'<p class="muted">Noch keine Stammtische.</p>'}</section>
 ${section('excursions')?`<section class="card excursion-preview"><div class="row"><h2>Nächster Event</h2><span class="chip">${nextTrip()?tripDateLabel(nextTrip()):'Nicht geplant'}</span></div>${nextTrip()?`<strong class="excursion-title">${esc(nextTrip().title)}</strong><p class="muted">Organisatoren: ${esc(tripOrganizers(nextTrip()))}</p><button class="ghost" data-tab="excursions" type="button">Events ansehen →</button>`:'<p class="muted">Noch kein Event geplant.</p>'}</section>`:''}
 `;
}
function votePanel(m,compact=false){
 if(!profile?.member_id||!section('meetings'))return '';
 const own=effective(m,profile.member_id);
 const locked=!!(own&&coalesceSource(own)!=='member');
 const deadline=deadlines.get(m.id),closed=deadline?Date.now()>=new Date(deadline).getTime():true;
 const status=own?.status||'';
 const summary=locked?'Vom Admin korrigiert':closed?'Abstimmung geschlossen':`Bis ${deadlineLabel(deadline)}`;
 return `<div class="vote-panel ${compact?'compact':''}"><div class="vote-header"><strong>Deine Teilnahme</strong><span class="chip ${locked||closed?'gray':''}">${esc(summary)}</span></div>
 <div class="vote-actions"><button type="button" class="vote-btn ${status==='present'?'selected yes':''}" data-vote="present" data-meeting-id="${esc(m.id)}" ${locked||closed||busy?'disabled':''}>✓ Dabei</button>
 <button type="button" class="vote-btn ${status==='absent'?'selected no':''}" data-vote="absent" data-meeting-id="${esc(m.id)}" ${locked||closed||busy?'disabled':''}>× Nicht dabei</button></div>
 ${status==='present'&&own?.note?`<small class="vote-note">📝 ${esc(own.note)}</small>`:''}${status?`<small class="muted">${status==='present'?'Dabei':'Nicht dabei'}${status==='absent'&&section('absences')&&own.reason?' · '+esc(own.reason):''}</small>`:'<small class="muted">Noch keine Antwort</small>'}</div>`;
}
function coalesceSource(a){return a.source||'admin';}
function meetings(){
 if(!section('meetings'))return empty('Stammtische sind nicht freigegeben.');
 const items=[...data.meetings].sort((a,b)=>b.date.localeCompare(a.date));
 return `${heading('Stammtische')}${items.length?items.map(m=>`<section class="card meeting-card">
 <div class="row"><h2>${dateLabel(m.date)}</h2><span class="chip ${m.date>today()?'':'gray'}">${m.date>today()?'Geplant':'Vergangen'}</span></div>
 <p>${esc(m.location||'Gasthaus offen')} · ${esc(timeLabel(m.time))} Uhr</p>
 ${section('members')?`<p class="muted tiny">Organisator: ${esc(memberName(m.organizerId))}</p>`:''}
 ${votePanel(m)}
 ${rsvpRoster(m)}
 
 ${section('absences')&&m.notes?`<p class="hint">${esc(m.notes)}</p>`:''}
 </section>`).join(''):empty('Noch keine Stammtische.')}`;
}

function calendarPage(){const shown={meetings:section('meetings')?data.meetings:[],excursions:section('excursions')?data.excursions:[],birthdays:section('members')?birthdays.map(b=>({...b,name:memberName(b.member_id)})):[]};return `${heading('Kalender')}${window.FantastiXCalendar.render(shown,calendarMonth,calendarSelected,false)}`;}
function excursions(){
 const sorted=[...(data.excursions||[])].sort((a,b)=>Number(!!a.completed)-Number(!!b.completed)||Number(!a.date)-Number(!b.date)||String(a.date||'').localeCompare(String(b.date||''))||a.title.localeCompare(b.title,'de'));
 return `${heading('Events')}${excursionVoteError?`<div class="notice warning">${esc(excursionVoteError)}</div>`:''}
 ${sorted.length?sorted.map(x=>{const own=excursionOwn(x),completed=x.completed||(x.date&&tripLastDate(x)<today());return `<section class="card excursion-card"><div class="row"><h2>${esc(x.title)}</h2><span class="chip ${completed?'gray':''}">${x.completed?'Abgeschlossen':tripDateLabel(x)}</span></div>
 ${x.location?`<p><strong>${esc(x.location)}</strong></p>`:''}${x.notes?`<p class="muted">${esc(x.notes)}</p>`:''}<p class="muted tiny">Organisatoren: ${esc(tripOrganizers(x))}</p>
 <div class="vote-panel"><div class="vote-header"><strong>Meine Rückmeldung</strong><span class="chip ${own?.status==='yes'?'yes-chip':own?.status==='no'?'no-chip':'gray'}">${own?.status==='yes'?'Dabei':own?.status==='no'?'Nicht dabei':'Noch offen'}</span></div>
 <div class="vote-actions"><button type="button" class="vote-btn ${own?.status==='yes'?'selected yes':''}" data-excursion-vote="yes" data-excursion-id="${esc(x.id)}" ${completed||busy||!!excursionVoteError||own?.admin_locked?'disabled':''}>✓ Dabei</button><button type="button" class="vote-btn ${own?.status==='no'?'selected no':''}" data-excursion-vote="no" data-excursion-id="${esc(x.id)}" ${completed||busy||!!excursionVoteError||own?.admin_locked?'disabled':''}>× Nicht dabei</button></div>
 ${own?.status==='yes'&&own.note?`<small class="vote-note">📝 ${esc(own.note)}</small>`:''}<small class="muted">${own?.admin_locked?'Deine Rückmeldung wurde vom Admin korrigiert.':'Unverbindliche Planung · Keine Auswirkung auf die Rangliste oder Strafen'}</small></div>${excursionRoster(x)}</section>`}).join(''):empty('Noch keine Events eingetragen.')}`;
}
function ranking(){
 if(!section('members'))return empty('Ranglisten sind nicht freigegeben.');
 const nowYear=Number(currentYear());const years=[...new Set([...Array.from({length:Math.max(1,nowYear-2026+1)},(_,i)=>String(2026+i)),...data.meetings.map(m=>m.date.slice(0,4))])].filter(y=>/^\d{4}$/.test(y)).sort().reverse();
 return `${heading('Ranglisten')}<div class="card"><div class="field"><label for="reader-ranking-year">Rangliste auswählen</label><select id="reader-ranking-year" aria-label="Rangliste nach Jahr filtern"><option value="all" ${year==='all'?'selected':''}>Ewig · Alle Jahre</option>${years.map(y=>`<option value="${y}" ${year===y?'selected':''}>${y}</option>`).join('')}</select></div><div class="separator"></div><div class="tablewrap"><table class="table"><thead><tr><th>Platz</th><th>Mitglied</th><th>Teilnahmen</th></tr></thead><tbody>${ranks(year==='all'?null:year).map((m,i)=>`<tr><td>${i+1}.</td><td>${esc(m.name)}</td><td><strong>${m.count}</strong></td></tr>`).join('')}</tbody></table></div></div>`;
}

function myBirthday(){return birthdays.find(b=>b.member_id===profile?.member_id);}
function birthdayText(b){return b?`${String(b.day).padStart(2,'0')}.${String(b.month).padStart(2,'0')}.`:'Nicht eingetragen';}
async function loadBirthdays(){
 if(!cloud||!user||!profile?.member_id)return;
 const {data:rows,error}=await cloud.from('fantastix_birthdays').select('member_id,month,day');
 if(error)throw error;
 birthdays=rows||[];
}
async function saveMyBirthday(form){
 if(!cloud||!profile?.member_id)return;
 const fd=new FormData(form),day=Number(fd.get('day')),month=Number(fd.get('month'));
 if(!Number.isInteger(day)||!Number.isInteger(month)||day<1||day>31||month<1||month>12)return alert('Bitte einen gültigen Tag und Monat wählen.');
 try{
  const {error}=await cloud.rpc('fantastix_set_my_birthday',{p_month:month,p_day:day});if(error)throw error;
  await loadBirthdays();renderApp();alert('Geburtstag gespeichert – jährlich im Kalender sichtbar.');
 }catch(e){alert('Geburtstag konnte nicht gespeichert werden: '+e.message);}
}
async function deleteMyBirthday(){
 if(!confirm('Geburtstag aus FantastiX entfernen?'))return;
 try{const {error}=await cloud.rpc('fantastix_set_my_birthday',{p_month:null,p_day:null});if(error)throw error;
 await loadBirthdays();renderApp();}catch(e){alert('Entfernen fehlgeschlagen: '+e.message);}
}
function members(){
 if(!section('members'))return empty('Mitglieder sind nicht freigegeben.');
 return `${heading('Mitglieder')}<section class="card"><h2>Nachricht an alle</h2><p class="muted tiny">Deine Nachricht erscheint bei allen freigeschalteten Mitgliedern einmal als Pop-up. Dein Name steht als Absender dabei. Maximal 3 Nachrichten innerhalb von 24 Stunden.</p><button class="ghost" id="member-notice-open" type="button">+ Pop-up-Nachricht senden</button></section><section class="card"><div class="my-photo-card">${avatarFor(profile.member_id)}<div><strong>Mein Profilfoto</strong><label class="photo-upload-btn">Foto wählen<input class="photo-upload-input" type="file" accept="image/*" hidden></label>${avatarUrls[profile.member_id]?'<button type="button" class="smallbtn" id="delete-my-photo">Entfernen</button>':''}</div></div><div class="birthday-editor"><strong>Mein Geburtstag</strong><p class="muted tiny">Nur Tag und Monat werden gespeichert. Im Kalender erscheint der Geburtstag jedes Jahr; ein Geburtsjahr wird nicht gespeichert.</p><form id="birthday-form" class="birthday-form"><div class="field"><label>Tag</label><select name="day" required><option value="">Tag</option>${Array.from({length:31},(_,i)=>`<option value="${i+1}" ${myBirthday()?.day===i+1?'selected':''}>${i+1}</option>`).join('')}</select></div><div class="field"><label>Monat</label><select name="month" required><option value="">Monat</option>${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${myBirthday()?.month===i+1?'selected':''}>${new Date(2000,i,1).toLocaleDateString('de-AT',{month:'long'})}</option>`).join('')}</select></div><button type="submit" class="ghost">Geburtstag speichern</button></form>${myBirthday()?`<div class="row"><small>Aktuell: ${birthdayText(myBirthday())}</small><button type="button" class="smallbtn" id="birthday-remove">Entfernen</button></div>`:''}</div><details class="account-tools"><summary>Mein Konto</summary><form id="reader-password-form" class="stack"><div class="field"><label>Neues Passwort</label><input name="newPassword" type="password" autocomplete="new-password" minlength="8" required></div><div class="field"><label>Passwort wiederholen</label><input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required></div><button type="submit" class="ghost">Passwort ändern</button></form><button type="button" class="danger-btn" id="reader-logout">Abmelden</button></details></section><section class="card"><div class="list">${[...data.members].sort((a,b)=>(a.memberNumber??99999)-(b.memberNumber??99999)).map(m=>`<div class="item">${avatarFor(m.id)}<div class="details"><strong>${esc(m.name)}</strong><small>${currentYear()}: ${count(m,currentYear())} · Ewig: ${count(m,null)}</small><small class="member-last-online">${esc(lastOnlineText(m.id))}</small></div></div>`).join('')||'<p>Keine Mitglieder</p>'}</div></section>${pushPromptHTML()}`;
}
function cash(){
 const c=data.cashbook||{},fined=data.fines.reduce((s,f)=>s+n(f.amountCents),0),paid=data.payments.reduce((s,p)=>s+n(p.amountCents),0);
 return `${heading('Kassa')}${section('cash')?`<div class="cash-hero"><span>Kontostand</span><div class="cash-balance">${money(c.balanceCents)}</div></div><section class="card"><h2>Kassenbuch</h2><div class="list">${(c.transactions||[]).map(t=>`<div class="item"><div class="details"><strong>${esc(t.type==='expense'?'Ausgabe':t.type==='monthly'?'Monatsbeitrag':t.type==='adjustment'?'Korrektur':'Strafzahlung')}</strong><small>${esc(t.note||'')}</small></div><strong>${t.amountCents>0?'+':''}${money(t.amountCents)}</strong></div>`).join('')||'<p class="muted">Keine Buchungen</p>'}</div></section>`:''}
 ${section('fines')?`<div class="metric-grid"><div class="metric"><small>Strafen gesamt</small><div class="value">${money(fined)}</div></div><div class="metric"><small>Offen</small><div class="value red">${money(Math.max(0,fined-paid))}</div></div></div><section class="card"><h2>Strafen</h2><div class="list">${data.fines.map(f=>{const settled=data.payments.filter(p=>p.fineId===f.id).reduce((s,p)=>s+n(p.amountCents),0);return `<div class="item"><div class="details"><strong>${esc(memberName(f.memberId))}</strong><small>${esc(f.reason||'Strafe')}</small></div><div class="right"><strong>${money(f.amountCents)}</strong><small class="muted">${money(Math.max(0,f.amountCents-settled))} offen</small></div></div>`}).join('')||'<p>Keine Strafen</p>'}</div></section>`:''}`;
}
// Nur einmal pro Benutzer: Der Server liefert ausschliesslich noch nicht bestaetigte Nachrichten.
// Keine Nachrichtenliste und kein Menuepunkt fuer Leser.
function showNextNotice(){
 const dlg=$('#notice-dialog');
 if(!dlg||dlg.open||noticeAcknowledging||!profile?.member_id||!noticeQueue.length)return;
 if($('#absence-dialog')?.open)return;
 const v=noticeQueue.shift();
 if(!v)return;
 dlg.dataset.noticeId=String(v.id);
 dlg.innerHTML=`<div class="modalbody"><div class="modalhead"><h2>${esc(v.title)}</h2></div><p class="muted tiny">Von: ${esc(v.sender_name||'Administrator')}</p><p class="notice-popup-body">${esc(v.message)}</p><button class="button notice-ack" type="button" id="notice-ack">OK, verstanden</button></div>`;
 dlg.showModal();
}
function openMemberNotice(){
 if(!user||!profile?.member_id)return alert('Bitte zuerst anmelden und einem Mitglied zuordnen lassen.');
 const dlg=$('#member-notice-dialog');
 dlg.innerHTML=`<form id="member-notice-form" class="modalbody"><div class="modalhead"><h2>Pop-up-Nachricht senden</h2><button type="button" class="ghost" id="member-notice-close">Schließen</button></div><p class="hint">Absender: ${esc(memberName(profile.member_id))}. Für alle freigeschalteten Mitglieder sichtbar.</p><div class="field"><label>Überschrift</label><input name="title" maxlength="90" required></div><div class="field"><label>Nachricht</label><textarea name="message" rows="5" maxlength="800" required></textarea></div><button class="button" type="submit">An alle senden</button></form>`;
 dlg.showModal();
}
async function sendMemberNotice(form){
 if(busy)return;
 const fd=new FormData(form),title=String(fd.get('title')||'').trim(),message=String(fd.get('message')||'').trim();
 if(title.length<1||title.length>90||message.length<1||message.length>800)return alert('Titel und Text ausfüllen.');
 if(!confirm('Diese Pop-up-Nachricht wirklich an alle freigeschalteten Mitglieder senden?'))return;
 busy=true;
 try{
  const {error}=await cloud.rpc('fantastix_member_notice_create',{p_title:title,p_message:message});
  if(error)throw error;
  $('#member-notice-dialog').close();alert('Nachricht verschickt. Dein Name wird als Absender angezeigt.');
 }catch(e){alert('Versand fehlgeschlagen: '+(e.message||String(e)));}
 finally{busy=false;}
}
function queueNewNotices(){
 const dlg=$('#notice-dialog');const shown=dlg?.open?Number(dlg.dataset.noticeId):null;
 const existing=new Set(noticeQueue.map(v=>Number(v.id)));
 for(const msg of notices){
  const id=Number(msg.id);
  if(!Number.isSafeInteger(id)||id===shown||existing.has(id))continue;
  noticeQueue.push(msg);existing.add(id);
 }
 const live=new Set(notices.map(v=>Number(v.id)));
 noticeQueue=noticeQueue.filter(v=>live.has(Number(v.id))).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
 setTimeout(showNextNotice,0);
}
async function acknowledgeNotice(){
 if(noticeAcknowledging||!cloud||!user)return;
 const dlg=$('#notice-dialog');const id=Number(dlg?.dataset.noticeId);
 if(!Number.isSafeInteger(id)||id<=0)return;
 noticeAcknowledging=true;
 const button=dlg.querySelector('#notice-ack');if(button)button.disabled=true;
 try{
  const {error}=await cloud.rpc('fantastix_notice_ack',{p_id:id});if(error)throw error;
  notices=notices.filter(v=>Number(v.id)!==id);
  noticeQueue=noticeQueue.filter(v=>Number(v.id)!==id);
  dlg.close();
 }catch(e){
  alert('Bestätigung konnte nicht gespeichert werden. Bitte erneut versuchen: '+(e.message||String(e)));
  if(button)button.disabled=false;
 }finally{noticeAcknowledging=false;showNextNotice();}
}
function profilePage(){return `${heading('Mein Profil')}<section class="card"><h2>${esc(member(profile.member_id)?.name||'Mitglied')}</h2><div class="my-photo-card">${avatarFor(profile.member_id)}<label class="photo-upload-btn">Foto wählen<input class="photo-upload-input" type="file" accept="image/*" hidden></label>${avatarUrls[profile.member_id]?'<button type="button" class="smallbtn" id="delete-my-photo">Entfernen</button>':''}</div><p class="muted">${esc(displayAccount())}</p><p class="hint">Mitgliedsnummer: ${esc(member(profile.member_id)?.memberNumber||'–')}</p><form id="reader-password-form" class="stack"><div class="field"><label>Neues Passwort</label><input type="password" name="newPassword" minlength="8" autocomplete="new-password" required></div><div class="field"><label>Passwort wiederholen</label><input type="password" name="confirmPassword" minlength="8" autocomplete="new-password" required></div><button type="submit" class="ghost">Passwort ändern</button></form><div class="stack"><button type="button" class="ghost" id="reader-refresh">Aktualisieren</button><button type="button" class="danger-btn" id="reader-logout">Abmelden</button></div></section>`;}

/* FantastiX 3.11: Web Push - Opt-in nur nach ausdruecklichem Tippen. */
let pushBusy=false, pushEnabled=false;
const PUSH_CONFIG=()=>String(window.FANTASTIX_PUSH_PUBLIC_KEY||'');
function base64UrlToUint8Array(s){const pad='='.repeat((4-s.length%4)%4);const raw=atob((s+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
function pushSupported(){return window.isSecureContext&&'Notification' in window&&'serviceWorker' in navigator&&'PushManager' in window&&!!PUSH_CONFIG();}
function pushPromptHTML(){
 if(!pushSupported())return '<section class="push-setup"><strong>Mitteilungen</strong><p>Für Push-Mitteilungen diese App auf einem unterstützten Gerät als Web-App installieren (iPhone: Safari → Teilen → Zum Home-Bildschirm) und erneut öffnen.</p></section>';
 if(pushEnabled)return `<section class="push-setup"><strong>Mitteilungen aktiviert ✓</strong><p>Du erhältst Hinweise zu neuen Stammtischen und Admin-Nachrichten. <button class="smallbtn" type="button" id="push-disable">Deaktivieren</button></p></section>`;
 return `<section class="push-setup"><strong>Stammtisch-Mitteilungen</strong><p>Erhalte Push-Mitteilungen bei neuen Stammtischen und Admin-Nachrichten. Es gibt keine Fristerinnerungen.</p><button class="button" type="button" id="push-enable" ${pushBusy?'disabled':''}>🔔 Mitteilungen erlauben</button><p class="push-status">${Notification.permission==='denied'?'Mitteilungen sind für FantastiX in deinen Geräteeinstellungen blockiert.':''}</p></section>`;
}
// PushManager.subscribe() darf erst nach der Aktivierung des Service Workers laufen.
// Eine erfolgreiche register()-Antwort allein bedeutet NICHT, dass er schon aktiv ist.
async function activePushRegistration(){
 const script=new URL('./service-worker.js',location.href);
 const registration=await navigator.serviceWorker.register(script.href,{scope:'./',updateViaCache:'none'});
 if(registration.active?.state==='activated')return registration;
 await new Promise((resolve,reject)=>{
  let settled=false;
  const worker=registration.installing||registration.waiting||registration.active;
  const cleanup=()=>{clearTimeout(timer);worker?.removeEventListener('statechange',check);navigator.serviceWorker.removeEventListener('controllerchange',check);};
  const finish=(err)=>{if(settled)return;settled=true;cleanup();err?reject(err):resolve();};
  const check=()=>{
   if(registration.active?.state==='activated'||worker?.state==='activated')finish();
   else if(worker?.state==='redundant')finish(Error('Der Service Worker konnte nicht installiert werden. Bitte FantastiX über „aktualisieren.html“ aktualisieren und erneut versuchen.'));
  };
  const timer=setTimeout(()=>finish(Error('Der Service Worker wurde nicht rechtzeitig aktiv. Bitte die App neu öffnen und erneut versuchen.')),20000);
  worker?.addEventListener('statechange',check);
  navigator.serviceWorker.addEventListener('controllerchange',check);
  check();
 });
 if(!registration.active||registration.active.state!=='activated')throw Error('Kein aktiver Service Worker. Bitte die App neu öffnen.');
 return registration;
}
async function detectPushSubscription(){
 if(!pushSupported()||!user||!profile?.member_id)return;
 try{const reg=await activePushRegistration();const sub=await reg.pushManager.getSubscription();pushEnabled=!!sub&&Notification.permission==='granted';if(pushEnabled){const {error}=await cloud.rpc('fantastix_push_subscribe',{p_subscription:sub.toJSON()});if(error)throw error;}}catch(e){pushEnabled=false;console.warn('Push-Status:',e);}
 if(tab==='dashboard'&&data)renderApp();
}
async function enablePush(){
 if(pushBusy||!cloud||!user||!profile?.member_id)return;
 if(!pushSupported())return alert('Push-Mitteilungen werden hier nicht unterstützt. Auf dem iPhone musst du FantastiX zuerst auf dem Home-Bildschirm installieren.');
 pushBusy=true;
 try{
  // Prompt unmittelbar infolge des Nutzer-Tipps aufrufen (iOS-Anforderung).
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw Error('Mitteilungen wurden nicht erlaubt. Bitte prüfe die iPhone-Einstellungen.');
  const reg=await activePushRegistration();
  let sub=await reg.pushManager.getSubscription();
  const vapid=base64UrlToUint8Array(PUSH_CONFIG());
  if(sub&&sub.options?.applicationServerKey){const current=new Uint8Array(sub.options.applicationServerKey);if(current.length!==vapid.length||current.some((v,i)=>v!==vapid[i])){await sub.unsubscribe();sub=null;}}
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapid});
  const {error}=await cloud.rpc('fantastix_push_subscribe',{p_subscription:sub.toJSON()});
  if(error)throw error;
  pushEnabled=true;alert('Mitteilungen sind aktiviert.');
 }catch(e){const message=e.message||String(e);alert('Push-Aktivierung fehlgeschlagen: '+message+'\nFalls der Service Worker noch nicht aktiv ist: FantastiX aktualisieren, die installierte Home-Bildschirm-App schließen und neu öffnen. Falls die Anmeldung in Supabase fehlschlägt: Push-SQL und Edge-Funktion prüfen.');}
 finally{pushBusy=false;renderApp();}
}
async function disablePush(){
 if(!cloud||!user)return;
 try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();
  if(sub){const {error}=await cloud.rpc('fantastix_push_unsubscribe',{p_endpoint:sub.endpoint});if(error)throw error;await sub.unsubscribe();}
  pushEnabled=false;renderApp();
 }catch(e){alert('Deaktivieren fehlgeschlagen: '+(e.message||String(e)));}
}

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
  const {data:account,error:accountError}=await cloud.from('fantastix_reader_profiles').select('member_id,email,username').eq('user_id',user.id).maybeSingle();
  if(accountError)throw accountError;profile=account;
  if(!profile?.member_id){data=null;return renderGate();}
  const [pub,windows]=await Promise.all([
   cloud.from('fantastix_public').select('content,published_at').eq('id','main').eq('is_published',true).maybeSingle(),
   cloud.rpc('fantastix_reader_deadlines')
  ]);
  if(pub.error)throw pub.error;if(windows.error)throw windows.error;
  if(!pub.data?.content){data=null;$('#reader-app').hidden=true;$('#auth-gate').hidden=false;$('#auth-gate').innerHTML=empty('Noch keine Daten für Leser freigegeben.');return;}
  const d=pub.data.content;
  if(!d.sections||!Array.isArray(d.members)||!Array.isArray(d.meetings)||!Array.isArray(d.fines)||!Array.isArray(d.payments))throw Error('Unbekanntes Datenformat.');
  if(d.excursions!==undefined&&!Array.isArray(d.excursions))throw Error('Ungültige Eventsdaten.');d.excursions=d.excursions||[];
  data=d;await updateOnlinePresence();await loadOnlinePresence();fxLoadAlerts(true).catch(()=>{});deadlines=new Map((windows.data||[]).map(r=>[r.meeting_id,r.deadline_at]));lastFetched=pub.data.published_at||new Date().toISOString();
  if(section('excursions')){
    const res=await cloud.rpc('fantastix_excursion_votes_read_v2');
    if(res.error){excursionVoteError='Eventszusagen derzeit nicht verfügbar. SQL-Update 09 prüfen.';excursionVotes=[];console.warn(res.error);}
    else{excursionVotes=res.data||[];const notes=await cloud.rpc('fantastix_excursion_vote_notes_read');if(notes.error)throw notes.error;const map=new Map((notes.data||[]).map(x=>[x.excursion_id+'|'+x.member_id,x.note]));excursionVotes.forEach(v=>v.note=map.get(v.excursion_id+'|'+v.member_id)||'');excursionVoteError='';}
  }else{excursionVotes=[];excursionVoteError='';}

  try{await loadBirthdays();}catch(e){console.warn('Geburtstage nicht verfügbar:',e);birthdays=[];}
  try{await loadAvatars();}catch(e){console.warn('Profilfotos nicht verfügbar:',e);}
  try{const res=await cloud.rpc('fantastix_notice_list');if(res.error)throw res.error;notices=res.data||[];queueNewNotices();}catch(e){notices=[];console.warn('Nachrichten konnten nicht geladen werden:',e);}
  renderApp();detectPushSubscription();
 }catch(e){data=null;$('#reader-app').hidden=true;$('#auth-gate').hidden=false;$('#auth-gate').innerHTML=empty('Laden fehlgeschlagen: '+(e.message||String(e))+' · Bitte erneut öffnen.');}
}
async function doAuth(form){
 if(busy)return;
 const fd=new FormData(form),raw=String(fd.get('username')||'').trim();
 const username=raw.toLowerCase(),password=String(fd.get('password')||'');
 if(authMode==='signup'&&!USERNAME_RE.test(username))return renderGate('Benutzername: 3–24 Zeichen, mit Buchstaben beginnen; erlaubt sind a–z, 0–9, _ und -.');
 if(authMode==='signup'&&password.length<8)return renderGate('Das Passwort muss mindestens 8 Zeichen haben.');
 if(authMode==='login'&&!raw)return renderGate('Bitte Benutzernamen eingeben.');
 busy=true;
 try{
  if(authMode==='signup'){
   const {data:result,error}=await cloud.auth.signUp({
     email:usernameEmail(username),password,options:{data:{fantastix_username:username}}
   });
   if(error)throw error;
   if(!result?.session){
    authMode='login';
    renderGate('Konto nicht direkt aktiviert. Bitte in Supabase die Einstellung „Confirm Email“ deaktivieren. Es ist kein E-Mail-Versand vorgesehen.');
   } else {
    user=result.user;
    await refresh();
   }
  }else{
   const login=raw.includes('@')?raw.toLowerCase():usernameOrEmail(username);
   const {data:result,error}=await cloud.auth.signInWithPassword({email:login,password});
   if(error)throw error;
   user=result.user;
   await refresh();
  }
 }catch(e){
  const description=String(e.message||e);
  const message=/rate.limit|too.many.requests|429/i.test(description)?'Zu viele Anmeldeversuche. Bitte einige Minuten warten und nicht mehrfach registrieren.':
    /already.registered|already.exists|duplicate|unique/i.test(description)?'Dieser Benutzername ist bereits vergeben. Bitte einen anderen wählen.':
    /invalid.login.credentials/i.test(description)?'Benutzername oder Passwort ist nicht korrekt. Für alte Admin-Konten die bisherige E-Mail eingeben.':
    /invalid.email|email.address.*invalid/i.test(description)?'Die interne Anmeldekennung wurde von Supabase abgelehnt. Bitte den Administrator kontaktieren.':
    description;
  renderGate('Anmeldung fehlgeschlagen: '+message);
 }finally{busy=false;}
}
async function changePassword(form){
 const fd=new FormData(form),password=String(fd.get('newPassword')||''),confirmPassword=String(fd.get('confirmPassword')||'');
 if(password.length<8||password!==confirmPassword)return alert('Bitte zweimal dasselbe Passwort mit mindestens 8 Zeichen eingeben.');
 const {error}=await cloud.auth.updateUser({password});
 if(error)return alert('Passwort konnte nicht geändert werden: '+error.message);
 form.reset();alert('Passwort geändert.');
}
async function logout(){if(!cloud)return;try{if(pushSupported()){const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(sub){await cloud.rpc('fantastix_push_unsubscribe',{p_endpoint:sub.endpoint});await sub.unsubscribe();}}}catch(e){console.warn('Push-Abmeldung:',e);}pushEnabled=false;fxAlerts=[];fxRenderBell();await cloud.auth.signOut();user=null;profile=null;data=null;notices=[];noticeQueue=[];noticeAcknowledging=false;if($('#notice-dialog')?.open)$('#notice-dialog').close();avatarUrls={};lastOnlineByMember={};lastOnlineChecked=0;birthdays=[];avatarLoadedAt=0;deadlines.clear();tab='dashboard';authMode='login';renderGate();}
async function castVote(meetingId,status,reason='',note=''){
 if(busy||!data||!profile?.member_id)return;
 const m=data.meetings.find(x=>x.id===meetingId);if(!m)return;
 const deadline=deadlines.get(meetingId);
 if(!deadline||Date.now()>=new Date(deadline).getTime())return alert('Die Abstimmungsfrist ist abgelaufen.');
 const own=effective(m,profile.member_id);
 if(own&&coalesceSource(own)!=='member')return alert('Der Admin hat die Stimme korrigiert.');
 if(status==='absent'&&!reason.trim())return alert('Bitte einen Grund eintragen.');
 if(note.length>160)return alert('Bitte höchstens 160 Zeichen eingeben.');
 busy=true;renderApp();
 try{
   const {error}=await cloud.rpc('fantastix_cast_vote',{
     p_meeting_id:meetingId,p_status:status,p_reason:status==='absent'?reason.trim():'',p_note:status==='present'?note.trim():''
   });
   if(error)throw error;
   await refresh();
 }catch(e){alert('Abstimmung nicht gespeichert: '+e.message);}
 finally{busy=false;if(data)renderApp();}
}
async function voteExcursion(id,status,note=''){
 if(busy||!user||!profile?.member_id||!data||!section('excursions'))return;
 const trip=data.excursions.find(x=>x.id===id);if(!trip||trip.completed||(trip.date&&tripLastDate(trip)<today()))return alert('Dieser Event ist nicht mehr zur Anmeldung offen.');
 if(!['yes','no'].includes(status))return;
 if(note.length>160)return alert('Bitte höchstens 160 Zeichen eingeben.');
 if(excursionOwn(trip)?.admin_locked)return alert('Der Administrator hat deine Rückmeldung korrigiert.');
 busy=true;renderApp();
 try{
   const {error}=await cloud.rpc('fantastix_excursion_vote',{p_excursion_id:id,p_status:status,p_note:status==='yes'?note.trim():''});
   if(error)throw error;
   await refresh();
 }catch(e){alert('Rückmeldung nicht gespeichert: '+(e.message||String(e)));}
 finally{busy=false;if(data)renderApp();}
}
function askYesNote(kind,id){
 const dlg=$('#absence-dialog');
 const saved=kind==='meeting'?effective(data.meetings.find(m=>m.id===id)||{},profile?.member_id):excursionVotes.find(v=>v.excursion_id===id&&v.member_id===profile?.member_id);
 dlg.innerHTML=`<div class="modalbody"><div class="modalhead"><h2>✓ Dabei</h2><button type="button" class="close" id="close-absence" aria-label="Schließen">×</button></div><form id="yes-note-form"><input type="hidden" name="kind" value="${esc(kind)}"><input type="hidden" name="id" value="${esc(id)}"><div class="field"><label>Notiz (optional · für alle Mitglieder sichtbar)</label><input name="note" maxlength="160" value="${esc(saved?.note||'')}" placeholder="z. B. Komme später"></div><p class="hint">Alle freigeschalteten Mitglieder können deine Notiz zur Zusage lesen.</p><div class="foot"><button type="button" class="ghost" id="cancel-absence">Abbrechen</button><button type="submit" class="button">Dabei speichern</button></div></form></div>`;
 dlg.showModal();
}
function askAbsenceReason(meetingId){
 const meeting=data?.meetings?.find(m=>m.id===meetingId);
 const saved=meeting?effective(meeting,profile?.member_id):null;
 const dlg=$('#absence-dialog');
 dlg.innerHTML=`<div class="modalbody"><div class="modalhead"><h2>Grund für „Nicht dabei“</h2><button type="button" class="close" id="close-absence" aria-label="Schließen">×</button></div>
 <form id="absence-reason-form"><input type="hidden" name="meetingId" value="${esc(meetingId)}"><div class="field"><label>Abwesenheitsgrund *</label>
 <input name="reason" maxlength="150" minlength="1" value="${esc(saved?.status==='absent'?saved.reason||'':'')}" placeholder="z. B. Urlaub, beruflich verhindert" required autofocus></div>
 <div class="foot"><button type="button" class="ghost" id="cancel-absence">Abbrechen</button><button type="submit" class="button">Nicht dabei speichern</button></div></form></div>`;
 dlg.showModal();
}
document.addEventListener('submit',e=>{
 if(e.target.id==='reader-auth-form'){e.preventDefault();doAuth(e.target);}
 if(e.target.id==='reader-password-form'){e.preventDefault();changePassword(e.target);}
 if(e.target.id==='birthday-form'){e.preventDefault();saveMyBirthday(e.target);}
 if(e.target.id==='member-notice-form'){e.preventDefault();sendMemberNotice(e.target);}
 if(e.target.id==='yes-note-form'){e.preventDefault();const fd=new FormData(e.target),note=String(fd.get('note')||'').trim();$('#absence-dialog').close();if(fd.get('kind')==='meeting')castVote(String(fd.get('id')),'present','',note);else voteExcursion(String(fd.get('id')),'yes',note);}
 if(e.target.id==='absence-reason-form'){
   e.preventDefault();const fd=new FormData(e.target),reason=String(fd.get('reason')||'').trim();
   if(!reason)return alert('Bitte einen Abwesenheitsgrund eintragen.');
   $('#absence-dialog').close();castVote(String(fd.get('meetingId')||''),'absent',reason);
 }
});
document.addEventListener('click',e=>{
 const toggle=e.target.closest('#auth-mode-toggle');if(toggle){authMode=authMode==='signup'?'login':'signup';renderGate();return;}
 if(e.target.closest('#reader-inbox-btn')){fxOpenInbox();return;}
 if(e.target.closest('#reader-inbox-close')){$('#reader-inbox-dialog').close();return;}
 if(e.target.closest('#reader-inbox-all')){fxMarkAlerts(null);return;}
 const fxRead=e.target.closest('[data-fx-read]');if(fxRead){fxMarkAlerts(Number(fxRead.dataset.fxRead));return;}
 if(e.target.closest('#reader-logout')){logout();return;}
 if(e.target.closest('#push-enable')){enablePush();return;}
 if(e.target.closest('#push-disable')){disablePush();return;}
 if(e.target.closest('#delete-my-photo')){deleteMyPhoto();return;}
 if(e.target.closest('#birthday-remove')){deleteMyBirthday();return;}
 if(e.target.closest('#notice-ack')){acknowledgeNotice();return;}
 if(e.target.closest('#member-notice-open')){openMemberNotice();return;}
 if(e.target.closest('#member-notice-close')){$('#member-notice-dialog').close();return;}
 if(e.target.closest('#reader-retry,#reader-refresh')){refresh();return;}
 const cal=e.target.closest('[data-calendar-move],[data-calendar-day],[data-calendar-today]');if(cal){if(cal.dataset.calendarMove){calendarMonth=window.FantastiXCalendar.move(calendarMonth,Number(cal.dataset.calendarMove));calendarSelected=calendarMonth+'-01';}else if(cal.hasAttribute('data-calendar-today')){calendarSelected=window.FantastiXCalendar.local(new Date());calendarMonth=calendarSelected.slice(0,7);}else{calendarSelected=cal.dataset.calendarDay;calendarMonth=calendarSelected.slice(0,7);}renderApp();return;}
 const nav=e.target.closest('[data-tab]');if(nav){
 tab=nav.dataset.tab;scrollTo({top:0,behavior:'instant'});
 if(user&&navigator.onLine&&['dashboard','meetings','calendar'].includes(tab)){
  $('#content').innerHTML='<section class="card"><p class="muted">Aktuelle Termine werden geladen …</p></section>';
  refresh();
 } else renderApp();
 return;
 }
 const y=e.target.closest('[data-year]');if(y){year=y.dataset.year;renderApp();return;}
 if(e.target.closest('#close-absence,#cancel-absence')){$('#absence-dialog').close();return;}
 const excursion=e.target.closest('[data-excursion-vote]');if(excursion){if(excursion.dataset.excursionVote==='yes')askYesNote('event',excursion.dataset.excursionId);else voteExcursion(excursion.dataset.excursionId,excursion.dataset.excursionVote);return;}
 const vote=e.target.closest('[data-vote]');if(vote){
   if(vote.dataset.vote==='absent')askAbsenceReason(vote.dataset.meetingId);
   else askYesNote('meeting',vote.dataset.meetingId);
 }
});
$('#notice-dialog').addEventListener('cancel',e=>{e.preventDefault();});
$('#absence-dialog').addEventListener('close',()=>{showNextNotice();});
document.addEventListener('change',e=>{if(e.target.id==='reader-ranking-year'){year=e.target.value;renderApp();return;}if(e.target.matches('.photo-upload-input')&&e.target.files?.[0]){uploadMyPhoto(e.target.files[0]);e.target.value='';}});
navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='fantastix-push-open'&&['dashboard','meetings','calendar'].includes(e.data.tab)){tab=e.data.tab;if(data)renderApp();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&user)refresh();});
setInterval(()=>{if(!document.hidden&&user&&!busy)refresh();},60000);
setInterval(()=>{if(!document.hidden&&user&&profile?.member_id)fxLoadAlerts(true);},45000);
(async()=>{try{await initClient();const {data:auth}=await cloud.auth.getUser();user=auth?.user||null;if(user)await refresh();else renderGate();}catch(e){renderGate('Cloud-Verbindung: '+e.message);}})();
