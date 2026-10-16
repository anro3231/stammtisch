/* Stammtisch+ – private, installierbare Web-App (ohne Build-Tools) */
const DATA_KEY = 'stammtischplus.data.v1';
const CLOUD_KEY = 'stammtischplus.cloud.v1';
const BASELINE_KEY = 'stammtischplus.cloud.baseline.v1';
const SNAP_DB = 'stammtischplus-local-snapshots-v1';
const SNAP_STORE = 'versions';
const SNAP_LIMIT = 50;
const APP_VERSION = '3.6.0';
const DEFAULT = () => ({version:1,modifiedAt:new Date().toISOString(),members:[],meetings:[],fines:[],payments:[]});
const $ = s => document.querySelector(s);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n = x => Math.max(0,Number.isFinite(+x)?Math.round(+x):0);
const money = cents => new Intl.NumberFormat('de-AT',{style:'currency',currency:'EUR'}).format((cents||0)/100);
const moneyToCents = text => {const value=String(text||'').trim().replace(/\s/g,'').replace(/€/g,'').replace(',','.');const f=Number(value);return Number.isFinite(f)&&f>=0?Math.round(f*100):NaN;};
const localDate = d => {const v=d||new Date(); const dt=typeof v==='string'?new Date(v+'T12:00:00'):v;return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`};
const today = ()=>localDate(new Date());
const fmtDate = d => d?new Date(d+'T12:00:00').toLocaleDateString('de-AT',{day:'2-digit',month:'long',year:'numeric'}):'–';
const yearOf = d => String(d||'').slice(0,4);
const initials = name=>String(name).trim().split(/\s+/).map(p=>p[0]||'').slice(0,2).join('').toUpperCase();
const byName = (a,b)=>a.name.localeCompare(b.name,'de');
const memberNo = m => {const raw=m?.memberNumber;if(raw===null||raw===undefined||raw==='')return null;const v=Number(raw);return Number.isSafeInteger(v)&&v>0?v:null;};
const byMemberNo = (a,b)=>(memberNo(a)??Number.MAX_SAFE_INTEGER)-(memberNo(b)??Number.MAX_SAFE_INTEGER)||byName(a,b);
function rotationMembers(){return data.members.filter(m=>m.active!==false&&memberNo(m)!==null).sort(byMemberNo);}
function suggestedOrganizer(date,excludeId=''){const candidates=rotationMembers();if(!candidates.length)return null;const last=[...data.meetings].filter(m=>m.id!==excludeId&&m.date<=date&&m.organizerId&&memberNo(member(m.organizerId))!==null).sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0];const previousNo=memberNo(member(last?.organizerId));return candidates.find(m=>previousNo!==null&&memberNo(m)>previousNo)||candidates[0];}
function yearCount(id,year){return stats(id,year).present+(String(year)==='2026'?n(member(id)?.historical2026Count):0);}

const assertData = v => {if(!v||typeof v!=='object'||!Array.isArray(v.members)||!Array.isArray(v.meetings)||!Array.isArray(v.fines)||!Array.isArray(v.payments))throw Error('Ungültiges Datenformat.');return v;};
function validateBackup(v){
 assertData(v);
 if(JSON.stringify(v).length>10*1024*1024)throw Error('Backup zu groß.');
 for(const [name,max] of [['members',2500],['meetings',10000],['fines',30000],['payments',60000]]){
  if(v[name].length>max)throw Error('Zu viele Einträge in '+name+'.');
  if(!v[name].every(x=>x&&typeof x==='object'&&!Array.isArray(x)&&typeof x.id==='string'&&x.id.length>0&&x.id.length<250))throw Error('Ungültige IDs in '+name+'.');
  if(new Set(v[name].map(x=>x.id)).size!==v[name].length)throw Error('Doppelte IDs in '+name+'.');
 }
 if(!v.members.every(m=>typeof m.name==='string'&&m.name.length<=150&&Number.isSafeInteger(n(m.historicalCount))&&Number.isSafeInteger(n(m.historical2026Count))))throw Error('Ungültige Mitgliederdaten.');
 const nums=v.members.map(memberNo).filter(x=>x!==null);
 if(new Set(nums).size!==nums.length)throw Error('Doppelte Mitgliedsnummern.');
 if(!v.meetings.every(m=>/^\d{4}-\d{2}-\d{2}$/.test(m.date||'')&&m.attendance&&typeof m.attendance==='object'&&!Array.isArray(m.attendance)))throw Error('Ungültige Stammtische.');
 if(!v.fines.every(f=>Number.isSafeInteger(f.amountCents)&&f.amountCents>=0&&typeof f.memberId==='string'&&typeof f.reason==='string'))throw Error('Ungültige Strafen.');
 if(!v.payments.every(p=>Number.isSafeInteger(p.amountCents)&&p.amountCents>=0&&typeof p.fineId==='string'))throw Error('Ungültige Zahlungen.');
 if(!v.meetings.every(m=>Object.entries(m.attendance).every(([memberId,a])=>memberId.length<250 && a && typeof a==='object' && ['present','absent'].includes(a.status) && String(a.reason||'').length<=150 && String(a.note||'').length<=300)))throw Error('Ungültige Anwesenheiten.');
 if(v.rsvpCutoffDays!==undefined&&(!Number.isInteger(v.rsvpCutoffDays)||v.rsvpCutoffDays<0||v.rsvpCutoffDays>14))throw Error('Ungültige Abstimmungsfrist.');
 const centsOk=x=>Number.isSafeInteger(x)&&Math.abs(x)<1e12;
 if(!v.fines.every(f=>centsOk(f.amountCents) && String(f.reason).length<=600))throw Error('Ungültige Strafbeträge.');
 if(!v.payments.every(p=>centsOk(p.amountCents)))throw Error('Ungültige Zahlungsbeträge.');
 if(v.cashbook){
  const c=v.cashbook;
  if(!Array.isArray(c.transactions)||!Array.isArray(c.excludedPaymentIds)||c.transactions.length>12000)throw Error('Ungültiges Kassenbuch.');
  if(!centsOk(c.openingBalanceCents||0)||!centsOk(c.monthlyAmountCents||0))throw Error('Ungültige Kassenbeträge.');
  if(!c.transactions.every(t=>t&&typeof t==='object'&&typeof t.id==='string'&&t.id.length<250&&centsOk(t.amountCents)))throw Error('Ungültige Kassenbuchung.');
 }
 return structuredClone(v);
}

function loadData(){try{const raw=localStorage.getItem(DATA_KEY);return raw?assertData(JSON.parse(raw)):DEFAULT();}catch(err){alert('Gespeicherte Daten konnten nicht geladen werden. Bitte keine neuen Daten speichern, bevor eine Sicherung geprüft wurde.');return DEFAULT();}}
let data=loadData(), page='home', rankYear=String(new Date().getFullYear()), cloudClient=null, cloudUser=null, cloudBusy=false, syncTimer=null, syncMessage='Nur auf diesem iPhone', cloudStatus='local';
let snapshotStatus='Noch keine automatische lokale Sicherung', snapshotCount=0, snapshotError=false;
let snapshotWriteQueue=Promise.resolve();
function openSnapshotDB(){return new Promise((resolve,reject)=>{if(!('indexedDB' in window))return reject(Error('Dieser Browser unterstützt keine lokalen Sicherungsversionen.'));const req=indexedDB.open(SNAP_DB,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(SNAP_STORE))db.createObjectStore(SNAP_STORE,{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('Datenbank konnte nicht geöffnet werden.'));});}
async function readSnapshots(){const db=await openSnapshotDB();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(SNAP_STORE,'readonly');const r=tx.objectStore(SNAP_STORE).getAll();r.onsuccess=()=>resolve(r.result.sort((a,b)=>b.id-a.id));r.onerror=()=>reject(r.error);});}finally{db.close();}}
async function putSnapshot(payload){const copy=JSON.parse(JSON.stringify(assertData(payload)));const db=await openSnapshotDB();try{const saved=await new Promise((resolve,reject)=>{const tx=db.transaction(SNAP_STORE,'readwrite');const store=tx.objectStore(SNAP_STORE);const entry={id:Date.now()*1000+Math.floor(Math.random()*1000),savedAt:new Date().toISOString(),data:copy};store.put(entry);tx.oncomplete=()=>resolve(entry);tx.onerror=()=>reject(tx.error||Error('Lokale Sicherung fehlgeschlagen.'));tx.onabort=()=>reject(tx.error||Error('Lokale Sicherung abgebrochen.'));});const versions=await readSnapshots();if(versions.length>SNAP_LIMIT){await new Promise((resolve,reject)=>{const tx=db.transaction(SNAP_STORE,'readwrite');const store=tx.objectStore(SNAP_STORE);versions.slice(SNAP_LIMIT).forEach(x=>store.delete(x.id));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}snapshotCount=Math.min(versions.length,SNAP_LIMIT);snapshotStatus='Letzter Sicherungsstand: '+new Date(saved.savedAt).toLocaleString('de-AT');snapshotError=false;return saved;}finally{db.close();}}
function queueSnapshot(payload){const captured=JSON.parse(JSON.stringify(payload));snapshotWriteQueue=snapshotWriteQueue.catch(()=>{}).then(()=>putSnapshot(captured)).catch(e=>{snapshotError=true;snapshotStatus='Lokale Sicherung fehlgeschlagen: '+(e.message||String(e));console.warn(snapshotStatus);});return snapshotWriteQueue;}
function persist(){ensureCashbook(data);data.modifiedAt=new Date().toISOString();const serialized=JSON.stringify(data);try{localStorage.setItem(DATA_KEY,serialized);}catch(e){alert('Speichern fehlgeschlagen. Bitte exportiere deine Daten als JSON und prüfe den Gerätespeicher.');throw e;}queueSnapshot(data);markCloudDirty();render();queueSync();}
function doneMeeting(m){return m.date<=today();}
const DASHBOARD_MEETING_START = 150;
function calendarDaysUntil(date){if(!date)return null;const [y,m,d]=date.split('-').map(Number),[ty,tm,td]=today().split('-').map(Number);return Math.max(0,Math.round((Date.UTC(y,m-1,d)-Date.UTC(ty,tm-1,td))/86400000));}
function upcomingMeeting(){return [...data.meetings].filter(m=>m.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)||String(a.createdAt||'').localeCompare(String(b.createdAt||'')))[0]||null;}
function yearLeader(){return rankRows(yearOf(today())).find(m=>m.count>0)||null;}
function member(id){return data.members.find(x=>x.id===id);}
/* Kassa: Zahlungen vor dem Upgrade sind über die Kontostand-Anfangsbuchung abgedeckt.
   Künftige Strafzahlungen werden live aus payments berechnet; Löschungen wirken sofort.
   Monatliche Beiträge und Ausgaben werden als einzelne unveränderliche Buchungen gespeichert. */
const currentMonth = () => today().slice(0,7);
function nextMonth(month){const [y,m]=month.split('-').map(Number);return m===12?`${y+1}-01`:`${y}-${String(m+1).padStart(2,'0')}`;}
const monthOK= value => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value||''));
function ensureCashbook(d){
 if(d.cashbook && Array.isArray(d.cashbook.transactions) && Array.isArray(d.cashbook.excludedPaymentIds))return false;
 d.cashbook={openingBalanceCents:0,excludedPaymentIds:d.payments.map(p=>p.id),monthlyAmountCents:1500,monthlyStartMonth:nextMonth(currentMonth()),transactions:[]};
 return true;
}
function cash(){ensureCashbook(data);return data.cashbook;}
function countedPaymentsCents(){const excluded=new Set(cash().excludedPaymentIds);return data.payments.reduce((s,p)=>s+(excluded.has(p.id)?0:n(p.amountCents)),0);}
function accountBalance(){const c=cash();return Math.round(c.openingBalanceCents||0)+countedPaymentsCents()+c.transactions.reduce((s,t)=>s+Math.round(t.amountCents||0),0);}
function signedMoneyToCents(text){const str=String(text??'').trim().replace(/\s/g,'').replace(/€/g,'').replace(',','.');if(!/^-?\d+(\.\d{1,2})?$/.test(str))return NaN;const amount=Number(str);return Number.isSafeInteger(Math.round(amount*100))?Math.round(amount*100):NaN;}
function euroInput(cents){return (cents/100).toFixed(2).replace('.',',');}
function activeCashMembers(){return data.members.filter(m=>m.active!==false);}
function dueMonthlyPosts(){
 const c=cash(),period=currentMonth(); if(!monthOK(c.monthlyStartMonth)||c.monthlyStartMonth>period)return [];
 const recorded=new Set(c.transactions.filter(t=>t.type==='monthly').map(t=>t.month));
 const pending=[];let month=c.monthlyStartMonth,count=0;
 while(month<=period&&count<240){
  if(!recorded.has(month))pending.push(month);
  month=nextMonth(month);count++;
 }
 return pending;
}
function postMonthlyContributions(){
 const c=cash(),pending=dueMonthlyPosts();if(!pending.length)return false;
 const members=activeCashMembers(),perMember=Math.round(c.monthlyAmountCents||0);
 for(const month of pending)c.transactions.push({id:`monthly-${month}`,type:'monthly',month,date:month+'-01',memberIds:members.map(m=>m.id),memberCount:members.length,perMemberCents:perMember,amountCents:members.length*perMember,note:'Monatsbeitrag'});
 persist();return true;
}
function cashHistory(){
 const c=cash(), excluded=new Set(c.excludedPaymentIds);
 const pays=data.payments.filter(p=>!excluded.has(p.id)).map(p=>({id:p.id,date:p.date||'',type:'payment',amountCents:n(p.amountCents),note:(member(data.fines.find(f=>f.id===p.fineId)?.memberId)?.name||'Strafzahlung')+' · Strafe'}));
 return [...c.transactions,...pays].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.id).localeCompare(String(a.id)));
}
function finePaid(id){return data.payments.filter(p=>p.fineId===id).reduce((s,p)=>s+n(p.amountCents),0);}
function fineOpen(f){return Math.max(0,n(f.amountCents)-finePaid(f.id));}
let readerProfiles = [], readerVotes = [];
function voteFor(meetingId,memberId){return readerVotes.find(v=>v.meeting_id===meetingId&&v.member_id===memberId)||null;}
function effectiveAttendance(m,id){const own=m.attendance?.[id];return own&&['present','absent'].includes(own.status)?own:null;}
function stats(id,year){const meetings=data.meetings.filter(m=>doneMeeting(m)&&(!year||yearOf(m.date)===String(year)));const present=meetings.filter(m=>effectiveAttendance(m,id)?.status==='present').length;const eligible=meetings.filter(m=>!!effectiveAttendance(m,id)).length;return {present,eligible,pct:eligible?Math.round(100*present/eligible):0};} 
function leaders(year){const rows=rankRows(year);return rows.length&&rows[0].count>0?rows.filter(m=>m.count===rows[0].count):[];}
function voteDeadlineDays(){const v=Number(data.rsvpCutoffDays);return Number.isInteger(v)&&v>=0&&v<=14?v:1;}
function allTime(id){return n(member(id)?.historicalCount)+stats(id).present;}
function rankRows(year){return [...data.members].sort((a,b)=>(year?yearCount(b.id,year)-yearCount(a.id,year):allTime(b.id)-allTime(a.id))||a.name.localeCompare(b.name,'de')).map((m,i)=>({...m,place:i+1,count:year?yearCount(m.id,year):allTime(m.id),pct:stats(m.id,year).pct}));}
function icon(k){const paths={home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/>',meetings:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 15l2 2 5-5"/>',members:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',ranking:'<path d="M8 21h8M12 17v4M7 4h10v7a5 5 0 0 1-10 0V4ZM7 6H3v2a4 4 0 0 0 4 4M17 6h4v2a4 4 0 0 1-4 4"/>',fines:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 15h2M7 3v2"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.3 2.3-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-3.2v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-2.3-2.3.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4v-3.2h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.3-2.3.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V4h3.2v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.3 2.3-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v3.2h-.2a1.7 1.7 0 0 0-1.6 1z"/>',cloud:'<path d="M20 16.6a4 4 0 0 0-2-7.5A6 6 0 0 0 6.4 10 4 4 0 0 0 7 18h11"/><path d="m10 15 2 2 4-4"/>'};return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[k]||paths.home}</svg>`;}
const navItems=[['home','Start'],['meetings','Stammtisch'],['members','Mitglieder'],['ranking','Rangliste'],['fines','Kassa'],['settings','Mehr']];
function render(){document.querySelector('#nav').innerHTML=navItems.map(([key,label])=>`<button class="navbutton ${page===key?'active':''}" type="button" data-page="${key}" aria-label="${label}">${icon(key)}<span>${label}</span></button>`).join('');const renderers={home:homeHTML,meetings:meetingsHTML,members:membersHTML,ranking:rankingHTML,fines:finesHTML,settings:settingsHTML};$('#app').innerHTML=`<div class="top"><div class="brand"><img class="brand-logo" src="./fantastix-logo.png" alt="FantastiX Logo"><div><strong>FantastiX</strong><span class="version-tag">Version ${APP_VERSION}</span></div></div><button class="ghost tiny" data-page="settings" type="button"><span class="status ${cloudStatus==='connected'?'good':''}"></span>${cloudStatus==='connected'?'Cloud aktiv':'Lokal'}</button></div>${renderers[page]()}`;}
function pageHead(eyebrow,title,description){return `<div class="eyebrow">${eyebrow}</div><h1 class="title">${title}</h1>${description?`<p class="subtitle">${description}</p>`:''}`;}
function empty(emoji,text,sub=''){return `<div class="empty"><div class="emoji">${emoji}</div><strong>${text}</strong>${sub?`<p class="hint">${sub}</p>`:''}</div>`;}
function homeHTML(){
 const completed=data.meetings.filter(doneMeeting).sort((a,b)=>b.date.localeCompare(a.date));
 const latest=completed.slice(0,2),next=upcomingMeeting(),days=next?calendarDaysUntil(next.date):null;
 const pending=data.fines.reduce((sum,f)=>sum+fineOpen(f),0);
 const yearBest=leaders(yearOf(today())), allBest=leaders(null);
 const organizer=next?member(next.organizerId):suggestedOrganizer(today());
 const leaderList=(list)=>list.length?`<div class="leader-list">${list.map(m=>`<span>${esc(m.name)}</span>`).join('')}</div><small>${list[0].count} Teilnahmen</small>`:`<div class="value">–</div>`;
 return `${pageHead('','Dashboard','')}
  <div class="metric-grid dashboard-stats dashboard-v36">
   <div class="metric"><small>Tage bis zum Stammtisch</small><div class="value">${days===null?'–':days}</div></div>
   <div class="metric"><small>Jahresführende ${yearOf(today())}</small>${leaderList(yearBest)}</div>
   <div class="metric"><small>Ewige Rangliste · Führung</small>${leaderList(allBest)}</div>
   <div class="metric"><small>Kontostand</small><div class="value balance-tile">${money(accountBalance())}</div><small>Offene Strafen: ${money(pending)}</small></div>
  </div>
  <section class="card next-card"><div class="row"><h2>Nächster Stammtisch</h2><span class="chip">${days===null?'Nicht geplant':days===0?'Heute':`In ${days} Tagen`}</span></div>
   ${next?`<strong class="next-date">${fmtDate(next.date)}</strong><p class="next-place">${esc(next.location||'Gasthaus noch offen')}</p><p class="muted tiny">${organizer?'Organisator: '+esc(organizer.name):''}</p><button class="ghost" data-action="meeting-edit" data-id="${next.id}">Stammtisch öffnen</button>`:'<p class="muted">Noch kein nächster Stammtisch eingetragen.</p><button class="button" data-action="meeting-new">+ Stammtisch planen</button>'}
  </section>
  <div class="toolbar"><button class="button" data-action="meeting-new">+ Stammtisch</button><button class="ghost" data-action="member-new">+ Mitglied</button></div>
  <section class="card"><h2>Letzte 2 Stammtische</h2>${latest.length?`<div class="list">${latest.map(m=>`<div class="item"><div class="avatar">${String(new Date(m.date+'T12:00:00').getDate()).padStart(2,'0')}</div><div class="details"><strong>${fmtDate(m.date)}</strong><small>${esc(m.location||'Ohne Gasthaus')} · ${data.members.filter(person=>effectiveAttendance(m,person.id)?.status==='present').length} anwesend</small></div><button class="smallbtn" data-action="meeting-edit" data-id="${m.id}">Öffnen</button></div>`).join('')}</div>`:empty('📅','Noch keine Stammtische')}</section>`;
}
function membersHTML(){const members=[...data.members].sort(byMemberNo);return `${pageHead('','Mitglieder','')}<div class="toolbar"><button class="button" data-action="member-new">+ Mitglied</button><button class="ghost" data-action="bulk-2026">Teilnahmen 2026</button><span class="muted tiny">${data.members.length} Mitglieder</span></div><div class="card">${members.length?`<div class="list">${members.map(m=>`<div class="item"><div class="avatar">${memberNo(m)===null?esc(initials(m.name)):memberNo(m)}</div><div class="details"><strong>${memberNo(m)===null?'':`Nr. ${memberNo(m)} · `}${esc(m.name)} ${m.active===false?'<span class="chip gray">Archiv</span>':''}</strong><small>2026: ${yearCount(m.id,'2026')} · Ewig: ${allTime(m.id)}</small></div><button class="smallbtn" data-action="member-edit" data-id="${m.id}">Bearbeiten</button></div>`).join('')}</div>`:empty('👥','Noch keine Mitglieder')}</div>`;}
function meetingsHTML(){
  const meetings=[...data.meetings].sort((a,b)=>b.date.localeCompare(a.date)),next=suggestedOrganizer(today());
  return `${pageHead('','Stammtische','')}<div class="toolbar"><button class="button" data-action="meeting-new">+ Neuer Stammtisch</button></div>
  <div class="notice">Nächster Organisator: <strong>${next?`Nr. ${memberNo(next)} · ${esc(next.name)}`:'–'}</strong></div>
  <div class="card">${meetings.length?`<div class="list">${meetings.map(m=>{const a=data.members.map(person=>effectiveAttendance(m,person.id)).filter(Boolean),organizer=member(m.organizerId);return `<div class="item"><div class="avatar">${esc(String(new Date(m.date+'T12:00:00').getDate()).padStart(2,'0'))}</div><div class="details"><strong>${fmtDate(m.date)}</strong><small>${esc(m.location||'Kein Gasthaus')} · ${organizer?`Organisator: ${esc(organizer.name)}`:'Organisator offen'}<br>${a.filter(x=>x.status==='present').length} da · ${a.filter(x=>x.status==='absent').length} fehlt · ${data.members.filter(p=>p.active!==false&&!effectiveAttendance(m,p.id)).length} offen</small></div><span class="chip ${doneMeeting(m)?'':'gray'}">${doneMeeting(m)?'Vergangen':'Geplant'}</span><button class="smallbtn" data-action="meeting-edit" data-id="${m.id}">Öffnen</button></div>`}).join('')}</div>`:empty('📅','Keine Stammtische')}</div>`;
}
function rankingHTML(){const years=[...new Set(['2026',yearOf(today()),...data.meetings.map(m=>yearOf(m.date))])].filter(Boolean).sort().reverse();const isAll=rankYear==='all';const rows=rankRows(isAll?null:rankYear);return `${pageHead('','Ranglisten','')}<div class="card"><div class="toolbar" style="margin:0 0 14px"><div class="pill-group"><button class="pill ${isAll?'selected':''}" data-action="rank-year" data-year="all">Ewig</button>${years.map(y=>`<button class="pill ${rankYear===y?'selected':''}" data-action="rank-year" data-year="${y}">${y}</button>`).join('')}</div></div>${rows.length?`<div class="tablewrap"><table class="table"><thead><tr><th>Platz</th><th>Mitglied</th><th>Teilnahmen</th></tr></thead><tbody>${rows.map((m,i)=>`<tr><td><strong>${i<3?['🥇','🥈','🥉'][i]:i+1+'.'}</strong></td><td>${memberNo(m)!==null?`<span class="muted">Nr. ${memberNo(m)}</span> · `:''}${esc(m.name)}${m.active===false?' <span class="chip gray">Archiv</span>':''}</td><td><strong>${m.count}</strong></td></tr>`).join('')}</tbody></table></div>`:empty('🏆','Noch keine Mitglieder')}</div>`;}
function finesHTML(){
 const fines=[...data.fines].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
 const total=fines.reduce((s,f)=>s+n(f.amountCents),0),paid=data.payments.reduce((s,p)=>s+n(p.amountCents),0);
 const c=cash(),entries=cashHistory().slice(0,18),next=dueMonthlyPosts();
 return `${pageHead('','Kassa','')}
 <div class="cash-hero"><span>Aktueller Kontostand</span><div class="cash-balance">${money(accountBalance())}</div><div class="cash-hero-actions"><button class="button" data-action="cash-balance">Kontostand ändern</button><button class="ghost" data-action="cash-expense">− Ausgabe</button></div></div>
 <section class="card"><div class="row cash-setup"><div><h2>Monatsbeiträge</h2><p class="hint">${money(c.monthlyAmountCents)} je aktivem Mitglied · ab ${esc(c.monthlyStartMonth||'–')}</p></div><button class="smallbtn" data-action="cash-settings">Ändern</button></div>
 ${next.length?`<p class="hint">${next.length} ausstehende Monatsbuchung(en) werden beim Speichern gebucht.</p>`:''}
 <div class="row cash-inline"><span>${activeCashMembers().length} aktive Mitglieder</span><strong>${money(activeCashMembers().length*c.monthlyAmountCents)} / Monat</strong></div></section>
 <div class="metric-grid"><div class="metric"><small>Strafen gesamt</small><div class="value">${money(total)}</div></div><div class="metric"><small>Strafen bezahlt</small><div class="value green">${money(paid)}</div></div><div class="metric"><small>Strafen offen</small><div class="value red">${money(total-paid)}</div></div><div class="metric"><small>Straf-Einträge</small><div class="value">${fines.length}</div></div></div>
 <section class="card"><div class="row"><h2>Kassenbuch</h2><button class="smallbtn" data-action="cash-expense">+ Ausgabe</button></div>
 ${entries.length?`<div class="list">${entries.map(t=>`<div class="item"><div class="details"><strong>${t.type==='monthly'?'Monatsbeiträge '+esc(t.month):t.type==='expense'?'Ausgabe':t.type==='adjustment'?'Kontostand angepasst':'Strafe bezahlt'}</strong><small>${esc(t.note||'')}${t.type==='monthly'?` · ${t.memberCount} × ${money(t.perMemberCents)}`:''}</small></div><div class="right"><strong class="cash-amount ${t.amountCents<0?'negative':'positive'}">${t.amountCents>0?'+':''}${money(t.amountCents)}</strong>${t.type==='expense'||t.type==='adjustment'?`<div><button class="smallbtn" data-action="cash-reverse" data-id="${t.id}">Stornieren</button></div>`:''}</div></div>`).join('')}</div>`:empty('📒','Noch keine Buchungen')}</section>
 <div class="toolbar"><button class="button" data-action="fine-new">+ Strafe</button></div>
 <div class="card"><h2>Offene Strafen pro Mitglied</h2>${data.members.length?`<div class="list">${[...data.members].sort((a,b)=>{const aa=data.fines.filter(f=>f.memberId===a.id).reduce((s,f)=>s+fineOpen(f),0),bb=data.fines.filter(f=>f.memberId===b.id).reduce((s,f)=>s+fineOpen(f),0);return bb-aa||byName(a,b)}).map(m=>{const mf=fines.filter(f=>f.memberId===m.id),open=mf.reduce((s,f)=>s+fineOpen(f),0);return `<div class="item"><div class="avatar">${esc(initials(m.name))}</div><div class="details"><strong>${esc(m.name)}</strong><small>${mf.length} Strafen</small></div><span class="number ${open?'':'muted'}">${money(open)}</span></div>`}).join('')}</div>`:empty('💶','Noch keine Mitglieder')}</div>
 <div class="card"><h2>Einzelne Strafen</h2>${fines.length?`<div class="list">${fines.map(f=>{const open=fineOpen(f);return `<div class="item"><div class="details"><strong>${esc(member(f.memberId)?.name||'(gelöschtes Mitglied)')}</strong><small>${esc(f.reason)}</small></div><div class="right"><span class="chip ${open?'red':''}">${open?money(open)+' offen':'Bezahlt'}</span><div style="margin-top:6px">${open?`<button class="smallbtn" data-action="fine-pay" data-id="${f.id}">Kassieren</button>`:''} <button class="smallbtn" data-action="fine-view" data-id="${f.id}">Details</button></div></div></div>`}).join('')}</div>`:empty('🧾','Noch keine Strafen')}</div>`;
}
function cashBalanceForm(){modal('Kontostand ändern',`<form data-form="cash-balance"><p class="hint">Der neue Betrag wird als Korrekturbuchung erfasst.</p><div class="field"><label>Neuer Kontostand (€)</label><input name="balance" inputmode="decimal" type="text" value="${euroInput(accountBalance())}" required></div><div class="field"><label>Notiz</label><input name="note" maxlength="180" placeholder="Optional"></div>${footer('Kontostand speichern')}</form>`);}
function cashExpenseForm(){modal('Ausgabe buchen',`<form data-form="cash-expense"><div class="field"><label>Betrag (€)</label><input name="amount" inputmode="decimal" type="text" placeholder="z. B. 25,00" required></div><div class="field"><label>Verwendungszweck</label><input name="note" maxlength="180" placeholder="z. B. Stammtisch-Abend" required></div>${footer('Ausgabe buchen')}</form>`);}
function cashSettingsForm(){const c=cash();modal('Monatsbeitrag',`<form data-form="cash-settings"><div class="field"><label>Betrag pro aktivem Mitglied (€)</label><input name="amount" inputmode="decimal" type="text" value="${euroInput(c.monthlyAmountCents)}" required></div><div class="field"><label>Monat ab dem gebucht wird</label><input name="startMonth" type="month" value="${esc(c.monthlyStartMonth)}" required></div><p class="hint">Buchung jeweils am 1. des Monats, sobald die App geöffnet wird. Bereits gebuchte Monate bleiben unverändert.</p>${footer('Einstellungen speichern')}</form>`);}
function saveCashBalance(fd){const target=signedMoneyToCents(fd.get('balance'));if(!Number.isSafeInteger(target))return alert('Bitte einen gültigen Kontostand eingeben.');const delta=target-accountBalance();if(!delta){closeModal();return;}cash().transactions.push({id:uid(),type:'adjustment',date:today(),amountCents:delta,note:String(fd.get('note')||'').trim()||'Manuelle Kontostandkorrektur'});closeModal();persist();}
function saveCashExpense(fd){const amount=moneyToCents(fd.get('amount')),note=String(fd.get('note')||'').trim();if(!Number.isSafeInteger(amount)||amount<=0||!note)return alert('Betrag und Verwendungszweck eingeben.');cash().transactions.push({id:uid(),type:'expense',date:today(),amountCents:-amount,note});closeModal();persist();}
function saveCashSettings(fd){const amount=moneyToCents(fd.get('amount')),startMonth=String(fd.get('startMonth')||'');if(!Number.isSafeInteger(amount)||amount<0||!monthOK(startMonth))return alert('Gültigen Beitrag und Startmonat eingeben.');const c=cash();c.monthlyAmountCents=amount;c.monthlyStartMonth=startMonth;closeModal();persist();postMonthlyContributions();}
function settingsHTML(){
 const cfg=getCloudConfig();const active=cloudReady&&cloudUser;
 const sync=active?`<span class="chip">Administrator</span>`:cloudStatus==='error'?`<span class="chip red">Fehler</span>`:`<span class="chip gray">Lokal</span>`;
 return `${pageHead('','Mehr','')}<section class="card"><div class="row"><h2>FantastiX</h2><span class="version-tag">Version ${APP_VERSION}</span></div></section>
 <section class="card"><div class="row"><h2>Cloud & Leser</h2>${sync}</div>
 <p class="hint">${esc(syncMessage)}</p>
 <div class="stack"><button class="button" data-action="cloud-setup">${cloudUser?'Cloud & Freigaben':'Als Administrator anmelden'}</button>
 ${active?`<button class="ghost" data-action="cloud-check">Jetzt synchronisieren</button>`:''}
 <a href="./lesen.html" class="ghost" style="text-decoration:none;justify-content:center">Leseransicht öffnen ↗</a></div></section>
 <section class="card"><h2>Abstimmung & Leserzugänge</h2><div class="stack"><button class="button" data-action="reader-access">Leser mit Mitgliedern verknüpfen</button><button class="ghost" data-action="vote-settings">Abstimmungsfrist · ${voteDeadlineDays()} Tag(e)</button></div></section>
 <section class="card"><h2>Sicherungen</h2><div class="stack"><button class="ghost" data-action="snapshot-list">Lokale Versionen</button><button class="button" data-action="share-json">Backup teilen</button><button class="ghost" data-action="export-json">JSON exportieren</button>
 <label class="ghost" style="text-align:center;cursor:pointer;margin:0">JSON sicher importieren<input id="backupFile" type="file" accept="application/json,.json" style="display:none"></label></div>${snapshotError?`<div class="hint" role="alert">${esc(snapshotStatus)}</div>`:''}</section>`;
}
function modal(title,html){$('#dialog').innerHTML=`<div class="modalbody"><div class="modalhead"><h2>${title}</h2><button type="button" class="close" data-action="close" aria-label="Schließen">×</button></div>${html}</div>`;$('#dialog').showModal();}
const footer = (label='Speichern')=>`<div class="foot"><button type="button" class="ghost" data-action="close">Abbrechen</button><button class="button" type="submit">${label}</button></div>`;
function memberForm(id){
 const m=member(id)||{id:'',name:'',memberNumber:null,historicalCount:0,historical2026Count:0,active:true};
 const nextNo=(()=>{let x=1;const used=new Set(data.members.map(memberNo).filter(Boolean));while(used.has(x))x++;return x})();
 modal(id?'Mitglied bearbeiten':'Neues Mitglied',`<form data-form="member"><input type="hidden" name="id" value="${esc(m.id)}"><div class="field"><label for="mname">Name</label><input id="mname" name="name" value="${esc(m.name)}" maxlength="100" autocomplete="off" required></div><div class="field"><label for="mnumber">Mitgliedsnummer</label><input id="mnumber" name="memberNumber" type="number" min="1" step="1" value="${memberNo(m)??(id?'':nextNo)}" placeholder="z. B. 12"></div><div class="field"><label style="display:flex;align-items:center;gap:9px"><input type="checkbox" name="active" ${m.active!==false?'checked':''}>Aktives Mitglied</label></div>${footer()}</form>`);
}
function bulk2026Form(){const sorted=[...data.members].sort(byMemberNo);if(!sorted.length)return alert('Bitte zuerst Mitglieder anlegen.');modal('Teilnahmen 2026',`<form data-form="bulk-2026">${sorted.map(m=>`<div class="row field"><label style="flex:1;margin:0" for="baseline-${m.id}">${memberNo(m)!==null?'Nr. '+memberNo(m)+' · ':''}${esc(m.name)}</label><input id="baseline-${m.id}" name="baseline-${m.id}" type="number" min="0" step="1" value="${n(m.historical2026Count)}" required style="max-width:115px" aria-label="2026-Teilnahmen ${esc(m.name)}"></div>`).join('')}${footer('Speichern')}</form>`);}
function saveBulk2026(fd){const updates=[];for(const m of data.members){const x=Number(fd.get(`baseline-${m.id}`));if(!Number.isSafeInteger(x)||x<0)return alert(`Ungültiger 2026-Startwert für ${m.name}.`);if(x>n(m.historicalCount))return alert(`Der 2026-Startwert von ${m.name} darf nicht größer als der Gesamt-Startwert (${n(m.historicalCount)}) sein. Bitte zuerst das Mitglied bearbeiten.`);updates.push([m,x]);}for(const [m,x] of updates)m.historical2026Count=x;closeModal();persist();}
const reasonOptions=['Krankheit','Urlaub','Beruflich verhindert','Privater Termin','Unentschuldigt','Sonstiger Grund'];
function absenceFields(id,entry,linkedFine){const present=entry?.status==='absent';return `<div class="absence-extra ${present?'':'hidden'}" data-absence-for="${id}"><div class="field"><label>Abwesenheitsgrund</label><input name="reason-${id}" list="reasons-${id}" value="${esc(entry?.reason||'')}" maxlength="150" placeholder="Grund"><datalist id="reasons-${id}">${reasonOptions.map(o=>`<option value="${esc(o)}">`).join('')}</datalist></div><div class="field"><label>Bemerkung</label><input name="note-${id}" value="${esc(entry?.note||'')}" maxlength="300" placeholder="Optional"></div><div class="field"><label>Strafe in €</label><input name="fine-${id}" inputmode="decimal" type="text" value="${linkedFine?esc((linkedFine.amountCents/100).toFixed(2).replace('.',',')):''}" placeholder="z. B. 5,00"></div></div>`;}
function meetingForm(id){
 const m=data.meetings.find(x=>x.id===id)||{id:'',date:today(),location:'',notes:'',finalized:true,attendance:{},organizerId:null};
 const attendanceMembers=[...data.members].filter(person=>person.active!==false||Object.hasOwn(m.attendance||{},person.id)).sort(byMemberNo);
 const organizerMembers=[...data.members].filter(person=>person.active!==false||person.id===m.organizerId).sort(byMemberNo);
 const proposed=m.organizerId||(suggestedOrganizer(m.date,m.id)?.id||'');
 modal(id?'Stammtisch bearbeiten':'Neuer Stammtisch',`<form data-form="meeting"><input type="hidden" name="id" value="${esc(m.id)}">
 <div class="field"><label>Datum</label><input type="date" name="date" value="${esc(m.date)}" required></div>
 <div class="field"><label>Uhrzeit</label><input type="time" name="time" value="${esc(m.time||'19:00')}" required></div>
 <div class="field"><label>Gasthaus</label><input name="location" maxlength="120" value="${esc(m.location)}" placeholder="Gasthaus auswählen oder eingeben" style="width:100%"></div>
 <div class="field"><label>Organisator</label><select name="organizerId" data-organizer-auto="${id?'off':'on'}"><option value="">Nicht festgelegt</option>${organizerMembers.map(person=>`<option value="${person.id}" ${proposed===person.id?'selected':''}>${memberNo(person)!==null?'Nr. '+memberNo(person)+' · ':''}${esc(person.name)}</option>`).join('')}</select></div>
 <div class="field"><label>Notizen</label><textarea name="notes" maxlength="1000" placeholder="Optional">${esc(m.notes||'')}</textarea></div>
 <h3>Anwesenheit</h3>
 ${attendanceMembers.length?attendanceMembers.map(person=>{const entry=m.attendance?.[person.id]||{};const readerVote=voteFor(m.id,person.id);const linkedFine=data.fines.find(f=>f.meetingId===m.id&&f.memberId===person.id&&f.source==='absence');return `<div class="member-att"><div class="row"><strong>${memberNo(person)!==null?'Nr. '+memberNo(person)+' · ':''}${esc(person.name)}</strong><div class="seg"><button type="button" class="${entry.status==='present'?'on yes':''}" data-action="attend" data-id="${person.id}" data-status="present">✓ Da</button><button type="button" class="${entry.status==='absent'?'on no':''}" data-action="attend" data-id="${person.id}" data-status="absent">× Fehlt</button></div></div><input type="hidden" name="status-${person.id}" value="${esc(entry.status||'')}">${readerVote?`<div class="hint vote-origin">Mitglied hat abgestimmt: <b>${readerVote.status==='present'?'Da':'Nicht da'}</b>${entry.status?' · Admin-Entscheidung gilt':''}</div>`:''}${absenceFields(person.id,entry,linkedFine)}</div>`}).join(''):empty('👥','Noch keine Mitglieder')}
 ${footer(id?'Speichern':'Stammtisch speichern')}${id?`<div class="separator"></div><button type="button" class="danger-btn" data-action="meeting-delete" data-id="${m.id}">Stammtisch löschen</button>`:''}</form>`);
}
function fineForm(){
 if(!data.members.length)return alert('Bitte lege zuerst ein Mitglied an.');
 modal('Strafe eintragen',`<form data-form="fine"><div class="field"><label>Mitglied</label><select name="memberId" required>${[...data.members].sort(byName).map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div><div class="field"><label>Betrag (€)</label><input name="amount" type="text" inputmode="decimal" placeholder="5,00" required></div><div class="field"><label>Grund</label><input name="reason" maxlength="300" placeholder="z. B. Zu spät gekommen" required></div>${footer('Strafe erfassen')}</form>`);
}
function payForm(id){
 const f=data.fines.find(x=>x.id===id);if(!f)return;const open=fineOpen(f);
 modal('Zahlung erfassen',`<div class="notice"><strong>${esc(member(f.memberId)?.name||'Mitglied')}</strong><br>${esc(f.reason)}<br>Offen: <strong>${money(open)}</strong></div><form data-form="payment"><input name="fineId" type="hidden" value="${f.id}"><div class="field"><label>Betrag (€)</label><input name="amount" inputmode="decimal" type="text" value="${(open/100).toFixed(2).replace('.',',')}" required></div><div class="field"><label>Zahlungsart</label><select name="method"><option>Bar</option><option>Überweisung</option><option>Sonstiges</option></select></div><div class="field"><label>Notiz</label><input name="note" maxlength="200" placeholder="Optional"></div>${footer('Zahlung buchen')}</form>`);
}
function fineView(id){
 const f=data.fines.find(x=>x.id===id);if(!f)return;
 const payments=data.payments.filter(p=>p.fineId===id).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
 modal('Strafendetails',`<div class="stack"><div><label>Mitglied</label><strong>${esc(member(f.memberId)?.name||'Unbekannt')}</strong></div><div><label>Grund</label><strong>${esc(f.reason)}</strong></div><div class="row"><div><label>Gesamtbetrag</label><strong>${money(f.amountCents)}</strong></div><div class="right"><label>Offen</label><strong>${money(fineOpen(f))}</strong></div></div></div><div class="separator"></div><h3>Zahlungen</h3>${payments.length?payments.map(p=>`<div class="item"><div class="details"><strong>${money(p.amountCents)}</strong><small>${esc(p.method||'Bar')} ${p.note?`· ${esc(p.note)}`:''}</small></div><button class="smallbtn" data-action="payment-delete" data-id="${p.id}">Stornieren</button></div>`).join(''):empty('🧾','Noch keine Zahlung')}<div class="foot">${fineOpen(f)?`<button class="button" data-action="fine-pay" data-id="${f.id}">Zahlung erfassen</button>`:''}<button class="ghost" data-action="close">Schließen</button></div>${payments.length?'':'<div class="separator"></div><button class="danger-btn" data-action="fine-delete" data-id="'+f.id+'">Unbezahlte Strafe löschen</button>'}`);
}
function attStatus(id,status){const root=$('#dialog');const field=root.querySelector(`[name="status-${id}"]`);if(!field)return;field.value=field.value===status?'':status;const parent=field.closest('.member-att');parent.querySelectorAll('[data-action="attend"]').forEach(b=>b.className=(field.value===b.dataset.status?`on ${b.dataset.status==='present'?'yes':'no'}`:''));parent.querySelector('.absence-extra').classList.toggle('hidden',field.value!=='absent');}
function saveMember(fd){
 const id=String(fd.get('id')||''),name=String(fd.get('name')||'').trim(),rawNo=String(fd.get('memberNumber')||'').trim(),number=rawNo===''?null:Number(rawNo);
 if(!name)return alert('Bitte einen Namen eingeben.');
 if(number!==null&&(!Number.isSafeInteger(number)||number<=0))return alert('Die Mitgliedsnummer muss eine positive ganze Zahl sein.');
 if(data.members.some(m=>m.name.toLocaleLowerCase('de')===name.toLocaleLowerCase('de')&&m.id!==id))return alert('Dieser Mitgliedsname ist bereits vorhanden.');
 if(number!==null&&data.members.some(m=>memberNo(m)===number&&m.id!==id))return alert(`Mitgliedsnummer ${number} ist bereits vergeben.`);
 const previous=member(id)||{};
 const value={...previous,id:id||uid(),name,memberNumber:number,historicalCount:n(previous.historicalCount),historical2026Count:n(previous.historical2026Count),active:fd.has('active')};
 if(id)data.members=data.members.map(m=>m.id===id?value:m);else data.members.push(value);
 closeModal();persist();
}
function saveMeeting(fd){
 const id=String(fd.get('id')||''),date=String(fd.get('date')||''),location=String(fd.get('location')||'').trim(),notes=String(fd.get('notes')||'').trim(),organizerId=String(fd.get('organizerId')||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return alert('Bitte ein gültiges Datum auswählen.');
 if(organizerId&&!member(organizerId))return alert('Bitte einen gültigen Organisator auswählen.');
 const previousMeeting=data.meetings.find(t=>t.id===id);
 const members=[...data.members].filter(m=>m.active!==false||Object.hasOwn(previousMeeting?.attendance||{},m.id));
 const attendance={},fineChanges=[];
 for(const m of members){
   const status=String(fd.get(`status-${m.id}`)||'');
   if(status==='present'){attendance[m.id]={status:'present'};}
   if(status==='absent'){
     const reason=String(fd.get(`reason-${m.id}`)||'').trim(),note=String(fd.get(`note-${m.id}`)||'').trim();
     attendance[m.id]={status:'absent',reason,note};
     const rawFine=String(fd.get(`fine-${m.id}`)||'').trim(),amount=rawFine?moneyToCents(rawFine):0;
     if(!Number.isSafeInteger(amount)||amount<0)return alert(`Ungültiger Strafbetrag für ${m.name}.`);
     fineChanges.push({memberId:m.id,amount,reason});
   }
 }
 const mtId=id||uid();
 // When an absence is changed to present/undecided, remove its fine if unpaid.
 for(const existing of data.fines.filter(f=>f.meetingId===mtId&&f.source==='absence')){
   if(attendance[existing.memberId]?.status!=='absent'){
     if(finePaid(existing.id)>0)return alert('Die bezahlte Abwesenheitsstrafe muss zuerst storniert werden, bevor die Anwesenheit geändert wird.');
   }
 }
 for(const item of fineChanges){const existingFine=data.fines.find(f=>f.meetingId===mtId&&f.memberId===item.memberId&&f.source==='absence');if(existingFine&&item.amount<finePaid(existingFine.id))return alert(`Der Strafbetrag darf nicht unter den bereits bezahlten Betrag ${money(finePaid(existingFine.id))} gesenkt werden.`);}
 const time=String(fd.get('time')||'19:00');if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return alert('Bitte eine gültige Uhrzeit auswählen.');
 const record={id:mtId,date,time,location,notes,organizerId:organizerId||null,finalized:true,attendance,createdAt:previousMeeting?.createdAt||new Date().toISOString()};
 if(id)data.meetings=data.meetings.map(m=>m.id===id?record:m);else data.meetings.push(record);
 data.fines=data.fines.filter(f=>!(f.meetingId===mtId&&f.source==='absence'&&attendance[f.memberId]?.status!=='absent'));
 for(const item of fineChanges){const existingFine=data.fines.find(f=>f.meetingId===mtId&&f.memberId===item.memberId&&f.source==='absence');
   if(existingFine){if(item.amount>0){existingFine.amountCents=item.amount;existingFine.reason=`Abwesenheit: ${item.reason||'ohne Angabe'}`;existingFine.date=date;}else if(!finePaid(existingFine.id)){data.fines=data.fines.filter(f=>f.id!==existingFine.id);}}
   else if(item.amount>0){data.fines.push({id:uid(),memberId:item.memberId,meetingId:mtId,source:'absence',date,reason:`Abwesenheit: ${item.reason||'ohne Angabe'}`,amountCents:item.amount});}
 }
 closeModal();persist();
}
function saveFine(fd){
 const amount=moneyToCents(fd.get('amount')),memberId=String(fd.get('memberId')),reason=String(fd.get('reason')||'').trim();
 if(!member(memberId)||!reason||!Number.isSafeInteger(amount)||amount<=0)return alert('Bitte Mitglied, Grund und einen positiven Betrag eintragen.');
 data.fines.push({id:uid(),memberId,date:today(),reason,amountCents:amount,meetingId:null,source:'manual'});
 closeModal();persist();
}
function savePayment(fd){
 const fine=data.fines.find(f=>f.id===fd.get('fineId'));if(!fine)return;
 const amount=moneyToCents(fd.get('amount'));
 if(!Number.isSafeInteger(amount)||amount<=0||amount>fineOpen(fine))return alert(`Zahlung muss größer als 0 € und maximal ${money(fineOpen(fine))} sein.`);
 data.payments.push({id:uid(),fineId:fine.id,date:today(),amountCents:amount,method:String(fd.get('method')||'Bar'),note:String(fd.get('note')||'').trim()});
 closeModal();persist();
}
async function reloadReaderAdminData(){
 if(!cloudReady||!cloudUser||!cloudClient)return;
 const [profiles,votes]=await Promise.all([
  cloudClient.from('fantastix_reader_profiles').select('user_id,email,member_id,registered_at').order('registered_at',{ascending:false}),
  cloudClient.from('fantastix_reader_votes').select('meeting_id,member_id,user_id,status,updated_at')
 ]);
 if(profiles.error)throw profiles.error;if(votes.error)throw votes.error;
 readerProfiles=profiles.data||[];readerVotes=votes.data||[];
}
async function readerAccess(){
 if(!cloudReady){alert('Bitte zuerst als Administrator mit der Cloud verbinden.');return;}
 try{await reloadReaderAdminData();}
 catch(e){alert('Leser konnten nicht geladen werden: '+e.message);return;}
 const people=readerProfiles.filter(p=>p.user_id!==cloudUser.id);
 modal('Leser mit Mitgliedern verknüpfen',`<p class="hint">Neue Konten erscheinen nach der Registrierung. Je Mitglied ist ein Leserzugang möglich.</p><form data-form="reader-access">
 ${people.length?people.map(p=>`<div class="reader-admin-row"><div><strong>${esc(p.email||p.user_id)}</strong><small> ${p.member_id?'Verknüpft':'Wartet auf Zuordnung'}</small></div><select name="reader-${esc(p.user_id)}" aria-label="Zuordnung ${esc(p.email)}"><option value="">Nicht zugeordnet</option>${[...data.members].sort(byMemberNo).map(m=>`<option value="${esc(m.id)}" ${p.member_id===m.id?'selected':''}>${memberNo(m)!==null?'Nr. '+memberNo(m)+' · ':''}${esc(m.name)}</option>`).join('')}</select></div>`).join(''):'<div class="notice">Noch keine Leser registriert.</div>'}
 ${people.length?footer('Verknüpfungen speichern'):'<button class="ghost" type="button" data-action="close">Schließen</button>'}</form>`);
}
async function saveReaderAccess(fd){
 if(!cloudReady)return alert('Cloud-Verbindung erforderlich.');
 const rows=readerProfiles.filter(p=>p.user_id!==cloudUser.id),used=new Set();
 const selections=rows.map(p=>({user_id:p.user_id,member_id:String(fd.get('reader-'+p.user_id)||'')||null}));
 for(const r of selections){if(r.member_id&&!member(r.member_id))return alert('Unbekanntes Mitglied.');if(r.member_id&&used.has(r.member_id))return alert('Ein Mitglied kann nur einem Leser zugeordnet werden.');if(r.member_id)used.add(r.member_id);}
 try{
  // Erst entfernte Zuordnungen lösen, dann neue setzen: keine transienten UNIQUE-Konflikte.
  for(const r of selections.filter(r=>r.member_id!==readerProfiles.find(p=>p.user_id===r.user_id)?.member_id)){
   const old=readerProfiles.find(p=>p.user_id===r.user_id);
   if(old?.member_id){const {error}=await cloudClient.from('fantastix_reader_profiles').update({member_id:null}).eq('user_id',r.user_id);if(error)throw error;}
  }
  for(const r of selections.filter(r=>r.member_id)){
   const {error}=await cloudClient.from('fantastix_reader_profiles').update({member_id:r.member_id}).eq('user_id',r.user_id);if(error)throw error;
  }
  await reloadReaderAdminData();closeModal();alert('Leserzugänge aktualisiert.');
 }catch(e){alert('Zuordnung fehlgeschlagen: '+e.message+' (Bitte Liste neu öffnen und Stand prüfen.)');}
}
function voteSettingsForm(){modal('Abstimmungsfrist',`<form data-form="vote-settings"><div class="field"><label>Tage vor dem Stammtisch</label><input name="days" type="number" min="0" max="14" step="1" value="${voteDeadlineDays()}" required></div><p class="hint">1 = Abstimmung bis 24 Stunden vor der eingetragenen Uhrzeit. 0 = bis zum Beginn. Es gilt die Zeitzone Wien.</p>${footer('Frist speichern')}</form>`);}
function saveVoteSettings(fd){const days=Number(fd.get('days'));if(!Number.isInteger(days)||days<0||days>14)return alert('Bitte 0 bis 14 Tage eingeben.');data.rsvpCutoffDays=days;closeModal();persist();}

function closeModal(){if($('#dialog').open)$('#dialog').close();}
function download(content,name,mime){const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);}
function exportJSON(){download(JSON.stringify(data,null,2),`FantastiX_Backup_${today()}.json`,'application/json;charset=utf-8');}
async function shareJSON(){const filename=`FantastiX_Backup_${today()}.json`;const file=new File([JSON.stringify(data,null,2)],filename,{type:'application/json'});try{if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'FantastiX Datensicherung'});return;}exportJSON();alert('Dein Browser hat die Sicherung heruntergeladen. Bitte speichere sie über die Dateien-App manuell unter iCloud Drive.');}catch(e){if(e.name!=='AbortError')alert('Teilen fehlgeschlagen: '+(e.message||String(e)));}}
async function snapshotList(){try{await snapshotWriteQueue;const versions=await readSnapshots();if(!versions.length)return alert('Noch keine Sicherungsstände vorhanden. Speichere zuerst eine Änderung in der App.');modal('Lokale Sicherungsstände',`<div class="notice warning">Diese Versionen liegen nur im Browser. Bei einer Wiederherstellung wird der aktuelle Datenstand ersetzt. Exportiere zur Sicherheit vorher eine JSON-Datei.</div><div class="stack" style="margin-top:12px"><button class="ghost" data-action="export-json">↓ Aktuelle Daten sichern</button>${versions.map((v,i)=>`<button class="ghost" data-action="snapshot-restore" data-snapshot="${v.id}">${new Date(v.savedAt).toLocaleString('de-AT')} · ${v.data.members.length} Mitglieder · ${v.data.meetings.length} Stammtische</button>`).join('')}</div>`);}catch(e){alert('Sicherungsstände konnten nicht gelesen werden: '+(e.message||String(e)));}}
async function snapshotRestore(id){try{await snapshotWriteQueue;const versions=await readSnapshots();const v=versions.find(x=>x.id===Number(id));if(!v)return alert('Sicherungsstand nicht mehr vorhanden.');if(!confirm('Alle aktuellen Daten durch den Stand vom '+new Date(v.savedAt).toLocaleString('de-AT')+' ersetzen?'))return;await queueSnapshot(data);data=assertData(structuredClone(v.data));ensureCashbook(data);closeModal();persist();postMonthlyContributions();if(cloudUser&&cloudReady)queueSync();alert('Sicherungsstand lokal wiederhergestellt. Bitte Cloud-Konflikte ggf. prüfen.');}catch(e){alert('Wiederherstellen fehlgeschlagen: '+(e.message||String(e)));}}

