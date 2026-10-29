function initialPushTab(){if(typeof location==='undefined')return 'dashboard';const requested=new URL(location.href).searchParams.get('tab');return ['dashboard','meetings','calendar','excursions'].includes(requested)?requested:'dashboard';}
const TRANSFER_ACCOUNT={name:'Dominik Winkler',iban:'DE64100110012624836316',display:'DE64 1001 1001 2624 8363 16'};
function transferAccountHTML(){return `<section class="card transfer-account" aria-labelledby="transfer-heading"><h2 id="transfer-heading">Konto für Überweisungen</h2><p class="transfer-owner"><small>Kontoinhaber</small><strong>${esc(TRANSFER_ACCOUNT.name)}</strong></p><div class="transfer-copy-row"><div><small>IBAN</small><code class="transfer-iban">${esc(TRANSFER_ACCOUNT.display)}</code></div><button type="button" class="ghost" data-copy-iban data-action="copy-iban">IBAN kopieren</button></div><p class="transfer-copy-status" role="status" aria-live="polite"></p></section>`;}
async function copyTransferIBAN(button){
 if(!button||button.disabled)return;const panel=button.closest('.transfer-account'),status=panel?.querySelector('.transfer-copy-status');if(!panel||!status)return;
 button.disabled=true;button.textContent='IBAN kopieren';let copied=false;
 try{if(typeof navigator!=='undefined'&&typeof navigator.clipboard?.writeText==='function'){await navigator.clipboard.writeText(TRANSFER_ACCOUNT.iban);copied=true;}}catch{}
 if(!copied){let field;try{if(typeof document.execCommand==='function'){field=document.createElement('textarea');field.value=TRANSFER_ACCOUNT.iban;field.readOnly=true;field.style.position='fixed';field.style.left='-9999px';document.body.appendChild(field);field.select();field.setSelectionRange(0,field.value.length);copied=document.execCommand('copy')===true;}}catch{}finally{field?.remove();}}
 if(panel.isConnected){if(copied){button.textContent='Kopiert ✓';status.textContent='IBAN wurde kopiert.';}else{const iban=panel.querySelector('.transfer-iban');try{const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(iban);selection.removeAllRanges();selection.addRange(range);}catch{}status.textContent='Bitte die markierte IBAN manuell kopieren.';}}
 button.disabled=false;
}
let fineMemberFilter='',fineListLimit=10;
function fineMemberFilterHTML(){
 const ids=[...new Set([...data.members.map(m=>m.id),...data.fines.map(f=>f.memberId)])];
 if(fineMemberFilter&&!ids.includes(fineMemberFilter)){fineMemberFilter='';fineListLimit=10;}
 const name=id=>data.members.find(m=>m.id===id)?.name||'(gelöschtes Mitglied)';
 return `<div class="field fine-filter"><label for="fine-member-filter">Strafen nach Mitglied filtern</label><select id="fine-member-filter"><option value="">Alle Mitglieder</option>${ids.sort((a,b)=>name(a).localeCompare(name(b),'de')).map(id=>`<option value="${esc(id)}" ${fineMemberFilter===id?'selected':''}>${esc(name(id))}</option>`).join('')}</select></div>`;
}
function filteredFineListHTML(items,admin=false){
 const filters=fineMemberFilterHTML(),filtered=orderedFines(items.filter(f=>!fineMemberFilter||f.memberId===fineMemberFilter));
 return filters+compactFineListHTML(filtered.slice(0,fineListLimit),admin)+(filtered.length?`<div class="fine-pagination"><p class="muted tiny">${Math.min(fineListLimit,filtered.length)} von ${filtered.length} Strafen</p>${filtered.length>fineListLimit?'<button type="button" class="ghost" data-fines-more>Mehr laden</button>':''}</div>`:'');
}
function orderedFines(items){return [...items].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.id).localeCompare(String(a.id)));}
function fineListDate(value){const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}.${m[2]}.${m[1]}`:'–';}
function compactFineListHTML(items,admin=false){
 const fines=orderedFines(items);
 if(!fines.length)return '<p class="muted">Keine Strafen für diese Auswahl.</p>';
 return `<div class="fine-table-wrap"><table class="fine-table"><thead><tr><th scope="col">Datum</th><th scope="col">Mitglied</th><th scope="col">Grund</th><th scope="col">Betrag</th><th scope="col">Status</th></tr></thead><tbody>${fines.map(f=>{const open=admin?fineOpen(f):Math.max(0,n(f.amountCents)-data.payments.filter(p=>p.fineId===f.id).reduce((sum,p)=>sum+n(p.amountCents),0));const name=admin?(member(f.memberId)?.name||'(gelöschtes Mitglied)'):memberName(f.memberId);return `<tr data-fine-row="${esc(f.id)}"><td class="fine-date-cell"><time class="fine-date" ${f.date?`datetime="${esc(f.date)}"`:''}>${fineListDate(f.date)}</time></td><td class="fine-member">${esc(name)}</td><td class="fine-reason">${esc(f.reason||'Strafe')}</td><td class="fine-amount"><strong>${money(n(f.amountCents))}</strong></td><td class="fine-status-cell"><span class="fine-status ${open?'is-unpaid':'is-paid'}">${open?'Nicht bezahlt':'Bezahlt'}</span>${admin?`<div class="fine-actions">${open?`<button type="button" class="smallbtn" data-action="fine-pay" data-id="${esc(f.id)}">Kassieren</button>`:''}<button type="button" class="smallbtn" data-action="fine-view" data-id="${esc(f.id)}">Details</button></div>`:''}</td></tr>`;}).join('')}</tbody></table></div>`;
}
function voteStatusSymbol(status){return {present:'👍',yes:'👍',absent:'👎',no:'👎',unsure:'❓'}[status]||'';}
function voteStatusLabel(status){return {present:'Dabei',yes:'Dabei',absent:'Nicht dabei',no:'Nicht dabei',unsure:'Unsicher'}[status]||'Noch keine Antwort';}
function voteStatusHTML(status){const symbol=voteStatusSymbol(status);return symbol?`<span role="img" aria-label="${voteStatusLabel(status)}">${symbol}</span>`:'Noch offen';}
function uiSymbol(name,fallback){return `<span class="ui-symbol" aria-hidden="true">${window.FantastixUI?.icon(name)||esc(fallback)}</span>`;}
// App-Icon: bewusst nur 1 für ungelesen; ohne API bleibt die App unverändert nutzbar.
let fxBadgeQueue=Promise.resolve();
function fxSetIconBadge(unread){
 fxBadgeQueue=fxBadgeQueue.catch(()=>{}).then(async()=>{
  if(typeof navigator==='undefined')return;
  if(unread){if(typeof navigator.setAppBadge==='function')await navigator.setAppBadge(1);}
  else if(typeof navigator.clearAppBadge==='function')await navigator.clearAppBadge();
  else if(typeof navigator.setAppBadge==='function')await navigator.setAppBadge(0);
 }).catch(()=>{});return fxBadgeQueue;
}
let readerEntry=null;
const memberHistoryLimits=new Map();
/* FantastiX 3.15.1 · Einheitliche Anwesenheit, Benutzername + Passwort. */
const $=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=x=>Math.max(0,Number.isFinite(+x)?Math.round(+x):0);
const money=c=>new Intl.NumberFormat('de-AT',{style:'currency',currency:'EUR'}).format((Number(c)||0)/100);
const dateLabel=s=>s?new Date(s+'T12:00:00').toLocaleDateString('de-AT',{day:'2-digit',month:'long',year:'numeric'}):'–';
const timeLabel=s=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s||'')?s:'19:00';
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
let calendarSelected=today(),calendarMonth=calendarSelected.slice(0,7);
const currentYear=()=>today().slice(0,4);
const dateTime=s=>{if(!s)return '–';const dt=new Date(s);return Number.isNaN(dt.valueOf())?'–':dt.toLocaleString('de-AT');};
const deadlineLabel=s=>{if(!s)return '–';return new Intl.DateTimeFormat('de-AT',{timeZone:'Europe/Vienna',weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(s))+' Uhr';};
const empty=msg=>`<section class="card"><p class="muted">${esc(msg)}</p></section>`;
const heading=txt=>`<h1 class="title">${esc(txt)}</h1>`;
let readerUpdates=[],readerPresence={},readerUpdateReads=new Set(),meetingNotes=[],birthdays=[],cloud=null,user=null,profile=null,data=null,deadlines=new Map(),excursionVotes=[],excursionVoteError='',notices=[],noticeQueue=[],noticeAcknowledging=false,avatarUrls={},avatarLoadedAt=0,tab=initialPushTab(),year=currentYear(),lastFetched='',busy=false,authMode='login';
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
 return v&&['present','absent','unsure'].includes(v.status)?v:null;
}
function memberOrder(){return [...(data?.members||[])].sort((a,b)=>(Number(a.memberNumber)||99999)-(Number(b.memberNumber)||99999)||a.name.localeCompare(b.name,'de'));}
function rsvpCounts(m){
 const values=memberOrder().filter(p=>p.active!==false).map(p=>effective(m,p.id));
 return {yes:values.filter(v=>v?.status==='present').length,unsure:values.filter(v=>v?.status==='unsure').length,no:values.filter(v=>v?.status==='absent').length,open:values.filter(v=>!v).length};
}
function avatarFor(id){const url=avatarUrls[id];return url?`<img class="member-photo" data-profile-photo tabindex="0" role="button" aria-label="Profilbild von ${esc(memberName(id))} vergrößern" src="${esc(url)}" alt="${esc(memberName(id))}" loading="lazy">`:`<span class="member-photo member-photo-placeholder">${esc((memberName(id)||'?').trim().slice(0,1).toUpperCase())}</span>`;}
async function loadAvatars(force=false){
 if(!cloud||!user||!profile?.member_id||(!force&&Date.now()-avatarLoadedAt<5*60*1000))return;
 const avatarUser=user.id;
 const {data:rows,error}=await cloud.rpc('fantastix_avatar_directory');if(error)throw error;
 const result={};
 await Promise.all((rows||[]).map(async row=>{const signed=await cloud.storage.from('fantastix-avatars').createSignedUrl(row.object_name,3600);if(!signed.error&&signed.data?.signedUrl)result[row.member_id]=signed.data.signedUrl;}));
 if(user?.id!==avatarUser)return;avatarUrls=result;avatarLoadedAt=Date.now();
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
function meetingNote(id,memberId){return meetingNotes.find(x=>x.meeting_id===id&&x.member_id===memberId)?.note||"";}
function meetingNoteDisplay(m,memberId){const saved=meetingNotes.find(x=>x.meeting_id===m.id&&x.member_id===memberId);return saved?String(saved.note||''):(['present','unsure'].includes(effective(m,memberId)?.status)?effective(m,memberId)?.note||'':'');}
function rsvpRoster(m){
 if(!section('members'))return '';
 const count=rsvpCounts(m);
 return `<div class="attendee-block"><div class="roster-header"><strong>${m.date<=today()?'Anwesenheit':'Abstimmungsstand'}</strong><small>${readerCountSummary(count)}</small></div>
 <div class="roster-list">${memberOrder().filter(p=>p.active!==false||effective(m,p.id)).map(p=>{
 const a=effective(m,p.id),note=['present','unsure'].includes(a?.status)?meetingNoteDisplay(m,p.id):'';
 return `<div class="roster-row"><div class="roster-name">${avatarFor(p.id)} <span class="roster-name-text">${esc(p.name)}${a?.status==='absent'&&section('absences')?`<small class="absence-reason">Grund: ${esc(a.reason||'Keine Angabe aus älterem Datenstand')}</small>`:''}</span></div>
 <div class="roster-right"><span class="chip ${!a?'gray':a.status==='present'?'yes-chip':a.status==='unsure'?'gray':'no-chip'}">${voteStatusHTML(a?.status)}</span>${a?.updatedAt?`<small class="vote-stamp">Abgestimmt: ${esc(voteTime(a.updatedAt))}</small>`:''}${note?`<small class="meeting-note-visible">📝 ${esc(note)}</small>`:''}</div></div>`;
 }).join('')}</div></div>`;
}

function tripOrganizers(x){const names=(x.organizerIds||[]).map(memberName).filter(Boolean);if(String(x.organizerOther||'').trim())names.push(x.organizerOther.trim());return names.length?names.join(', '):'Noch offen';}
function tripDateLabel(x){return !x.date?'Termin offen':x.endDate&&x.endDate!==x.date?`${dateLabel(x.date)} – ${dateLabel(x.endDate)}`:dateLabel(x.date);}
function tripLastDate(x){return x.endDate||x.date||'';}
function nextTrip(){return [...(data?.excursions||[])].filter(x=>!x.completed&&(!x.date||tripLastDate(x)>=today())).sort((a,b)=>Number(!a.date)-Number(!b.date)||String(a.date||'').localeCompare(String(b.date||''))||a.title.localeCompare(b.title,'de'))[0]||null;}
function excursionOwn(x){return excursionVotes.find(v=>v.excursion_id===x.id&&v.member_id===profile?.member_id);}
function excursionCount(id){const votes=excursionVotes.filter(v=>v.excursion_id===id);return {yes:votes.filter(v=>v.status==='yes').length,unsure:votes.filter(v=>v.status==='unsure').length,no:votes.filter(v=>v.status==='no').length,open:data.members.filter(m=>m.active!==false&&!votes.some(v=>v.member_id===m.id)).length};}
function excursionRoster(x){return `<div class="attendee-block"><div class="roster-header"><strong>Rückmeldungen</strong><small>${readerCountSummary(excursionCount(x.id))}</small></div><div class="roster-list">${memberOrder().filter(m=>m.active!==false||excursionVotes.some(v=>v.excursion_id===x.id&&v.member_id===m.id)).map(m=>{const v=excursionVotes.find(v=>v.excursion_id===x.id&&v.member_id===m.id);return `<div class="roster-row"><span class="roster-name">${avatarFor(m.id)} <span class="roster-name-text">${esc(m.name)}</span></span><span class="chip ${v?.status==='yes'?'yes-chip':v?.status==='no'?'no-chip':v?.status==='unsure'?'gray':'gray'}">${voteStatusHTML(v?.status)}</span>${v?.updated_at?`<small class="vote-stamp">Abgestimmt: ${esc(voteTime(v.updated_at))}</small>`:''}${v?.admin_locked?'<small class="muted">Admin-Korrektur</small>':''}</div>`}).join('')}</div></div>`;}
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
function renderApp(){
 if(!data||!profile?.member_id)return renderGate();
 $('#auth-gate').hidden=true;$('#reader-app').hidden=false;
 const tabs=[['dashboard','Start','⌂',true],['meetings','Stammtisch','▣',section('meetings')],['excursions','Events','✈',section('excursions')],['calendar','Kalender','▦',section('meetings')||section('excursions')||section('members')],['ranking','Rangliste','★',section('members')],['members','Mitglieder','♙',section('members')],['cash','Kassa','€',section('cash')||section('fines')]].filter(t=>t[3]);
 if(!tabs.some(t=>t[0]===tab))tab='dashboard';
 $('#tabs').style?.setProperty('--nav-count',tabs.length);$('#tabs').innerHTML=tabs.map(([id,label,icon])=>`<button class="navbutton ${tab===id?'active':''}" data-tab="${id}" aria-label="${label}"><span class="tab-icon">${window.FantastixUI?.icon(id==='dashboard'?'home':id==='cash'?'fines':id)||esc(icon)}</span><span>${esc(label)}</span></button>`).join('');
 $('#content').innerHTML=(readerInboxOpen?readerInbox():'')+({dashboard,meetings,excursions,calendar:calendarPage,ranking,members,cash}[tab])();
 const bell=$('#reader-bell');if(bell){const count=readerUpdates.filter(x=>!readerUpdateReads.has(x.id)).length;bell.innerHTML=readerBellIcon()+(count?`<b>${count}</b>`:'');}
 $('#updated').textContent='Stand: '+dateTime(lastFetched||data.publishedAt);
 showPushOptIn();
}
function voteTimeRemaining(deadline,now=Date.now()){
 const end=Number(deadline);if(deadline===null||deadline===''||!Number.isFinite(end))return 'Abstimmungsfrist nicht verfügbar.';
 if(end<=now)return 'Abstimmung geschlossen.';
 let minutes=Math.ceil((end-now)/60000);
 const days=Math.floor(minutes/1440);minutes%=1440;
 const hours=Math.floor(minutes/60);minutes%=60;
 const parts=[];if(days)parts.push(`${days} ${days===1?'Tag':'Tage'}`);if(hours)parts.push(`${hours} Std.`);if(minutes)parts.push(`${minutes} Min.`);
 return `Noch ${parts.join(' ')} abstimmen`;
}
function voteCountdownHTML(deadline){return `<p class="hint vote-countdown" data-vote-deadline="${deadline??''}">${voteTimeRemaining(deadline)}</p>`;}
function refreshVoteCountdowns(){for(const el of document.querySelectorAll('[data-vote-deadline]'))el.textContent=voteTimeRemaining(el.dataset.voteDeadline);}
function dashboardAttendanceHTML(m){
 const yes=memberOrder().filter(p=>p.active!==false&&effective(m,p.id)?.status==='present'),c=rsvpCounts(m);
 return `<div class="rsvp-preview"><div class="rsvp-faces">${yes.slice(0,8).map(p=>avatarFor(p.id)).join('')}${yes.length>8?`<span class="rsvp-more">+${yes.length-8}</span>`:''}</div>${readerCountSummary(c)}</div>`;
}
function dashboard(){
 const completed=data.meetings.filter(m=>m.date<today()).sort((a,b)=>b.date.localeCompare(a.date));
 const next=[...data.meetings].filter(m=>m.date>=today()).sort((a,b)=>a.date.localeCompare(b.date))[0];
 const days=next?daysUntil(next.date):null;
 const yr=section('members')?leaders(currentYear()):[],all=section('members')?leaders(null):[];
 const pending=section('fines')?data.fines.reduce((s,f)=>s+n(f.amountCents),0)-data.payments.reduce((s,p)=>s+n(p.amountCents),0):null;
 const leaderHTML=lst=>lst.length?`<div class="leader-list">${lst.map(m=>`<span>${esc(m.name)}</span>`).join('')}</div><small>${lst[0].count} Teilnahmen</small>`:'<div class="value">–</div>';
 return `${heading('Dashboard')}<div class="metric-grid dashboard-v36">
  <div class="metric beer-countdown ${days===0?'beer-today':''}">${days===0?'<div class="value">Heute gibt es Lecker Bierchen! 🍺</div>':`<small>Lecker Bierchen <span class="beer-symbol" aria-hidden="true">🍺</span></small><div class="value">${days===null?'–':days===1?'1 Tag':days+' Tage'}</div><small>bis zum nächsten Stammtisch</small>`}</div>
  <div class="metric"><small>Kontostand ${uiSymbol('fines','💰')}</small><div class="value balance-tile">${section('cash')?money(data.cashbook?.balanceCents):'–'}</div><small>Offene Strafen: ${pending!==null?money(Math.max(0,pending)):'–'}</small></div>
  <div class="metric"><small>Ewige Rangliste ${uiSymbol('crown','👑')}</small>${leaderHTML(all)}</div>
  <div class="metric"><small>Jahresführung ${currentYear()}</small>${leaderHTML(yr)}</div>
 </div>
 <section class="card next-card"><div class="row"><h2>Nächster Stammtisch</h2>${next?termStatusHTML(days===0?'Heute':'Geplant'):'<span class="chip gray">Nicht geplant</span>'}</div>
 ${next?`<strong class="next-date">${dateLabel(next.date)}</strong><p class="next-place">${esc(next.location||'Gasthaus noch offen')} · ${esc(timeLabel(next.time))} Uhr</p>${voteCountdownHTML(deadlines.has(next.id)?new Date(deadlines.get(next.id)).getTime():null)}<p class="muted tiny">Organisator: ${esc(memberName(next.organizerId))}</p>${section('members')?`${dashboardAttendanceHTML(next)}`:``}<button type="button" class="button dashboard-open" data-reader-meeting="${esc(next.id)}">Stammtisch öffnen →</button>`:'<p class="muted">Noch kein nächster Stammtisch eingetragen.</p>'}</section>
 <section class="card"><h2>Letzte 3 Stammtische</h2>${completed.slice(0,3).length?completed.slice(0,3).map(m=>`<div class="item"><div class="avatar">${esc(m.date.slice(-2))}</div><div class="details"><strong>${dateLabel(m.date)}</strong><small>${esc(m.location||'Ohne Gasthaus')} · ${data.members.filter(p=>effective(m,p.id)?.status==='present').length} anwesend</small></div></div>`).join(''):'<p class="muted">Noch keine Stammtische.</p>'}</section>
 ${section('excursions')?`<section class="card excursion-preview"><div class="row"><h2>Nächster Event</h2>${nextTrip()?termStatusHTML(eventStatus(nextTrip())):'<span class="chip gray">Nicht geplant</span>'}</div>${nextTrip()?`<strong class="excursion-title">${esc(nextTrip().title)}</strong><p class="event-date">${tripDateLabel(nextTrip())}</p><p class="event-organizer">Organisatoren: ${esc(tripOrganizers(nextTrip()))}</p><button class="ghost" data-reader-excursion="${esc(nextTrip().id)}" type="button">Öffnen →</button>`:'<p class="muted">Noch kein Event geplant.</p>'}</section>`:''}
 ${strongestStreakHTML()}${pushPromptHTML()}`;
}
function votePanel(m,compact=false){
 if(!profile?.member_id||!section('meetings'))return '';
 const own=effective(m,profile.member_id);
 const locked=false; // Admin-Korrekturen sperren Mitglieder nicht vor Fristablauf
 const deadline=deadlines.get(m.id),closed=deadline?Date.now()>=new Date(deadline).getTime():true;
 const status=own?.status||'';
 const summary=closed?'Abstimmung geschlossen':`Frist: ${deadlineLabel(deadline)}`;
 return `<div class="vote-panel ${compact?'compact':''}"><div class="vote-header"><strong>Deine Teilnahme</strong><span class="chip ${locked||closed?'gray':''}">${esc(summary)}</span></div>
 <div class="vote-actions">${[['present','👍','Dabei','yes'],['unsure','❓','Unsicher','unsure'],['absent','👎','Nicht dabei','no']].map(([value,emoji,label,tone])=>`<button type="button" class="vote-btn ${status===value?'selected '+tone:''}" data-vote="${value}" data-meeting-id="${esc(m.id)}" aria-label="${label}" title="${label}" aria-pressed="${status===value}" ${locked||closed||busy?'disabled':''}>${emoji}</button>`).join('')}</div>
 ${['present','unsure'].includes(status)&&!locked&&!closed?`<div class="meeting-note-editor"><label class="note-input-label" for="meeting-note-${esc(m.id)}">Notiz hinzufügen (optional)</label><div class="meeting-note-fields"><input id="meeting-note-${esc(m.id)}" class="meeting-note-input" data-meeting-note="${esc(m.id)}" maxlength="160" value="${esc(meetingNoteDisplay(m,profile.member_id))}" placeholder="z. B. Komme etwas später"><button type="button" class="smallbtn" data-save-meeting-note="${esc(m.id)}" ${busy?'disabled':''}>Speichern</button></div></div>`:''}
 ${status?`<small class="muted">${voteStatusHTML(status)}${status==='absent'&&section('absences')&&own.reason?' · '+esc(own.reason):''}</small>`:'<small class="muted">Noch offen</small>'}</div>`;
}
function coalesceSource(a){return a.source||'admin';}
function readerEntryBack(label){return `<button type="button" class="smallbtn reader-entry-back" data-reader-back>← ${readerEntry?.from==='dashboard'?'Zum Dashboard':'Zurück zu '+label}</button>`;}
function readerCountSummary(count){return `<span class="reader-counts"><span role="img" aria-label="${count.yes} Zusagen">👍 ${count.yes}</span><span role="img" aria-label="${count.no} Absagen">👎 ${count.no}</span><span role="img" aria-label="${count.unsure||0} unsicher">❓ ${count.unsure||0}</span></span>`;}
function meetings(){
 if(!section('meetings'))return empty('Stammtische sind nicht freigegeben.');
 if(readerEntry?.kind==='meeting'&&data.meetings.some(m=>m.id===readerEntry.id))return meetingDetails(readerEntry.id);
 const items=[...data.meetings].sort((a,b)=>b.date.localeCompare(a.date));
 return `${heading('Stammtische')}<section class="card reader-entry-list">${items.map(m=>`<button type="button" class="reader-entry" data-reader-meeting="${esc(m.id)}" aria-label="Stammtisch am ${esc(dateLabel(m.date))} öffnen"><span class="reader-entry-info"><strong>${dateLabel(m.date)} · ${esc(timeLabel(m.time))} Uhr</strong><span>${esc(m.location||'Gasthaus noch offen')}</span>${section('members')?`<small>Organisator: ${esc(memberName(m.organizerId))}</small>${readerCountSummary(rsvpCounts(m))}`:''}</span><span class="reader-entry-end">${termStatusHTML(m.date===today()?'Heute':m.date>today()?'Geplant':'Vergangen')}<span>Öffnen ›</span></span></button>`).join('')||'<p class="muted">Noch keine Stammtische.</p>'}</section>`;
}
function termStatusHTML(label){const kind={'Heute':'today','Geplant':'planned','Vergangen':'past','Abgeschlossen':'closed','Läuft':'live','In Planung':'draft'}[label]||'draft';return `<span class="chip meeting-status status-${kind}">${esc(label)}</span>`;}
function eventIsPast(x){return !!x.completed||!!(x.endDate||x.date)&&(x.endDate||x.date)<today();}
function eventStatus(x){if(x.completed)return 'Abgeschlossen';if(eventIsPast(x))return 'Vergangen';if(!x.date)return 'In Planung';if(x.date>today())return 'Geplant';if(x.endDate&&x.endDate>x.date)return 'Läuft';return x.date===today()?'Heute':'Vergangen';}
function excursions(){
 if(!section('excursions'))return empty('Events sind nicht freigegeben.');
 if(readerEntry?.kind==='excursion'&&(data.excursions||[]).some(x=>x.id===readerEntry.id))return excursionDetails(readerEntry.id);
 const items=[...(data.excursions||[])].sort((a,b)=>Number(!!a.completed)-Number(!!b.completed)||Number(!a.date)-Number(!b.date)||String(a.date||'').localeCompare(String(b.date||''))||a.title.localeCompare(b.title,'de'));
 return `${heading('Events')}${excursionVoteError?`<div class="notice warning">${esc(excursionVoteError)}</div>`:''}<section class="card reader-entry-list">${items.map(x=>`<button type="button" class="reader-entry" data-reader-excursion="${esc(x.id)}" aria-label="Event ${esc(x.title)} öffnen"><span class="reader-entry-info"><strong>${esc(x.title)}</strong><span>${tripDateLabel(x)}${x.location?' · '+esc(x.location):''}</span><small>Organisatoren: ${esc(tripOrganizers(x))}</small>${readerCountSummary(excursionCount(x.id))}</span><span class="reader-entry-end">${termStatusHTML(eventStatus(x))}<span>Öffnen ›</span></span></button>`).join('')||'<p class="muted">Noch keine Events eingetragen.</p>'}</section>`;
}
function openReaderEntry(kind,id){
 const target=kind==='member'?'members':kind==='meeting'?'meetings':'excursions';
 if(!section(target)||!(data?.[target]||[]).some(x=>x.id===id))return;
 if(kind==='member')memberHistoryLimits.set(id,10);
 readerEntry={kind,id,from:tab};tab=target;
 renderApp();scrollTo({top:0,behavior:'instant'});
 document.querySelector('#content .title')?.setAttribute('tabindex','-1');
 document.querySelector('#content .title')?.focus();
}
function meetingDetails(id){
 if(!section('meetings'))return empty('Stammtische sind nicht freigegeben.');
 const items=data.meetings.filter(m=>m.id===id);
 return `${readerEntryBack('Stammtische')}${heading('Stammtisch')}${items.length?items.map(m=>`<section class="card meeting-card">
 <div class="row"><h2>${dateLabel(m.date)}</h2>${termStatusHTML(m.date===today()?'Heute':m.date>today()?'Geplant':'Vergangen')}</div>
 <p>${esc(m.location||'Gasthaus offen')} · ${esc(timeLabel(m.time))} Uhr</p>
 ${section('members')?`<p class="muted tiny">Organisator: ${esc(memberName(m.organizerId))}</p>`:''}
 ${votePanel(m)}
 ${rsvpRoster(m)}
 
 ${section('absences')&&m.notes?`<p class="hint">${esc(m.notes)}</p>`:''}
 </section>`).join(''):empty('Noch keine Stammtische.')}`;
}

function calendarPage(){const shown={meetings:section('meetings')?data.meetings:[],excursions:section('excursions')?data.excursions:[],birthdays:section('members')?birthdays.map(b=>({...b,name:memberName(b.member_id)})):[]};return `${heading('Kalender')}${window.FantastiXCalendar.render(shown,calendarMonth,calendarSelected,false)}`;}
function excursionDetails(id){
 if(!section('excursions'))return empty('Events sind nicht freigegeben.');
 const sorted=(data.excursions||[]).filter(x=>x.id===id).sort((a,b)=>Number(!!a.completed)-Number(!!b.completed)||Number(!a.date)-Number(!b.date)||String(a.date||'').localeCompare(String(b.date||''))||a.title.localeCompare(b.title,'de'));
 return `${readerEntryBack('Events')}${heading('Event')}${excursionVoteError?`<div class="notice warning">${esc(excursionVoteError)}</div>`:''}
 ${sorted.length?sorted.map(x=>{const own=excursionOwn(x),completed=x.completed||(x.date&&tripLastDate(x)<today());return `<section class="card excursion-card"><div class="row"><h2>${esc(x.title)}</h2>${termStatusHTML(eventStatus(x))}</div>
 <p class="muted">${tripDateLabel(x)}</p>${x.location?`<p><strong>${esc(x.location)}</strong></p>`:''}${x.notes?`<p class="muted">${esc(x.notes)}</p>`:''}<p class="muted tiny">Organisatoren: ${esc(tripOrganizers(x))}</p>
 <div class="vote-panel"><div class="vote-header"><strong>Meine Rückmeldung</strong><span class="chip ${own?.status==='yes'?'yes-chip':own?.status==='no'?'no-chip':own?.status==='unsure'?'gray':'gray'}">${voteStatusHTML(own?.status)}</span></div>
 <div class="vote-actions">${[['yes','👍','Dabei','yes'],['unsure','❓','Unsicher','unsure'],['no','👎','Nicht dabei','no']].map(([value,emoji,label,tone])=>`<button type="button" class="vote-btn ${own?.status===value?'selected '+tone:''}" data-excursion-vote="${value}" data-excursion-id="${esc(x.id)}" aria-label="${label}" title="${label}" aria-pressed="${own?.status===value}" ${completed||busy||!!excursionVoteError?'disabled':''}>${emoji}</button>`).join('')}</div>
 <small class="muted">${'Unverbindliche Planung · Keine Auswirkung auf die Rangliste oder Strafen'}</small></div>${excursionRoster(x)}</section>`}).join(''):empty('Noch keine Events eingetragen.')}`;
}
function ranking(){
 if(!section('members'))return empty('Ranglisten sind nicht freigegeben.');
 const nowYear=Number(currentYear());const years=[...new Set([...Array.from({length:Math.max(1,nowYear-2026+1)},(_,i)=>String(2026+i)),...data.meetings.map(m=>m.date.slice(0,4))])].filter(y=>/^\d{4}$/.test(y)).sort().reverse();
 return `${heading('Ranglisten')}<div class="card"><div class="ranking-filters" role="group" aria-label="Rangliste auswählen">${[['all','Ewige Rangliste'],...years.map(y=>[y,y])].map(([value,label])=>`<button type="button" class="ranking-filter ${year===value?'is-active':''}" data-year="${value}" aria-pressed="${year===value}">${label}</button>`).join('')}</div><div class="separator"></div><div class="tablewrap"><table class="table"><thead><tr><th>Platz</th><th>Mitglied</th><th>Teilnahmen</th></tr></thead><tbody>${ranks(year==='all'?null:year).map((m,i)=>`<tr><td>${i+1}.</td><td>${esc(m.name)}</td><td><strong>${m.count}</strong></td></tr>`).join('')}</tbody></table></div></div>`;
}

function myBirthday(){return birthdays.find(b=>b.member_id===profile?.member_id);}
function birthdayText(b){return b?`${String(b.day).padStart(2,'0')}.${String(b.month).padStart(2,'0')}.`:'Nicht eingetragen';}
async function loadBirthdays(){
 if(!cloud||!user||!profile?.member_id)return;
 const birthdayUser=user.id;
 const {data:rows,error}=await cloud.from('fantastix_birthdays').select('member_id,month,day');
 if(error)throw error;
 if(user?.id===birthdayUser)birthdays=rows||[];
}
function lastSeenReader(id){const v=readerPresence[id];if(!v)return 'Noch keine Aktivität';const t=new Date(v);if(Date.now()-t.getTime()<180000)return '🟢 Gerade online';return 'Zuletzt online: '+t.toLocaleString('de-AT',{dateStyle:'short',timeStyle:'short'});}
async function refreshReaderExtras(){
 if(!cloud||!user||!profile?.member_id)return;const badgeUser=user.id;
 try{await cloud.rpc('fantastix_touch_presence');const p=await cloud.from('fantastix_activity').select('member_id,last_seen_at');if(!p.error&&user?.id===badgeUser)readerPresence=Object.fromEntries((p.data||[]).map(x=>[x.member_id,x.last_seen_at]));}catch(e){console.warn('Online-Status SQL 20:',e.message);}
 try{
  const r=await cloud.from('fantastix_updates').select('id,kind,title,body,created_at').neq('kind','vote').order('created_at',{ascending:false}).limit(100);if(r.error)throw r.error;
  const updates=r.data||[],ids=updates.map(x=>x.id);let reads=new Set();
  if(ids.length){const q=await cloud.from('fantastix_update_reads').select('update_id').in('update_id',ids).eq('user_id',badgeUser);if(q.error)throw q.error;reads=new Set((q.data||[]).map(x=>x.update_id));}
  if(user?.id!==badgeUser)return;readerUpdates=updates;readerUpdateReads=reads;
  const unread=readerUpdates.filter(x=>!readerUpdateReads.has(x.id)).length;
  const bell=$('#reader-bell');if(bell)bell.innerHTML=readerBellIcon()+(unread?' <b>'+unread+'</b>':'');fxSetIconBadge(unread>0);
 }catch(e){console.warn('Benachrichtigungen SQL 20:',e.message);}
}
function readerBellIcon(){return window.FantastixUI?.icon('bell')||'🔔';}
function readerBell(){const unread=readerUpdates.filter(x=>!readerUpdateReads.has(x.id)).length;return `<button type="button" id="reader-bell" class="reader-bell" aria-label="Benachrichtigungen">${readerBellIcon()} ${unread?`<b>${unread}</b>`:''}</button>`;}
function readerInbox(){
 function noticeText(x){
  const labels={vote:'Abstimmung',organizer_vote:'Abstimmung zu deinem Termin',organizer_assignment:'Organisator-Zuweisung',fine:'Strafe',paid:'Bezahlte Strafe',vote_reminder:'Abstimmungserinnerung',created:'Neuer Termin',schedule:'Terminänderung',location:'Ortsänderung',deleted:'Termin entfernt',announcement:'Nachricht'};
  const label=labels[x.kind]||'Hinweis',body=String(x.body||'').trim(),title=String(x.title||'Benachrichtigung');
  if(!body)return {label,body:'Du hast eine neue Benachrichtigung erhalten.'};
  if(/[.!?]$/.test(body))return {label,body};
  if(x.kind==='fine')return {label,body:`Du hast eine neue Strafe erhalten. Grund: ${body}.`};
  if(x.kind==='paid')return {label,body:`Deine Strafe wegen „${body}“ wurde vollständig bezahlt.`};
  if(['vote','organizer_vote'].includes(x.kind)&&body.includes(' · ')){
   const [who,...details]=body.split(' · '),action=/zusage/i.test(title)?'zugesagt':/absage/i.test(title)?'abgesagt':'abgestimmt';
   return {label,body:`${who} hat für ${/event/i.test(title)?'das Event':'den Stammtisch'} ${details.join(' · ')} ${action}.`};
  }
  return {label,body:`Zu „${title}“: ${body}.`};
 }
 const unread=readerUpdates.filter(x=>!readerUpdateReads.has(x.id)).length;
 return `<section class="card fx-reader-inbox fx-inbox-content"><div class="fx-inbox-head"><h2>🔔 Benachrichtigungen</h2><button type="button" class="smallbtn" id="reader-inbox-close">Schließen</button></div><div class="fx-inbox-summary"><span>${unread} ungelesen · ${readerUpdates.length} Meldungen</span><button type="button" class="smallbtn" id="reader-read-all" ${!unread||readerReadBusy?'disabled':''}>Alle als gelesen markieren</button></div>${[...readerUpdates].sort((a,b)=>(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0)).map(x=>{const isRead=readerUpdateReads.has(x.id);return `<article class="fx-inbox-item ${isRead?'':'unread'}"><div class="fx-inbox-item-top"><span class="fx-type">${esc(noticeText(x).label)}</span>${isRead?'':'<span class="fx-unread-dot" aria-label="Ungelesen"></span>'}</div><strong>${esc(x.title)}</strong><p>${esc(noticeText(x).body)}</p><div class="fx-inbox-item-bottom"><small>${dateTime(x.created_at)}</small>${isRead?'<small>Gelesen</small>':`<button type="button" class="smallbtn" data-reader-read="${esc(x.id)}" ${readerReadBusy?'disabled':''}>Gelesen</button>`}</div></article>`;}).join('')||'<p class="muted">Noch keine Benachrichtigungen.</p>'}</section>`;
}
let readerInboxOpen=false,readerReadBusy=false;
async function readerMarkRead(ids){
 if(readerReadBusy||!cloud||!user?.id)return;
 const selected=[...new Set(ids)].filter(id=>readerUpdates.some(x=>x.id===id)&&!readerUpdateReads.has(id));
 if(!selected.length)return;
 const userId=user.id;
 readerReadBusy=true;renderApp();
 try{
  const {error}=await cloud.from('fantastix_update_reads').upsert(selected.map(update_id=>({update_id,user_id:userId})),{onConflict:'update_id,user_id'});
  if(error)throw error;
  if(user?.id===userId){selected.forEach(id=>readerUpdateReads.add(id));fxSetIconBadge(readerUpdates.some(x=>!readerUpdateReads.has(x.id)));}
 }catch(e){if(user?.id===userId)alert('Nachricht konnte nicht als gelesen markiert werden: '+(e.message||String(e)));}
 finally{readerReadBusy=false;if(user?.id===userId)renderApp();}
}
async function readerReadOne(id){const message=readerUpdates.find(x=>String(x.id)===String(id));if(message)await readerMarkRead([message.id]);}
async function readerReadAll(){await readerMarkRead(readerUpdates.filter(x=>!readerUpdateReads.has(x.id)).map(x=>x.id));}

function pastSeriesMeetings(){return data.meetings.filter(m=>m.date<=today()).sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)));}
function currentStreak(id){let total=0;for(const m of pastSeriesMeetings()){if(effective(m,id)?.status!=='present')break;total++;}return total;}
function strongestStreakHTML(){
 if(!section('members')||!section('meetings'))return `<section class="card streak-card"><h2>Stärkste Stammtischserie ${uiSymbol('flame','🔥')}</h2><p class="muted">Mitglieder und Stammtische sind dafür nicht freigegeben.</p></section>`;
 const rows=data.members.filter(m=>m.active!==false).map(m=>({...m,streak:currentStreak(m.id)}));
 const best=Math.max(0,...rows.map(m=>m.streak)),leaders=rows.filter(m=>m.streak===best).sort((a,b)=>a.name.localeCompare(b.name,'de'));
 return `<section class="card streak-card"><h2>Stärkste Stammtischserie ${uiSymbol('flame','🔥')}</h2><div class="streak-value">${best}</div><p class="muted tiny">Stammtische in Folge</p>${best?`<div class="leader-list">${leaders.map(m=>`<span>${esc(m.name)}</span>`).join('')}</div>`:'<p class="muted">Aktuell führt kein Mitglied eine Serie.</p>'}</section>`;
}
function memberDetails(id){
 if(!section('members'))return empty('Mitglieder sind nicht freigegeben.');
 const m=data.members.find(m=>m.id===id);if(!m)return empty('Mitglied nicht mehr vorhanden.');
 const balance=section('fines')?readerFineBalances().find(m=>m.id===id):null;
 const all=section('meetings')?pastSeriesMeetings():[],recent=all.slice(0,memberHistoryLimits.get(id)||10);
 return `${readerEntryBack('Mitglieder')}${heading(m.name)}<section class="card">${avatarFor(m.id)}<p class="muted tiny">${m.memberNumber?'Nr. '+esc(m.memberNumber)+' · ':''}${m.active===false?'Archiviertes Mitglied':'Aktives Mitglied'}</p><p class="muted tiny">${currentYear()}: ${count(m,currentYear())} Teilnahmen · Ewig: ${count(m,null)} Teilnahmen</p><p class="muted tiny">${esc(lastSeenReader(m.id))}</p><div class="member-summary"><div class="metric"><small>Aktuelle Stammtischserie ${uiSymbol('flame','🔥')}</small><div class="value">${section('meetings')?currentStreak(id):'–'}</div><small>${section('meetings')?'Stammtische in Folge':'Stammtische nicht freigegeben'}</small></div><div class="metric"><small>Offene Strafen</small><div class="value">${balance?.count??'–'}</div><small>${balance?money(balance.amount)+' offen':'Strafen nicht freigegeben'}</small></div></div></section><section class="card"><h2>Stammtisch-Historie</h2><p class="muted tiny">${recent.length} von ${all.length} Stammtischen</p><div class="list member-history">${recent.map(meeting=>{const status=effective(meeting,id)?.status;return `<div class="item"><div class="details"><strong>${dateLabel(meeting.date)}</strong><small>${esc(meeting.location||'Ohne Gasthaus')}</small></div><span class="chip ${status==='present'?'yes-chip':status==='absent'?'no-chip':'gray'}">${voteStatusSymbol(status)?voteStatusHTML(status):'Nicht erfasst'}</span></div>`;}).join('')||`<p class="muted">${section('meetings')?'Noch keine vergangenen Stammtische.':'Stammtische sind nicht freigegeben.'}</p>`}</div>${recent.length<all.length?`<button type="button" class="ghost history-more" data-member-history-more="${esc(id)}">Mehr laden</button>`:''}</section>`;
}
function members(){
 if(!section('members'))return empty('Mitglieder sind nicht freigegeben.');
 if(readerEntry?.kind==='member'&&data.members.some(m=>m.id===readerEntry.id))return memberDetails(readerEntry.id);
 return `${heading('Mitglieder')}<section class="card"><div class="my-photo-card">${avatarFor(profile.member_id)}<div><strong>Mein Profilfoto</strong><label class="photo-upload-btn">Foto wählen<input class="photo-upload-input" type="file" accept="image/*" hidden></label>${avatarUrls[profile.member_id]?'<button type="button" class="smallbtn" id="delete-my-photo">Entfernen</button>':''}</div></div><details class="account-tools"><summary>Mein Konto</summary><form id="reader-password-form" class="stack"><div class="field"><label>Neues Passwort</label><input name="newPassword" type="password" autocomplete="new-password" minlength="8" required></div><div class="field"><label>Passwort wiederholen</label><input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required></div><button type="submit" class="ghost">Passwort ändern</button></form><button type="button" class="danger-btn" id="reader-logout">Abmelden</button></details></section><section class="card"><div class="list">${[...data.members].sort((a,b)=>(a.memberNumber??99999)-(b.memberNumber??99999)).map(m=>`<div class="reader-entry member-list-row">${avatarFor(m.id)}<button type="button" class="member-open" data-reader-member="${esc(m.id)}"><span class="reader-entry-info member-entry-info"><strong>${m.memberNumber!=null?'Nr. '+esc(m.memberNumber)+' · ':''}${esc(m.name)}</strong><small class="fx-last-seen">${esc(lastSeenReader(m.id))}</small></span><span class="reader-entry-end">Öffnen ›</span></button></div>`).join('')||'<p>Keine Mitglieder</p>'}</div></section><section class="card"><h2>Nachricht an alle</h2><p class="muted tiny">Deine Nachricht erscheint bei allen freigeschalteten Mitgliedern einmal als Pop-up. Dein Name steht als Absender dabei. Maximal 3 Nachrichten innerhalb von 24 Stunden.</p><button class="ghost" id="member-notice-open" type="button">+ Pop-up-Nachricht senden</button></section>`;
}
function readerFineBalances(){
 const paid=new Map(),totals=new Map();
 for(const p of data.payments)paid.set(p.fineId,(paid.get(p.fineId)||0)+n(p.amountCents));
 for(const fine of data.fines){
  const open=Math.max(0,n(fine.amountCents)-(paid.get(fine.id)||0));
  const total=totals.get(fine.memberId)||{amount:0,count:0};
  total.amount+=open;if(open>0)total.count++;totals.set(fine.memberId,total);
 }
 return data.members.map(m=>({...m,...(totals.get(m.id)||{amount:0,count:0})})).sort((a,b)=>b.amount-a.amount||a.name.localeCompare(b.name,'de'));
}
function readerFineBalancesHTML(){
 return `<section class="card"><h2>Offene Strafen pro Mitglied</h2><div class="list">${readerFineBalances().map(m=>`<div class="item"><div class="details"><strong>${esc(m.name)}</strong><small>${m.count} offene ${m.count===1?'Strafe':'Strafen'}</small></div><strong class="${m.amount?'red':'muted'}">${money(m.amount)}</strong></div>`).join('')||'<p class="muted">Keine Mitglieder vorhanden.</p>'}</div></section>`;
}
function cash(){
 if(!section('cash')&&!section('fines'))return empty('Kassa ist nicht freigegeben.');
 const c=data.cashbook||{},fined=data.fines.reduce((s,f)=>s+n(f.amountCents),0),paid=data.payments.reduce((s,p)=>s+n(p.amountCents),0);
 return `${heading('Kassa')}${section('cash')?`<div class="cash-hero"><span>Kontostand</span><div class="cash-balance">${money(c.balanceCents)}</div></div><section class="card"><h2>Kassenbuch</h2><div class="list">${(c.transactions||[]).map(t=>`<div class="item"><div class="details"><strong>${esc(t.type==='expense'?'Ausgabe':t.type==='monthly'?'Monatsbeitrag':t.type==='adjustment'?'Korrektur':'Strafzahlung')}</strong><small>${esc(t.note||'')}</small></div><strong>${t.amountCents>0?'+':''}${money(t.amountCents)}</strong></div>`).join('')||'<p class="muted">Keine Buchungen</p>'}</div></section>`:''}
 ${section('fines')?`<div class="metric-grid"><div class="metric"><small>Strafen gesamt</small><div class="value">${money(fined)}</div></div><div class="metric"><small>Offen</small><div class="value red">${money(Math.max(0,fined-paid))}</div></div></div>${readerFineBalancesHTML()}<section class="card"><h2>Einzelne Strafen</h2>${filteredFineListHTML(data.fines)}</section>`:''}${transferAccountHTML()}`;
}
// Nur einmal pro Benutzer: Der Server liefert ausschliesslich noch nicht bestaetigte Nachrichten.
// Keine Nachrichtenliste und kein Menuepunkt fuer Leser.
function showNextNotice(){
 const dlg=$('#notice-dialog');
 if(!dlg||dlg.open||noticeAcknowledging||!profile?.member_id)return;
 if(!noticeQueue.length){showPushOptIn();return;}
 if($('#push-opt-in-dialog')?.open)return;
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
// Permission belongs to this browser/device; remember the invitation per account here.
const pushInvitationsSeen=new Set();
function pushPermission(){return typeof Notification==='undefined'?'unsupported':Notification.permission;}
function pushInvitationKey(){return user?.id?'fantastix.push-invitation.v1:'+user.id:null;}
function showPushOptIn(){
 if(!user||!data||!profile?.member_id||pushPermission()==='granted'||pushEnabled||pushBusy)return;
 const key=pushInvitationKey(),dlg=$('#push-opt-in-dialog');
 if(!key||!dlg||dlg.open||pushInvitationsSeen.has(key))return;
 try{if(localStorage.getItem(key)==='shown')return;}catch{}
 if(noticeQueue.length||noticeAcknowledging||$('#notice-dialog')?.open||$('#absence-dialog')?.open||$('#member-notice-dialog')?.open)return;
 const supported=pushSupported(),denied=pushPermission()==='denied';
 const text=denied?'Mitteilungen sind für FantastiX blockiert. Du kannst sie in den Browser- oder Geräteeinstellungen wieder erlauben.':supported?'Erlaube Mitteilungen, damit du neue Stammtische, Events und Nachrichten auch bei geschlossener App mitbekommst.':'Öffne FantastiX auf einem Gerät mit Push-Unterstützung. Auf dem iPhone: in Safari zum Home-Bildschirm hinzufügen und die installierte App öffnen. Den Mitteilungsstatus findest du unten im Dashboard.';
 dlg.innerHTML=`<div class="modalbody"><div class="modalhead"><h2>${denied?'Mitteilungen sind blockiert':'Mitteilungen erlauben'}</h2></div><p>${text}</p><div class="stack">${supported&&!denied?'<button class="button" type="button" id="push-opt-in-allow">Mitteilungen erlauben</button>':''}<button class="ghost" type="button" id="push-opt-in-dismiss">${supported&&!denied?'Jetzt nicht':'Verstanden'}</button></div></div>`;
 dlg.showModal();pushInvitationsSeen.add(key);
 try{localStorage.setItem(key,'shown');}catch{}
}

const PUSH_CONFIG=()=>String(window.FANTASTIX_PUSH_PUBLIC_KEY||'');
function base64UrlToUint8Array(s){const pad='='.repeat((4-s.length%4)%4);const raw=atob((s+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
function pushSupported(){return window.isSecureContext&&'Notification' in window&&'serviceWorker' in navigator&&'PushManager' in window&&!!PUSH_CONFIG();}
function pushPromptHTML(){
 if(!pushSupported())return '<section class="push-setup"><strong>Mitteilungen auf diesem Gerät nicht verfügbar</strong><p>Für Push-Mitteilungen diese App auf einem unterstützten Gerät als Web-App installieren (iPhone: Safari → Teilen → Zum Home-Bildschirm) und erneut öffnen.</p></section>';
 if(pushEnabled)return `<section class="push-setup is-enabled"><strong>Mitteilungen aktiviert ✓</strong><p>Du erhältst Hinweise zu neuen Stammtischen, neuen Events, Nachrichten und eingerichteten Abstimmungserinnerungen. <button class="smallbtn" type="button" id="push-disable">Deaktivieren</button></p></section>`;
 if(pushPermission()==='denied')return '<section class="push-setup"><strong>Mitteilungen blockiert</strong><p>Erlaube Mitteilungen für FantastiX in deinen Browser- oder Geräteeinstellungen und öffne die App danach erneut.</p></section>';
 const allowed=pushPermission()==='granted';
 return `<section class="push-setup"><strong>${allowed?'Mitteilungen erlaubt – Gerät noch nicht verbunden':'Mitteilungen noch nicht erlaubt'}</strong><p>Erhalte Push-Mitteilungen bei neuen Stammtischen, neuen Events und Admin-Nachrichten. Automatische Fristerinnerungen werden vom Administrator eingerichtet.</p><button class="button" type="button" id="push-enable" ${pushBusy?'disabled':''}>🔔 ${allowed?'Mitteilungen aktivieren':'Mitteilungen erlauben'}</button></section>`;
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
// Separate reminder registration leaves the existing push sender untouched.
async function registerReminderSubscription(sub){
 try{const {error}=await cloud.rpc('fantastix_reminder_subscribe',{p_subscription:sub.toJSON()});
 if(error)console.warn('Fristerinnerungen noch nicht eingerichtet:',error.code||'RPC');}catch{console.warn('Erinnerungsregistrierung vorübergehend nicht erreichbar.');}
}
async function unregisterReminderSubscription(sub){
 try{const {error}=await cloud.rpc('fantastix_reminder_unsubscribe',{p_endpoint:sub.endpoint});
 if(error)console.warn('Erinnerungs-Abmeldung:',error.code||'RPC');}catch{console.warn('Erinnerungs-Abmeldung vorübergehend nicht erreichbar.');}
}
async function detectPushSubscription(){
 if(!user||!profile?.member_id)return;
 if(!pushSupported()){pushEnabled=false;if(tab==='dashboard'&&data)renderRefreshedReader(true);else showPushOptIn();return;}
 try{const reg=await activePushRegistration();const sub=await reg.pushManager.getSubscription();pushEnabled=!!sub&&Notification.permission==='granted';if(pushEnabled){const {error}=await cloud.rpc('fantastix_push_subscribe',{p_subscription:sub.toJSON()});if(error)throw error;await registerReminderSubscription(sub);}}catch(e){pushEnabled=false;console.warn('Push-Status:',e);}
 if(tab==='dashboard'&&data)renderRefreshedReader(true);else showPushOptIn();
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
  await registerReminderSubscription(sub);
  pushEnabled=true;alert('Mitteilungen sind aktiviert.');
 }catch(e){const message=e.message||String(e);alert('Push-Aktivierung fehlgeschlagen: '+message+'\nFalls der Service Worker noch nicht aktiv ist: FantastiX aktualisieren, die installierte Home-Bildschirm-App schließen und neu öffnen. Falls die Anmeldung in Supabase fehlschlägt: Push-SQL und Edge-Funktion prüfen.');}
 finally{pushBusy=false;renderApp();}
}
async function disablePush(){
 if(!cloud||!user)return;
 try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();
  if(sub){const {error}=await cloud.rpc('fantastix_push_unsubscribe',{p_endpoint:sub.endpoint});if(error)throw error;await unregisterReminderSubscription(sub);await sub.unsubscribe();}
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
const READER_REFRESH_INTERVAL=30000;
let readerRefreshInFlight=null,readerLastSync=0,readerLastSyncUser=null,readerPushCheckedAt=0,readerPushCheckedUser=null;
function readerRefreshCurrent(run){return readerRefreshInFlight===run&&user?.id===run.userId;}
function renderRefreshedReader(background){
 // A background update must not replace a note or password while it is being edited.
 const focused=document.activeElement?.matches('input,textarea,select')&&document.activeElement.closest('#content');
 const draft=[...document.querySelectorAll('#content input:not([type="hidden"]),#content textarea')].some(input=>input.value!==input.defaultValue);
 if(!background||!focused&&!draft)renderApp();
}
async function refresh(options={}){
 if(!cloud||!user)return renderGate();
 const background=options.background===true,userId=user.id;
 if(readerRefreshInFlight?.userId===userId){
  if(background)return readerRefreshInFlight.promise;
  // A vote/save needs a read started after the write, even if a background read was running.
  await readerRefreshInFlight.promise;
  if(user?.id!==userId)return;
  return refresh(options);
 }
 if(background&&readerLastSyncUser===userId&&Date.now()-readerLastSync<READER_REFRESH_INTERVAL)return;
 const run={userId,promise:null};readerRefreshInFlight=run;
 run.promise=refreshReaderData(run,background).finally(()=>{if(readerRefreshInFlight===run)readerRefreshInFlight=null;});
 return run.promise;
}
async function refreshReaderData(run,background){
 try{
  const [accountResult,pub,windows]=await Promise.all([
   cloud.from('fantastix_reader_profiles').select('member_id,email,username').eq('user_id',run.userId).maybeSingle(),
   cloud.from('fantastix_public').select('content,published_at').eq('id','main').eq('is_published',true).maybeSingle(),
   cloud.rpc('fantastix_reader_deadlines')
  ]);
  if(!readerRefreshCurrent(run))return;
  if(accountResult.error)throw accountResult.error;
  profile=accountResult.data;
  if(!profile?.member_id){data=null;return renderGate();}
  if(pub.error)throw pub.error;if(windows.error)throw windows.error;
  if(!pub.data?.content){data=null;$('#reader-app').hidden=true;$('#auth-gate').hidden=false;$('#auth-gate').innerHTML=empty('Noch keine Daten für Leser freigegeben.');return;}
  const d=pub.data.content;
  if(!d.sections||!Array.isArray(d.members)||!Array.isArray(d.meetings)||!Array.isArray(d.fines)||!Array.isArray(d.payments))throw Error('Unbekanntes Datenformat.');
  if(d.excursions!==undefined&&!Array.isArray(d.excursions))throw Error('Ungültige Eventsdaten.');d.excursions=d.excursions||[];
  data=d;deadlines=new Map((windows.data||[]).map(r=>[r.meeting_id,r.deadline_at]));lastFetched=pub.data.published_at||new Date().toISOString();
  renderRefreshedReader(background);
  // Independent optional reads run together; the menu is already usable.
  await Promise.all([
   (async()=>{
    if(!section('excursions')){excursionVotes=[];excursionVoteError='';return;}
    try{const res=await cloud.rpc('fantastix_excursion_votes_read_v2');if(!readerRefreshCurrent(run))return;if(res.error)throw res.error;excursionVotes=res.data||[];excursionVoteError='';}
    catch(e){if(readerRefreshCurrent(run)){excursionVoteError='Eventszusagen derzeit nicht verfügbar.';excursionVotes=[];console.warn(e);}}
   })(),
   (async()=>{try{const notes=await cloud.from('fantastix_meeting_notes').select('meeting_id,member_id,note');if(!readerRefreshCurrent(run))return;if(notes.error)throw notes.error;meetingNotes=notes.data||[];}catch(e){if(readerRefreshCurrent(run)){meetingNotes=[];console.warn('Mitgliedernotizen nicht verfügbar:',e.message);}}})(),
   loadBirthdays().catch(e=>{if(readerRefreshCurrent(run)){birthdays=[];console.warn('Geburtstage nicht verfügbar:',e);}}),
   loadAvatars().catch(e=>console.warn('Profilfotos nicht verfügbar:',e)),
   (async()=>{try{const res=await cloud.rpc('fantastix_notice_list');if(!readerRefreshCurrent(run))return;if(res.error)throw res.error;notices=res.data||[];queueNewNotices();}catch(e){if(readerRefreshCurrent(run)){notices=[];console.warn('Nachrichten konnten nicht geladen werden:',e);}}})(),
   refreshReaderExtras()
  ]);
  if(!readerRefreshCurrent(run))return;
  readerLastSync=Date.now();readerLastSyncUser=run.userId;
  renderRefreshedReader(true);
  if(readerPushCheckedUser!==run.userId||Date.now()-readerPushCheckedAt>=5*60*1000){readerPushCheckedUser=run.userId;readerPushCheckedAt=Date.now();detectPushSubscription();}
 }catch(e){
  if(!readerRefreshCurrent(run))return;
  const denied=[401,403].includes(Number(e.status))||['PGRST301','PGRST302','PGRST303','42501'].includes(e.code);
  if(background&&data&&!denied){console.warn('Hintergrundaktualisierung fehlgeschlagen:',e);$('#updated').textContent='Aktualisierung derzeit nicht möglich · bisheriger Stand bleibt sichtbar.';return;}
  data=null;$('#reader-app').hidden=true;$('#auth-gate').hidden=false;$('#auth-gate').innerHTML=empty('Laden fehlgeschlagen: '+(e.message||String(e))+' · Bitte erneut öffnen.');
 }
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
async function logout(){if(!cloud)return;try{if(pushSupported()){const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(sub){await cloud.rpc('fantastix_push_unsubscribe',{p_endpoint:sub.endpoint});await unregisterReminderSubscription(sub);await sub.unsubscribe();}}}catch(e){console.warn('Push-Abmeldung:',e);}pushEnabled=false;readerRefreshInFlight=null;readerLastSyncUser=null;readerPushCheckedUser=null;await cloud.auth.signOut();user=null;fxSetIconBadge(false);profile=null;data=null;meetingNotes=[];excursionVotes=[];excursionVoteError='';readerUpdates=[];readerUpdateReads=new Set();readerPresence={};notices=[];noticeQueue=[];noticeAcknowledging=false;if($('#notice-dialog')?.open)$('#notice-dialog').close();if($('#push-opt-in-dialog')?.open)$('#push-opt-in-dialog').close();avatarUrls={};birthdays=[];avatarLoadedAt=0;deadlines.clear();readerEntry=null;tab='dashboard';authMode='login';renderGate();}
async function castVote(meetingId,status,reason=''){
 if(busy||!data||!profile?.member_id)return;
 const m=data.meetings.find(x=>x.id===meetingId);if(!m)return;
 const deadline=deadlines.get(meetingId);
 if(!deadline||Date.now()>=new Date(deadline).getTime())return alert('Die Abstimmungsfrist ist abgelaufen.');
 const own=effective(m,profile.member_id);
 if(status==='absent'&&!reason.trim())return alert('Bitte einen Grund eintragen.');
 busy=true;renderApp();
 try{
   const {error}=await cloud.rpc('fantastix_cast_vote',{
     p_meeting_id:meetingId,p_status:status,p_reason:status==='absent'?reason.trim():''
   });
   if(error)throw error;
   await refresh();
 }catch(e){alert('Abstimmung nicht gespeichert: '+e.message);}
 finally{busy=false;if(data)renderApp();}
}
async function saveMeetingNote(id,fromVote=false){
 if(!cloud||!profile?.member_id||busy&&!fromVote)return;
 const input=document.querySelector(`[data-meeting-note="${CSS.escape(id)}"]`);
 if(!input)return;
 const note=input.value.trim();if(note.length>160)return alert('Maximal 160 Zeichen erlaubt.');
 const meeting=data?.meetings?.find(m=>m.id===id);
 if(!meeting||!['present','unsure'].includes(effective(meeting,profile.member_id)?.status))return alert('Notizen sind bei einer Zusage oder „Unsicher“ möglich.');
 const deadline=deadlines.get(id);if(!deadline||Date.now()>=new Date(deadline).getTime())return alert('Die Abstimmungsfrist ist abgelaufen.');
 const {error}=await cloud.from('fantastix_meeting_notes').upsert({meeting_id:id,member_id:profile.member_id,note},{onConflict:'meeting_id,member_id'});
 if(error)return alert('Notiz konnte nicht gespeichert werden: '+error.message+' (SQL 19 installieren)');
 await refresh();
 if(!fromVote)alert('Notiz gespeichert und für alle Mitglieder sichtbar.');
}
async function voteExcursion(id,status){
 if(busy||!user||!profile?.member_id||!data||!section('excursions'))return;
 const trip=data.excursions.find(x=>x.id===id);if(!trip||trip.completed||(trip.date&&tripLastDate(trip)<today()))return alert('Dieser Event ist nicht mehr zur Anmeldung offen.');
 if(!['yes','no','unsure'].includes(status))return;
 
 busy=true;renderApp();
 try{
   const {error}=await cloud.rpc('fantastix_excursion_vote',{p_excursion_id:id,p_status:status});
   if(error)throw error;
   await refresh();
 }catch(e){alert('Rückmeldung nicht gespeichert: '+(e.message||String(e)));}
 finally{busy=false;if(data)renderApp();}
}
function askAbsenceReason(meetingId){
 const meeting=data?.meetings?.find(m=>m.id===meetingId);
 const saved=meeting?effective(meeting,profile?.member_id):null;
 const dlg=$('#absence-dialog');
 dlg.innerHTML=`<div class="modalbody"><div class="modalhead"><h2>Grund für 👎</h2><button type="button" class="close" id="close-absence" aria-label="Schließen">×</button></div>
 <form id="absence-reason-form"><input type="hidden" name="meetingId" value="${esc(meetingId)}"><div class="field"><label>Abwesenheitsgrund *</label>
 <input name="reason" maxlength="150" minlength="1" value="${esc(saved?.status==='absent'?saved.reason||'':'')}" placeholder="z. B. Urlaub, beruflich verhindert" required autofocus></div>
 <div class="foot"><button type="button" class="ghost" id="cancel-absence">Abbrechen</button><button type="submit" class="button" aria-label="Absage speichern">👎 Speichern</button></div></form></div>`;
 dlg.showModal();
}
document.addEventListener('submit',e=>{
 if(e.target.id==='reader-auth-form'){e.preventDefault();doAuth(e.target);}
 if(e.target.id==='reader-password-form'){e.preventDefault();changePassword(e.target);}
 if(e.target.id==='member-notice-form'){e.preventDefault();sendMemberNotice(e.target);}
 if(e.target.id==='absence-reason-form'){
   e.preventDefault();const fd=new FormData(e.target),reason=String(fd.get('reason')||'').trim();
   if(!reason)return alert('Bitte einen Abwesenheitsgrund eintragen.');
   $('#absence-dialog').close();castVote(String(fd.get('meetingId')||''),'absent',reason);
 }
});
document.addEventListener('click',e=>{
 if(e.target.closest('[data-fines-more]')){fineListLimit+=10;renderApp();return;}
 const memberEntry=e.target.closest('[data-reader-member]');
 if(memberEntry){openReaderEntry('member',memberEntry.dataset.readerMember);return;}
 const entry=e.target.closest('[data-reader-meeting],[data-reader-excursion]');
 if(entry){openReaderEntry(entry.hasAttribute('data-reader-meeting')?'meeting':'excursion',entry.dataset.readerMeeting??entry.dataset.readerExcursion);return;}
 const copyIBAN=e.target.closest('[data-copy-iban]');if(copyIBAN){copyTransferIBAN(copyIBAN);return;}
 const moreHistory=e.target.closest('[data-member-history-more]');if(moreHistory){const id=moreHistory.dataset.memberHistoryMore;if(readerEntry?.kind==='member'&&readerEntry.id===id&&section('meetings')){memberHistoryLimits.set(id,(memberHistoryLimits.get(id)||10)+10);renderApp();}return;}
 if(e.target.closest('[data-reader-back]')){const from=readerEntry?.from||tab;readerEntry=null;tab=from;renderApp();scrollTo({top:0,behavior:'instant'});return;}
 const readMessage=e.target.closest('[data-reader-read]');if(readMessage){readerReadOne(readMessage.dataset.readerRead);return;}
 if(e.target.closest('#reader-bell')){readerInboxOpen=!readerInboxOpen;renderApp();return;}if(e.target.closest('#reader-inbox-close')){readerInboxOpen=false;renderApp();return;}if(e.target.closest('#reader-read-all')){readerReadAll();return;}
 const toggle=e.target.closest('#auth-mode-toggle');if(toggle){authMode=authMode==='signup'?'login':'signup';renderGate();return;}
 if(e.target.closest('#reader-logout')){logout();return;}
 if(e.target.closest('#push-opt-in-allow')){$('#push-opt-in-dialog').close();enablePush();return;}
 if(e.target.closest('#push-opt-in-dismiss')){$('#push-opt-in-dialog').close();return;}
 if(e.target.closest('#push-enable')){enablePush();return;}
 if(e.target.closest('#push-disable')){disablePush();return;}
 if(e.target.closest('#delete-my-photo')){deleteMyPhoto();return;}
 if(e.target.closest('#notice-ack')){acknowledgeNotice();return;}
 if(e.target.closest('#member-notice-open')){openMemberNotice();return;}
 if(e.target.closest('#member-notice-close')){$('#member-notice-dialog').close();return;}
 if(e.target.closest('#reader-retry,#reader-refresh')){refresh();return;}
 const cal=e.target.closest('[data-calendar-move],[data-calendar-day],[data-calendar-today]');if(cal){if(cal.dataset.calendarMove){calendarMonth=window.FantastiXCalendar.move(calendarMonth,Number(cal.dataset.calendarMove));calendarSelected=calendarMonth===today().slice(0,7)?today():calendarMonth+'-01';}else if(cal.hasAttribute('data-calendar-today')){calendarSelected=window.FantastiXCalendar.local(new Date());calendarMonth=calendarSelected.slice(0,7);}else{calendarSelected=cal.dataset.calendarDay;calendarMonth=calendarSelected.slice(0,7);}renderApp();return;}
 const nav=e.target.closest('[data-tab]');if(nav){
 readerEntry=null;tab=nav.dataset.tab;if(tab==='calendar'){calendarSelected=today();calendarMonth=calendarSelected.slice(0,7);}scrollTo({top:0,behavior:'instant'});
 renderApp();
 if(user&&navigator.onLine)refresh({background:true});
 return;
 }
 const y=e.target.closest('[data-year]');if(y){year=y.dataset.year;renderApp();return;}
 if(e.target.closest('#close-absence,#cancel-absence')){$('#absence-dialog').close();return;}
 const saveNote=e.target.closest('[data-save-meeting-note]');if(saveNote){saveMeetingNote(saveNote.dataset.saveMeetingNote);return;}
 const excursion=e.target.closest('[data-excursion-vote]');if(excursion){voteExcursion(excursion.dataset.excursionId,excursion.dataset.excursionVote);return;}
 const vote=e.target.closest('[data-vote]');if(vote){
   if(vote.dataset.vote==='absent')askAbsenceReason(vote.dataset.meetingId);
   else castVote(vote.dataset.meetingId,vote.dataset.vote);
 }
});
$('#notice-dialog').addEventListener('cancel',e=>{e.preventDefault();});
$('#absence-dialog').addEventListener('close',()=>{showNextNotice();});
$('#push-opt-in-dialog').addEventListener('close',()=>{showNextNotice();});
$('#member-notice-dialog').addEventListener('close',()=>{showNextNotice();});
document.addEventListener('change',e=>{if(e.target.id==='fine-member-filter'){fineMemberFilter=e.target.value;fineListLimit=10;renderApp();return;}if(e.target.matches('.photo-upload-input')&&e.target.files?.[0]){uploadMyPhoto(e.target.files[0]);e.target.value='';}});
navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='fantastix-push-open'&&['dashboard','meetings','calendar','excursions'].includes(e.data.tab)){readerEntry=null;tab=e.data.tab;if(data)renderApp();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&user)refresh({background:true});});
setInterval(()=>{if(!document.hidden&&user&&!busy)refresh({background:true});},60000);
(async()=>{try{await initClient();const {data:auth}=await cloud.auth.getUser();user=auth?.user||null;if(user)await refresh();else renderGate();}catch(e){renderGate('Cloud-Verbindung: '+e.message);}})();

// Presence and inbox are refreshed by the same coordinated background read.

setInterval(refreshVoteCountdowns,30000);