/* FantastiX 3.5 – geschützte Administrator-Cloud mit expliziter öffentlicher Veröffentlichung */
const CLOUD_REV_KEY = 'fantastix.cloud.v35.revision';
const CLOUD_CONTEXT_KEY = 'fantastix.cloud.v35.context';
const CLOUD_DIRTY_KEY = 'fantastix.cloud.v35.dirty';
const PUBLIC_SETTINGS_KEY = 'fantastix.public.v35.settings';
let cloudRevision = null, cloudReady = false, cloudDirty = localStorage.getItem(CLOUD_DIRTY_KEY) === '1';
let cloudSaving = false, pendingRemote = null, publishing = false, publicPublished = false;
const getCloudConfig = () => {
 const cfg = window.FANTASTIX_CLOUD;
 if (!cfg || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(cfg.url||'').trim()) ||
     !/^sb_publishable_[\w-]{15,}$|^eyJ[A-Za-z0-9._-]{40,}$/.test(String(cfg.key||'').trim())) return null;
 return {url:cfg.url.trim().replace(/\/$/,''),key:cfg.key.trim()};
};
const publicSettings = () => {
 const defaults = {members:true, meetings:true, absences:false, fines:false, cash:false, auto:false};
 try {return {...defaults,...JSON.parse(localStorage.getItem(PUBLIC_SETTINGS_KEY)||'{}')};}
 catch{return defaults;}
};
const savePublicSettings = opts => localStorage.setItem(PUBLIC_SETTINGS_KEY,JSON.stringify(opts));
const activeCloudContext=()=>cloudUser&&getCloudConfig()?getCloudConfig().url+'|'+cloudUser.id:'';
const hasData = d => !!(d.members?.length||d.meetings?.length||d.fines?.length||d.payments?.length||d.cashbook?.transactions?.length||d.cashbook?.openingBalanceCents);
function markCloudDirty(){cloudDirty=true;localStorage.setItem(CLOUD_DIRTY_KEY,'1');}
function markCloudClean(revision){cloudDirty=false;cloudRevision=revision;localStorage.setItem(CLOUD_DIRTY_KEY,'0');localStorage.setItem(CLOUD_REV_KEY,String(revision));localStorage.setItem(CLOUD_CONTEXT_KEY,activeCloudContext());}
function cloudForm(){
 const cfg=getCloudConfig();
 if(!cfg)return modal('Cloud einrichten',`<div class="notice warning">Trage deine Supabase-Projekt-URL und deinen Publishable Key in <strong>cloud-config.js</strong> ein und lade die Datei auf GitHub Pages hoch. Die Schritte stehen in ANLEITUNG.txt.</div><button class="ghost" data-action="close">Schließen</button>`);
 if(!cloudUser)return modal('Administrator-Anmeldung',`<form data-form="cloud-auth"><div class="field"><label>E-Mail</label><input type="email" name="email" autocomplete="username" required></div><div class="field"><label>Passwort</label><input type="password" name="password" autocomplete="current-password" minlength="6" required></div>${footer('Anmelden')}</form>`);
 const opts=publicSettings();
 modal('Cloud & Freigaben',`<div class="notice ${cloudReady?'':'warning'}">${esc(syncMessage)}</div>
  <div class="stack" style="margin:14px 0"><button class="ghost" data-action="cloud-check">Jetzt synchronisieren</button>
   ${!cloudReady?`<button class="button" data-action="cloud-choose">Datenbestand auswählen</button>`:''}
   <button class="ghost" data-action="cloud-logout">Administrator abmelden</button></div>
  <div class="separator"></div><h3>Geschützte Leseransicht</h3>
  <p class="hint">Nur registrierte und von dir einem Mitglied zugeordnete Benutzer sehen die freigegebenen Daten.</p>
  <form data-form="public-settings">
   ${[['members','Mitglieder & Ranglisten'],['meetings','Stammtische & Anwesenheiten'],['absences','Abwesenheitsgründe & Notizen'],['fines','Strafen & Zahlungen'],['cash','Kontostand & Kassenbuch']].map(([k,label])=>`<div class="field"><label style="display:flex;align-items:center;gap:10px"><input type="checkbox" name="${k}" ${opts[k]?'checked':''}>${label}</label></div>`).join('')}
   <div class="field"><label style="display:flex;align-items:center;gap:10px"><input type="checkbox" name="auto" ${opts.auto?'checked':''}>Nach Änderungen automatisch neu veröffentlichen</label></div>
   <div class="notice warning">Strafen, Zahlungen und Abwesenheitsgründe enthalten möglicherweise sensible Angaben. Gib sie nur mit entsprechender Berechtigung frei.</div>
   <div class="stack" style="margin-top:13px"><button class="button" type="submit">Auswahl speichern & veröffentlichen</button><button class="ghost" type="button" data-action="cloud-unpublish">Öffentliche Ansicht abschalten</button></div>
  </form>
  <div class="separator"></div><a class="button" href="./lesen.html" target="_blank" rel="noopener">Leseransicht öffnen ↗</a>`);
}
async function initCloudClient(){
 const cfg=getCloudConfig();if(!cfg)throw Error('cloud-config.js muss zuerst mit Supabase-Projektdaten eingerichtet werden.');
 if(cloudClient)return cloudClient;
 const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.57.0');
 cloudClient=createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 return cloudClient;
}
async function readRemote(){
 if(!cloudClient)throw Error('Keine Cloud-Verbindung.');
 const {data:remote,error}=await cloudClient.from('fantastix_private').select('content,revision,updated_at').eq('id','main').maybeSingle();
 if(error)throw error;
 if(!remote)throw Error('Keine Administratorberechtigung oder die SQL-Einrichtung fehlt.');
 assertData(remote.content);return remote;
}
async function readPublication(){
 const {data:rec,error}=await cloudClient.from('fantastix_public').select('is_published,published_at').eq('id','main').maybeSingle();
 if(error)throw error;publicPublished=rec?.is_published===true;return publicPublished;
}
async function connectCloud(silent=true){
 if(cloudBusy)return;cloudBusy=true;
 try{
  await initCloudClient();
  const {data:auth,error}=await cloudClient.auth.getUser();if(error && !/Auth session missing/i.test(error.message))throw error;
  cloudUser=auth?.user||null;
  if(cloudUser)await syncCloud(true);
  else {cloudReady=false;cloudStatus='local';syncMessage='Nicht angemeldet';}
 }catch(e){cloudReady=false;cloudStatus='error';syncMessage=e.message||String(e);if(!silent)alert('Cloud: '+syncMessage);}
 finally{cloudBusy=false;render();}
}
async function cloudAuth(fd){
 try{
  await initCloudClient();
  const {error}=await cloudClient.auth.signInWithPassword({email:String(fd.get('email')||'').trim(),password:String(fd.get('password')||'')});
  if(error)throw error;
  const {data:verified,error:whoError}=await cloudClient.auth.getUser();if(whoError)throw whoError;
  cloudUser=verified.user;
  await readRemote(); // RLS überprüft die Administratorberechtigung serverseitig.
  closeModal();await syncCloud(true);render();
 }catch(e){cloudUser=null;cloudReady=false;cloudStatus='error';syncMessage=e.message||String(e);alert('Anmeldung abgelehnt: '+syncMessage);}
}
function adoptCloud(remote){
 const payload=assertData(structuredClone(remote.content));
 queueSnapshot(data);data=payload;ensureCashbook(data);
 localStorage.setItem(DATA_KEY,JSON.stringify(data));queueSnapshot(data);
 markCloudClean(remote.revision);cloudReady=true;cloudStatus='connected';syncMessage='Cloud-Daten geladen';render();
 postMonthlyContributions();
}
function cloudChooseModal(remote,reason){
 pendingRemote=remote;cloudReady=false;cloudStatus='warning';syncMessage='Datenbestand auswählen';
 modal('Datenstand auswählen',`<div class="notice warning">${esc(reason)} Behalte vorher eine JSON-Sicherung.</div>
 <div class="stack" style="margin-top:14px"><button class="ghost" data-action="export-json">JSON-Sicherung herunterladen</button>
 <button class="button" data-action="cloud-download">Cloud-Daten übernehmen</button>
 <button class="danger-btn" data-action="cloud-upload">Lokale Daten als neuen Cloud-Stand speichern</button></div>`);
}
async function syncCloud(silent=false){
 if(!cloudUser||!cloudClient||!navigator.onLine||cloudSaving)return;
 try{
  const remote=await readRemote();
  const previous=localStorage.getItem(CLOUD_CONTEXT_KEY)===activeCloudContext()?localStorage.getItem(CLOUD_REV_KEY):null;
  if(!cloudReady){
   if(previous!==null && Number(previous)===Number(remote.revision)){
    cloudRevision=remote.revision;cloudReady=true;cloudStatus='connected';syncMessage='Cloud verbunden';
    if(cloudDirty)queueSync();
   } else if(!hasData(data)){
    adoptCloud(remote);
   } else if(!hasData(remote.content) && !cloudDirty && previous!==null){
    cloudChooseModal(remote,'Die Cloud ist leer. Soll dein lokaler Datenstand hochgeladen werden?');
   } else {
    cloudChooseModal(remote,'Es liegen lokale Daten und ein Cloud-Datenbestand vor. Bitte wähle bewusst einen Stand aus.');
   }
  }else if(Number(remote.revision)!==Number(cloudRevision)){
   if(cloudDirty)cloudChooseModal(remote,'Die Cloud wurde anderswo geändert und lokal liegen weitere Änderungen vor.');
   else adoptCloud(remote);
  }else if(cloudDirty){queueSync();}
  else{cloudStatus='connected';syncMessage='Synchronisiert';}
  await readPublication();
  if(cloudReady){try{await reloadReaderAdminData();}catch(e){console.warn('Leser-Abstimmungen konnten nicht geladen werden:',e);}}
 }catch(e){cloudStatus='error';syncMessage=e.message||String(e);if(!silent)alert('Cloud-Synchronisierung: '+syncMessage);}
 render();
}
async function cloudUpload(force=false){
 if(!cloudClient||!cloudUser||!navigator.onLine)throw Error('Keine Internetverbindung oder keine Administratoranmeldung.');
 if(cloudSaving)return;
 if(!cloudReady&&!force)throw Error('Bitte zuerst einen Datenbestand auswählen.');
 cloudSaving=true;
 try{
  let expected=cloudRevision;
  if(force){const r=await readRemote();expected=r.revision;}
  const snapshot=structuredClone(data);
  const {data:rows,error}=await cloudClient.from('fantastix_private')
   .update({content:snapshot,revision:expected+1,updated_at:new Date().toISOString()})
   .eq('id','main').eq('revision',expected).select('revision');
  if(error)throw error;
  if(!rows||rows.length!==1){const fresh=await readRemote();cloudChooseModal(fresh,'Ein anderer Cloud-Stand wurde inzwischen gespeichert.');throw Error('Cloud-Konflikt. Daten bitte bewusst abgleichen.');}
  cloudRevision=rows[0].revision;cloudReady=true;cloudStatus='connected';syncMessage='Gesichert · '+new Date().toLocaleTimeString('de-AT');
  const unchanged=data.modifiedAt===snapshot.modifiedAt && JSON.stringify(data)===JSON.stringify(snapshot);
  if(unchanged){markCloudClean(cloudRevision);if(publicSettings().auto && publicPublished)await publishPublic(false);}
  else{markCloudDirty();queueSync();}
  return true;
 }finally{cloudSaving=false;render();}
}
function queueSync(){
 if(!cloudUser||!cloudReady)return;
 clearTimeout(syncTimer);
 syncTimer=setTimeout(()=>cloudUpload().catch(e=>{cloudStatus='error';syncMessage=e.message||String(e);render();}),1100);
}
function publicSnapshot(opts){
 const allowMembers=Boolean(opts.members),allowMeetings=Boolean(opts.meetings),allowAbsences=Boolean(opts.absences&&opts.meetings),allowFines=Boolean(opts.fines),allowCash=Boolean(opts.cash);
 const members=allowMembers?data.members.map(m=>({id:m.id,name:m.name,memberNumber:m.memberNumber??null,active:m.active!==false,historicalCount:n(m.historicalCount),historical2026Count:n(m.historical2026Count)})):[];
 const meetings=allowMeetings?data.meetings.map(m=>({id:m.id,date:m.date,location:m.location||'',notes:allowAbsences?(m.notes||''):'',organizerId:m.organizerId||null,time:m.time||'19:00',attendance:Object.fromEntries(data.members.map(p=>[p.id,effectiveAttendance(m,p.id)]).filter(([,v])=>v?.status==='present'||v?.status==='absent').map(([id,v])=>[id,allowAbsences?{status:v.status,reason:v.reason||'',note:v.note||'',source:'admin'}:{status:v.status,source:'admin'}]))})):[];
 const fines=allowFines?data.fines.map(f=>({id:f.id,memberId:f.memberId,meetingId:f.meetingId||null,reason:(f.source==='absence'&&!allowAbsences?'Abwesenheitsstrafe':f.reason),amountCents:n(f.amountCents),source:f.source||'manual'})):[];
 const payments=allowFines?data.payments.map(p=>({id:p.id,fineId:p.fineId,amountCents:n(p.amountCents),method:p.method||'Bar'})):[];
 const cashbook=allowCash?{balanceCents:accountBalance(),monthlyAmountCents:cash().monthlyAmountCents,monthlyStartMonth:cash().monthlyStartMonth,transactions:cashHistory().filter(t=>allowFines||t.type!=='payment').map(t=>({id:t.id,type:t.type,month:t.month||'',note:t.note||'',amountCents:t.amountCents,date:t.date||''}))}:null;
 return {schemaVersion:2,rsvpCutoffDays:voteDeadlineDays(),publishedAt:new Date().toISOString(),sections:{members:allowMembers,meetings:allowMeetings,absences:allowAbsences,fines:allowFines,cash:allowCash},members,meetings,fines,payments,cashbook};
}
async function publishPublic(ask=true){
 if(publishing)return;
 if(!cloudReady||!cloudUser)throw Error('Zuerst als Administrator verbinden und synchronisieren.');
 const opts=publicSettings();
 if(!opts.members&&!opts.meetings&&!opts.fines&&!opts.cash)throw Error('Bitte mindestens einen Bereich freigeben.');
 if(ask && !confirm('Diese Inhalte werden für registrierte, von dir verknüpfte Leser sichtbar. Bei sensiblen Angaben die Zustimmung beachten. Veröffentlichen?'))return;
 publishing=true;
 try{
  if(cloudDirty){await cloudUpload();if(cloudDirty)throw Error('Bitte zuerst den Cloud-Konflikt klären.');}
  const doc=publicSnapshot(opts);
  const {data:rows,error}=await cloudClient.from('fantastix_public')
   .update({content:doc,is_published:true,published_at:doc.publishedAt})
   .eq('id','main').select('is_published');
  if(error)throw error;
  if(!rows||rows.length!==1)throw Error('Keine Berechtigung zum Veröffentlichen.');
  publicPublished=true;syncMessage='Leseransicht aktualisiert';render();
 }finally{publishing=false;}
}
async function unpublishPublic(){
 if(!cloudReady)throw Error('Bitte Administrator anmelden.');
 if(!confirm('Leserfreigabe deaktivieren? Die bisherigen Daten bleiben privat gespeichert.'))return;
 const {data:rows,error}=await cloudClient.from('fantastix_public').update({is_published:false,published_at:null}).eq('id','main').select('is_published');
 if(error)throw error;if(!rows||rows.length!==1)throw Error('Keine Administratorberechtigung.');
 publicPublished=false;const opts=publicSettings();opts.auto=false;savePublicSettings(opts);syncMessage='Leseransicht deaktiviert';render();
}


/* Interaktionen */
document.addEventListener('click',async ev=>{const el=ev.target.closest('[data-action],[data-page]');if(!el)return;
 const action=el.dataset.action,id=el.dataset.id;if(el.dataset.page){page=el.dataset.page;render();window.scrollTo({top:0,behavior:'instant'});return;}
 switch(action){case'close':closeModal();break;case'member-new':memberForm();break;case'member-edit':memberForm(id);break;case'bulk-2026':bulk2026Form();break;case'meeting-new':if(!data.members.filter(m=>m.active!==false).length){alert('Bitte zuerst ein aktives Mitglied anlegen.');memberForm();}else meetingForm();break;case'meeting-edit':meetingForm(id);break;case'attend':attStatus(id,el.dataset.status);break;case'fine-new':fineForm();break;case'fine-pay':payForm(id);break;case'fine-view':fineView(id);break;case'cash-balance':cashBalanceForm();break;case'cash-expense':cashExpenseForm();break;case'cash-settings':cashSettingsForm();break;case'cash-reverse':{const tx=cash().transactions.find(t=>t.id===id);if(tx&&['expense','adjustment'].includes(tx.type)&&confirm('Diese Buchung stornieren?')){cash().transactions=cash().transactions.filter(t=>t.id!==id);persist();}break;}case'rank-year':rankYear=el.dataset.year;render();break;case'export-json':exportJSON();break;case'share-json':await shareJSON();break;case'snapshot-list':await snapshotList();break;case'snapshot-restore':await snapshotRestore(el.dataset.snapshot);break;
 case'meeting-delete':{const m=data.meetings.find(x=>x.id===id),linked=data.fines.filter(f=>f.meetingId===id);if(!m)break;if(linked.some(f=>finePaid(f.id)>0))return alert('Stammtisch mit bereits bezahlten Strafen kann nicht gelöscht werden.');if(confirm('Diesen Stammtisch und seine unbezahlten Abwesenheitsstrafen endgültig löschen?')){data.meetings=data.meetings.filter(x=>x.id!==id);data.fines=data.fines.filter(f=>f.meetingId!==id);closeModal();persist();}break;}
 case'payment-delete':{const p=data.payments.find(x=>x.id===id);if(p&&confirm('Diese Zahlung stornieren? Der Betrag wird wieder offen.')){const fid=p.fineId;data.payments=data.payments.filter(x=>x.id!==id);closeModal();persist();fineView(fid);}break;}
 case'fine-delete':{const f=data.fines.find(x=>x.id===id);if(f&&!finePaid(f.id)&&confirm('Diese noch unbezahlte Strafe löschen?')){data.fines=data.fines.filter(x=>x.id!==id);closeModal();persist();}break;}
 case'reader-access':await readerAccess();break;case'vote-settings':voteSettingsForm();break;case'cloud-setup':cloudForm();break;
 case'cloud-check':closeModal();await syncCloud();break;
 case'cloud-choose':closeModal();await syncCloud();break;
 case'cloud-download':if(pendingRemote&&confirm('Lokale Daten durch den Cloud-Stand ersetzen? Vorher JSON sichern!')){adoptCloud(pendingRemote);pendingRemote=null;closeModal();}break;
 case'cloud-upload':if(confirm('Lokale Daten als Cloud-Stand speichern? Der vorherige Cloud-Stand wird ersetzt.')){try{await cloudUpload(true);pendingRemote=null;closeModal();render();}catch(e){alert('Upload fehlgeschlagen: '+e.message)}}break;
 case'cloud-unpublish':try{await unpublishPublic();closeModal();cloudForm();}catch(e){alert(e.message);}break;
 case'cloud-logout':if(cloudClient&&confirm('Administrator abmelden? Lokale Daten bleiben auf diesem Gerät.')){await cloudClient.auth.signOut();cloudUser=null;cloudReady=false;cloudStatus='local';syncMessage='Abgemeldet';closeModal();render();}break;
 }
});
$('#dialog').addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.target,fd=new FormData(form);switch(form.dataset.form){case'member':saveMember(fd);break;case'bulk-2026':saveBulk2026(fd);break;case'meeting':saveMeeting(fd);break;case'fine':saveFine(fd);break;case'payment':savePayment(fd);break;case'cash-balance':saveCashBalance(fd);break;case'cash-expense':saveCashExpense(fd);break;case'cash-settings':saveCashSettings(fd);break;case'cloud-auth':await cloudAuth(fd);break;
 case'reader-access':await saveReaderAccess(fd);break;case'vote-settings':saveVoteSettings(fd);break;case'public-settings':{
  const opts={members:fd.has('members'),meetings:fd.has('meetings'),absences:fd.has('absences')&&fd.has('meetings'),fines:fd.has('fines'),cash:fd.has('cash'),auto:fd.has('auto')};
  if(!opts.members&&!opts.meetings&&!opts.fines&&!opts.cash){alert('Bitte mindestens einen Datenbereich auswählen.');break;}
  if(!cloudReady){alert('Bitte zuerst mit der Cloud synchronisieren.');break;}
  if(!confirm('Achtung: Die ausgewählten Inhalte sind für deine freigegebenen Leser sichtbar, einschließlich eventuell sensibler Daten. Wirklich freigeben?'))break;
  savePublicSettings(opts);
  try{await publishPublic(false);closeModal();alert('Leseransicht aktualisiert.');}
  catch(e){alert('Veröffentlichen fehlgeschlagen: '+e.message);}
  break;
 }}});
document.addEventListener('change',async e=>{const t=e.target;if(t?.name==='organizerId'&&t.matches('[data-organizer-auto]')){t.dataset.organizerAuto='off';return;}if(t?.name==='date'&&t.closest('form[data-form="meeting"]')){const form=t.closest('form');const chooser=form.querySelector('[name="organizerId"]');if(chooser?.dataset.organizerAuto==='on'){const meetingId=form.querySelector('[name="id"]')?.value||'';chooser.value=suggestedOrganizer(t.value,meetingId)?.id||'';}return;}if(t?.id!=='backupFile')return;
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>10*1024*1024)throw Error('Die Sicherung ist größer als 10 MB.');
  const imported=validateBackup(JSON.parse(await file.text()));
  if(!confirm('Vorhandene Daten durch dieses JSON-Backup ersetzen? Eine neue lokale Sicherung wird vorher angelegt.'))return;
  await queueSnapshot(data);
  data=imported;ensureCashbook(data);
  persist();postMonthlyContributions();
  alert('Import abgeschlossen. Bei aktiver Cloud-Synchronisierung werden die Änderungen hochgeladen.');
 }catch(err){alert('Import nicht möglich: '+(err.message||String(err)));}
});
window.addEventListener('online',()=>{if(cloudUser)syncCloud()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){postMonthlyContributions();if(cloudUser)syncCloud();}});
if(ensureCashbook(data)){try{localStorage.setItem(DATA_KEY,JSON.stringify(data));}catch(e){console.warn('Kassa-Migration konnte nicht gesichert werden:',e);}}
postMonthlyContributions();render();readSnapshots().then(v=>{snapshotCount=v.length;if(v.length){snapshotStatus='Letzter Sicherungsstand: '+new Date(v[0].savedAt).toLocaleString('de-AT');}else if(data.members.length||data.meetings.length||data.fines.length||data.payments.length){queueSnapshot(data);}if(page==='settings')render();}).catch(e=>{snapshotError=true;snapshotStatus='Lokale Sicherung nicht verfügbar: '+(e.message||String(e));});if(getCloudConfig())connectCloud();
if('serviceWorker'in navigator && window.isSecureContext){navigator.serviceWorker.register('./service-worker.js').catch(console.warn);}
