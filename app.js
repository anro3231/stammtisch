/* Stammtisch+ – private, installierbare Web-App (ohne Build-Tools) */
const DATA_KEY = 'stammtischplus.data.v1';
const CLOUD_KEY = 'stammtischplus.cloud.v1';
const BASELINE_KEY = 'stammtischplus.cloud.baseline.v1';
const SNAP_DB = 'stammtischplus-local-snapshots-v1';
const SNAP_STORE = 'versions';
const SNAP_LIMIT = 50;
const APP_VERSION = '3.4.0';
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
function loadData(){try{const raw=localStorage.getItem(DATA_KEY);return raw?assertData(JSON.parse(raw)):DEFAULT();}catch(err){alert('Gespeicherte Daten konnten nicht geladen werden. Bitte keine neuen Daten speichern, bevor eine Sicherung geprüft wurde.');return DEFAULT();}}
let data=loadData(), page='home', rankYear=String(new Date().getFullYear()), cloudClient=null, cloudUser=null, cloudBusy=false, syncTimer=null, syncMessage='Nur auf diesem iPhone', cloudStatus='local';
let snapshotStatus='Noch keine automatische lokale Sicherung', snapshotCount=0, snapshotError=false;
let snapshotWriteQueue=Promise.resolve();
function openSnapshotDB(){return new Promise((resolve,reject)=>{if(!('indexedDB' in window))return reject(Error('Dieser Browser unterstützt keine lokalen Sicherungsversionen.'));const req=indexedDB.open(SNAP_DB,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(SNAP_STORE))db.createObjectStore(SNAP_STORE,{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('Datenbank konnte nicht geöffnet werden.'));});}
async function readSnapshots(){const db=await openSnapshotDB();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(SNAP_STORE,'readonly');const r=tx.objectStore(SNAP_STORE).getAll();r.onsuccess=()=>resolve(r.result.sort((a,b)=>b.id-a.id));r.onerror=()=>reject(r.error);});}finally{db.close();}}
async function putSnapshot(payload){const copy=JSON.parse(JSON.stringify(assertData(payload)));const db=await openSnapshotDB();try{const saved=await new Promise((resolve,reject)=>{const tx=db.transaction(SNAP_STORE,'readwrite');const store=tx.objectStore(SNAP_STORE);const entry={id:Date.now()*1000+Math.floor(Math.random()*1000),savedAt:new Date().toISOString(),data:copy};store.put(entry);tx.oncomplete=()=>resolve(entry);tx.onerror=()=>reject(tx.error||Error('Lokale Sicherung fehlgeschlagen.'));tx.onabort=()=>reject(tx.error||Error('Lokale Sicherung abgebrochen.'));});const versions=await readSnapshots();if(versions.length>SNAP_LIMIT){await new Promise((resolve,reject)=>{const tx=db.transaction(SNAP_STORE,'readwrite');const store=tx.objectStore(SNAP_STORE);versions.slice(SNAP_LIMIT).forEach(x=>store.delete(x.id));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}snapshotCount=Math.min(versions.length,SNAP_LIMIT);snapshotStatus='Letzter Sicherungsstand: '+new Date(saved.savedAt).toLocaleString('de-AT');snapshotError=false;return saved;}finally{db.close();}}
function queueSnapshot(payload){const captured=JSON.parse(JSON.stringify(payload));snapshotWriteQueue=snapshotWriteQueue.catch(()=>{}).then(()=>putSnapshot(captured)).catch(e=>{snapshotError=true;snapshotStatus='Lokale Sicherung fehlgeschlagen: '+(e.message||String(e));console.warn(snapshotStatus);});return snapshotWriteQueue;}
function persist(){ensureCashbook(data);data.modifiedAt=new Date().toISOString();const serialized=JSON.stringify(data);try{localStorage.setItem(DATA_KEY,serialized);}catch(e){alert('Speichern fehlgeschlagen. Bitte exportiere deine Daten als JSON und prüfe den Gerätespeicher.');throw e;}queueSnapshot(data);render();queueSync();}
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
function stats(id,year){const meetings=data.meetings.filter(m=>doneMeeting(m)&&(!year||yearOf(m.date)===String(year)));const present=meetings.filter(m=>m.attendance?.[id]?.status==='present').length;const eligible=meetings.filter(m=>Object.hasOwn(m.attendance||{},id)).length;return {present,eligible,pct:eligible?Math.round(100*present/eligible):0};}
function allTime(id){return n(member(id)?.historicalCount)+stats(id).present;}
function rankRows(year){return [...data.members].sort((a,b)=>(year?yearCount(b.id,year)-yearCount(a.id,year):allTime(b.id)-allTime(a.id))||a.name.localeCompare(b.name,'de')).map((m,i)=>({...m,place:i+1,count:year?yearCount(m.id,year):allTime(m.id),pct:stats(m.id,year).pct}));}
function icon(k){const paths={home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1z"/>',meetings:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 15l2 2 5-5"/>',members:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',ranking:'<path d="M8 21h8M12 17v4M7 4h10v7a5 5 0 0 1-10 0V4ZM7 6H3v2a4 4 0 0 0 4 4M17 6h4v2a4 4 0 0 1-4 4"/>',fines:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 15h2M7 3v2"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.3 2.3-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-3.2v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-2.3-2.3.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4v-3.2h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.3-2.3.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V4h3.2v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.3 2.3-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v3.2h-.2a1.7 1.7 0 0 0-1.6 1z"/>',cloud:'<path d="M20 16.6a4 4 0 0 0-2-7.5A6 6 0 0 0 6.4 10 4 4 0 0 0 7 18h11"/><path d="m10 15 2 2 4-4"/>'};return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[k]||paths.home}</svg>`;}
const navItems=[['home','Start'],['meetings','Stammtisch'],['members','Mitglieder'],['ranking','Rangliste'],['fines','Kassa'],['settings','Mehr']];
function render(){document.querySelector('#nav').innerHTML=navItems.map(([key,label])=>`<button class="navbutton ${page===key?'active':''}" type="button" data-page="${key}" aria-label="${label}">${icon(key)}<span>${label}</span></button>`).join('');const renderers={home:homeHTML,meetings:meetingsHTML,members:membersHTML,ranking:rankingHTML,fines:finesHTML,settings:settingsHTML};$('#app').innerHTML=`<div class="top"><div class="brand"><img class="brand-logo" src="./fantastix-logo.png" alt="FantastiX Logo"><div><strong>FantastiX</strong><span class="version-tag">Version ${APP_VERSION}</span></div></div><button class="ghost tiny" data-page="settings" type="button"><span class="status ${cloudStatus==='connected'?'good':''}"></span>${cloudStatus==='connected'?'Cloud aktiv':'Lokal'}</button></div>${renderers[page]()}`;}
function pageHead(eyebrow,title,description){return `<div class="eyebrow">${eyebrow}</div><h1 class="title">${title}</h1>${description?`<p class="subtitle">${description}</p>`:''}`;}
function empty(emoji,text,sub=''){return `<div class="empty"><div class="emoji">${emoji}</div><strong>${text}</strong>${sub?`<p class="hint">${sub}</p>`:''}</div>`;}
function homeHTML(){
  const completed=data.meetings.filter(doneMeeting).sort((a,b)=>b.date.localeCompare(a.date));
  const latest=completed.slice(0,4),next=upcomingMeeting(),days=next?calendarDaysUntil(next.date):null;
  const finesTotal=data.fines.reduce((sum,f)=>sum+n(f.amountCents),0);
  const paid=data.payments.reduce((sum,p)=>sum+n(p.amountCents),0);
  const leader=yearLeader();
  const organizer=next?member(next.organizerId):suggestedOrganizer(today());
  return `${pageHead('','Dashboard','')}
    <div class="metric-grid dashboard-stats">
      <div class="metric"><small>Stammtische gesamt</small><div class="value">${DASHBOARD_MEETING_START+completed.length}</div></div>
      <div class="metric"><small>Offene Strafen</small><div class="value red">${money(finesTotal-paid)}</div></div>
      <div class="metric"><small>Tage bis zum nächsten</small><div class="value">${days===null?'–':days}</div></div>
      <div class="metric"><small>Jahresführender ${yearOf(today())}</small><div class="value leader-name">${leader?esc(leader.name):'–'}</div><small>${leader?`${leader.count} Teilnahmen`:''}</small></div>
    </div>
    <section class="card next-card"><div class="row"><h2>Nächster Stammtisch</h2><span class="chip">${days===null?'Nicht geplant':days===0?'Heute':`In ${days} Tagen`}</span></div>
      ${next?`<strong class="next-date">${fmtDate(next.date)}</strong><p class="next-place">${esc(next.location||'Gasthaus noch offen')}</p><p class="muted tiny">${organizer?'Organisator: '+esc(organizer.name):''}</p><button class="ghost" data-action="meeting-edit" data-id="${next.id}">Stammtisch öffnen</button>`:'<p class="muted">Noch kein nächster Stammtisch eingetragen.</p><button class="button" data-action="meeting-new">+ Stammtisch planen</button>'}
    </section>
    <div class="toolbar"><button class="button" data-action="meeting-new">+ Stammtisch</button><button class="ghost" data-action="member-new">+ Mitglied</button></div>
    <div class="cols-main"><section class="card"><h2>Letzte Stammtische</h2>${latest.length?`<div class="list">${latest.map(m=>`<div class="item"><div class="avatar">${String(new Date(m.date+'T12:00:00').getDate()).padStart(2,'0')}</div><div class="details"><strong>${fmtDate(m.date)}</strong><small>${esc(m.location||'Ohne Gasthaus')} · ${Object.values(m.attendance||{}).filter(a=>a.status==='present').length} anwesend</small></div><button class="smallbtn" data-action="meeting-edit" data-id="${m.id}">Öffnen</button></div>`).join('')}</div>`:empty('📅','Noch keine Stammtische')}</section>
    <section class="card"><h2>Top 3 · Ewig</h2>${data.members.length?`<div class="list">${rankRows(null).slice(0,3).map((m,i)=>`<div class="item"><span style="font-size:22px">${['🥇','🥈','🥉'][i]}</span><div class="details"><strong>${esc(m.name)}</strong><small>${m.count} Teilnahmen</small></div><strong class="number">${m.count}</strong></div>`).join('')}</div>`:empty('🏆','Noch keine Platzierungen')}<div class="separator"></div><button class="ghost" data-page="ranking">Ranglisten öffnen</button></section></div>`;
}
function membersHTML(){const members=[...data.members].sort(byMemberNo);return `${pageHead('','Mitglieder','')}<div class="toolbar"><button class="button" data-action="member-new">+ Mitglied</button><button class="ghost" data-action="bulk-2026">Teilnahmen 2026</button><span class="muted tiny">${data.members.length} Mitglieder</span></div><div class="card">${members.length?`<div class="list">${members.map(m=>`<div class="item"><div class="avatar">${memberNo(m)===null?esc(initials(m.name)):memberNo(m)}</div><div class="details"><strong>${memberNo(m)===null?'':`Nr. ${memberNo(m)} · `}${esc(m.name)} ${m.active===false?'<span class="chip gray">Archiv</span>':''}</strong><small>2026: ${yearCount(m.id,'2026')} · Ewig: ${allTime(m.id)}</small></div><button class="smallbtn" data-action="member-edit" data-id="${m.id}">Bearbeiten</button></div>`).join('')}</div>`:empty('👥','Noch keine Mitglieder')}</div>`;}
function meetingsHTML(){
  const meetings=[...data.meetings].sort((a,b)=>b.date.localeCompare(a.date)),next=suggestedOrganizer(today());
  return `${pageHead('','Stammtische','')}<div class="toolbar"><button class="button" data-action="meeting-new">+ Neuer Stammtisch</button></div>
  <div class="notice">Nächster Organisator: <strong>${next?`Nr. ${memberNo(next)} · ${esc(next.name)}`:'–'}</strong></div>
  <div class="card">${meetings.length?`<div class="list">${meetings.map(m=>{const a=Object.values(m.attendance||{}),organizer=member(m.organizerId);return `<div class="item"><div class="avatar">${esc(String(new Date(m.date+'T12:00:00').getDate()).padStart(2,'0'))}</div><div class="details"><strong>${fmtDate(m.date)}</strong><small>${esc(m.location||'Kein Gasthaus')} · ${organizer?`Organisator: ${esc(organizer.name)}`:'Organisator offen'}<br>${a.filter(x=>x.status==='present').length} da · ${a.filter(x=>x.status==='absent').length} fehlt · ${data.members.filter(p=>p.active!==false&&!m.attendance?.[p.id]).length} offen</small></div><span class="chip ${doneMeeting(m)?'':'gray'}">${doneMeeting(m)?'Vergangen':'Geplant'}</span><button class="smallbtn" data-action="meeting-edit" data-id="${m.id}">Öffnen</button></div>`}).join('')}</div>`:empty('📅','Keine Stammtische')}</div>`;
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
 const cfg=getCloudConfig(),sync=cloudStatus==='connected'?`<span class="chip">Verbunden</span>`:cloudStatus==='error'?`<span class="chip red">Fehler</span>`:`<span class="chip gray">Lokal</span>`;
 return `${pageHead('','Mehr','')}<section class="card"><div class="row"><h2>FantastiX</h2><span class="version-tag">Version ${APP_VERSION}</span></div></section>
 <section class="card"><div class="row"><h2>Cloud</h2>${sync}</div><div class="stack"><button class="button" data-action="cloud-setup">${cfg?'Cloud verwalten':'Cloud einrichten'}</button>${cloudUser?`<button class="ghost" data-action="cloud-check">Jetzt synchronisieren</button>`:''}</div></section>
 <section class="card"><h2>Sicherungen</h2><div class="stack"><button class="ghost" data-action="snapshot-list">Lokale Versionen</button><button class="button" data-action="share-json">Backup teilen</button><button class="ghost" data-action="export-json">JSON exportieren</button><label class="ghost" style="text-align:center;cursor:pointer;margin:0">JSON importieren<input id="backupFile" type="file" accept="application/json,.json" style="display:none"></label></div>${snapshotError?`<div class="hint" role="alert">${esc(snapshotStatus)}</div>`:''}</section>`;
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
 <div class="field"><label>Gasthaus</label><input name="location" maxlength="120" value="${esc(m.location)}" placeholder="Gasthaus auswählen oder eingeben" style="width:100%"></div>
 <div class="field"><label>Organisator</label><select name="organizerId" data-organizer-auto="${id?'off':'on'}"><option value="">Nicht festgelegt</option>${organizerMembers.map(person=>`<option value="${person.id}" ${proposed===person.id?'selected':''}>${memberNo(person)!==null?'Nr. '+memberNo(person)+' · ':''}${esc(person.name)}</option>`).join('')}</select></div>
 <div class="field"><label>Notizen</label><textarea name="notes" maxlength="1000" placeholder="Optional">${esc(m.notes||'')}</textarea></div>
 <h3>Anwesenheit</h3>
 ${attendanceMembers.length?attendanceMembers.map(person=>{const entry=m.attendance?.[person.id]||{};const linkedFine=data.fines.find(f=>f.meetingId===m.id&&f.memberId===person.id&&f.source==='absence');return `<div class="member-att"><div class="row"><strong>${memberNo(person)!==null?'Nr. '+memberNo(person)+' · ':''}${esc(person.name)}</strong><div class="seg"><button type="button" class="${entry.status==='present'?'on yes':''}" data-action="attend" data-id="${person.id}" data-status="present">✓ Da</button><button type="button" class="${entry.status==='absent'?'on no':''}" data-action="attend" data-id="${person.id}" data-status="absent">× Fehlt</button></div></div><input type="hidden" name="status-${person.id}" value="${esc(entry.status||'')}">${absenceFields(person.id,entry,linkedFine)}</div>`}).join(''):empty('👥','Noch keine Mitglieder')}
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
 const record={id:mtId,date,location,notes,organizerId:organizerId||null,finalized:true,attendance,createdAt:previousMeeting?.createdAt||new Date().toISOString()};
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
function closeModal(){if($('#dialog').open)$('#dialog').close();}
function download(content,name,mime){const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);}
function exportJSON(){download(JSON.stringify(data,null,2),`FantastiX_Backup_${today()}.json`,'application/json;charset=utf-8');}
async function shareJSON(){const filename=`FantastiX_Backup_${today()}.json`;const file=new File([JSON.stringify(data,null,2)],filename,{type:'application/json'});try{if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'FantastiX Datensicherung'});return;}exportJSON();alert('Dein Browser hat die Sicherung heruntergeladen. Bitte speichere sie über die Dateien-App manuell unter iCloud Drive.');}catch(e){if(e.name!=='AbortError')alert('Teilen fehlgeschlagen: '+(e.message||String(e)));}}
async function snapshotList(){try{await snapshotWriteQueue;const versions=await readSnapshots();if(!versions.length)return alert('Noch keine Sicherungsstände vorhanden. Speichere zuerst eine Änderung in der App.');modal('Lokale Sicherungsstände',`<div class="notice warning">Diese Versionen liegen nur im Browser. Bei einer Wiederherstellung wird der aktuelle Datenstand ersetzt. Exportiere zur Sicherheit vorher eine JSON-Datei.</div><div class="stack" style="margin-top:12px"><button class="ghost" data-action="export-json">↓ Aktuelle Daten sichern</button>${versions.map((v,i)=>`<button class="ghost" data-action="snapshot-restore" data-snapshot="${v.id}">${new Date(v.savedAt).toLocaleString('de-AT')} · ${v.data.members.length} Mitglieder · ${v.data.meetings.length} Stammtische</button>`).join('')}</div>`);}catch(e){alert('Sicherungsstände konnten nicht gelesen werden: '+(e.message||String(e)));}}
async function snapshotRestore(id){try{await snapshotWriteQueue;const versions=await readSnapshots();const v=versions.find(x=>x.id===Number(id));if(!v)return alert('Sicherungsstand nicht mehr vorhanden.');if(!confirm('Alle aktuellen Daten durch den Stand vom '+new Date(v.savedAt).toLocaleString('de-AT')+' ersetzen?'))return;await queueSnapshot(data);data=assertData(structuredClone(v.data));ensureCashbook(data);closeModal();persist();postMonthlyContributions();if(cloudUser){localStorage.removeItem(BASELINE_KEY);await syncCloud();}alert('Sicherungsstand lokal wiederhergestellt. Bitte Cloud-Konflikte ggf. prüfen.');}catch(e){alert('Wiederherstellen fehlgeschlagen: '+(e.message||String(e)));}}

/* Optionale persönliche Cloud: Supabase Auth + RLS-geschützter JSON-Datensatz */
const getCloudConfig=()=>{try{return JSON.parse(localStorage.getItem(CLOUD_KEY)||'null')}catch{return null}};
let pendingRemote=null;
async function initCloudClient(){const cfg=getCloudConfig();if(!cfg?.url||!cfg?.key)throw Error('Bitte zunächst Cloud-URL und Publishable Key eintragen.');if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.url.trim()))throw Error('Ungültige Supabase-Projekt-URL.');const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');cloudClient=createClient(cfg.url.trim().replace(/\/$/,''),cfg.key.trim(),{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});return cloudClient;}
function cloudForm(){const cfg=getCloudConfig()||{};modal('Cloud',`<form data-form="cloud-config"><div class="field"><label>Supabase-URL</label><input type="url" name="url" value="${esc(cfg.url||'')}" placeholder="https://deinprojekt.supabase.co" required></div><div class="field"><label>Anon Key</label><input name="key" value="${esc(cfg.key||'')}" placeholder="sb_publishable_…" required></div>${footer('Speichern')}</form>${cfg.url?`<div class="separator"></div>${cloudUser?`<div class="notice">Angemeldet: ${esc(cloudUser.email||'')}</div><div class="toolbar"><button class="ghost" data-action="cloud-check">Jetzt synchronisieren</button><button class="danger-btn" data-action="cloud-logout">Abmelden</button></div>`:`<form data-form="cloud-auth"><div class="field"><label>E-Mail</label><input type="email" name="email" required autocomplete="email"></div><div class="field"><label>Passwort</label><input type="password" name="password" required minlength="6" autocomplete="current-password"></div><div class="stack"><button class="button" type="submit" name="mode" value="login">Anmelden</button><button class="ghost" type="submit" name="mode" value="signup">Konto erstellen</button></div></form>`}`:''}`);}
async function connectCloud(silent=true){if(cloudBusy)return;cloudBusy=true;try{await initCloudClient();const {data:auth,error}=await cloudClient.auth.getSession();if(error)throw error;cloudUser=auth.session?.user||null;if(cloudUser)await syncCloud(true);else {cloudStatus='local';syncMessage='Cloud konfiguriert, bitte anmelden';}}catch(e){cloudStatus='error';syncMessage=e.message||String(e);if(!silent)alert('Cloud-Verbindung: '+syncMessage);}finally{cloudBusy=false;render();}}
async function cloudAuth(fd,mode){if(!cloudClient){try{await initCloudClient()}catch(e){alert(e.message);return;}}const email=String(fd.get('email')||'').trim(),password=String(fd.get('password')||'');try{const auth=mode==='signup'?await cloudClient.auth.signUp({email,password}):await cloudClient.auth.signInWithPassword({email,password});if(auth.error)throw auth.error;if(!auth.data.session){alert('Registrierung durchgeführt. Bitte bestätige gegebenenfalls deine E-Mail und melde dich danach an.');return;}cloudUser=auth.data.user;cloudStatus='connected';closeModal();await syncCloud(true);render();}catch(e){alert('Anmeldung fehlgeschlagen: '+e.message);}}
async function cloudUpload(){if(!cloudClient||!cloudUser)return;const {error}=await cloudClient.from('stammtisch_documents').upsert({owner_id:cloudUser.id,content:data,updated_at:new Date().toISOString()},{onConflict:'owner_id'});if(error)throw error;localStorage.setItem(BASELINE_KEY,data.modifiedAt);cloudStatus='connected';syncMessage='Synchronisiert am '+new Date().toLocaleString('de-AT');}
function adoptCloud(d){queueSnapshot(data);data=assertData(structuredClone(d));ensureCashbook(data);localStorage.setItem(DATA_KEY,JSON.stringify(data));queueSnapshot(data);localStorage.setItem(BASELINE_KEY,data.modifiedAt);cloudStatus='connected';syncMessage='Cloud-Daten übernommen';render();postMonthlyContributions();}
const hasData=d=>!!(d.members.length||d.meetings.length||d.fines.length||d.payments.length||d.cashbook?.transactions?.length||d.cashbook?.openingBalanceCents);
async function syncCloud(fromConnect=false){if(!cloudClient||!cloudUser||!navigator.onLine){if(!navigator.onLine){syncMessage='Offline – Änderungen bleiben lokal gespeichert';render();}return;}try{const {data:record,error}=await cloudClient.from('stammtisch_documents').select('content').eq('owner_id',cloudUser.id).maybeSingle();if(error)throw error;const remote=record?.content;if(!remote){await cloudUpload();render();return;}assertData(remote);const baseline=localStorage.getItem(BASELINE_KEY);if(!baseline){if(!hasData(data)){adoptCloud(remote);return;}if(!hasData(remote)){await cloudUpload();render();return;}if(data.modifiedAt===remote.modifiedAt){localStorage.setItem(BASELINE_KEY,data.modifiedAt);cloudStatus='connected';render();return;}pendingRemote=remote;conflictModal('Auf diesem iPhone und in der Cloud liegen Daten. Welche Version möchtest du behalten?');return;}const localChanged=data.modifiedAt!==baseline,remoteChanged=remote.modifiedAt!==baseline;
 if(remoteChanged&&localChanged&&remote.modifiedAt!==data.modifiedAt){pendingRemote=remote;conflictModal('Die Daten wurden auf zwei Geräten geändert. Bitte wähle bewusst, welche Version bleiben soll.');return;}if(remoteChanged&&!localChanged){adoptCloud(remote);return;}if(localChanged&&!remoteChanged){await cloudUpload();render();return;}cloudStatus='connected';syncMessage='Alle Änderungen synchronisiert';render();}catch(e){cloudStatus='error';syncMessage=e.message||String(e);render();if(!fromConnect)alert('Cloud-Sync fehlgeschlagen: '+syncMessage);}}
function conflictModal(info){modal('Cloud-Daten auswählen',`<div class="notice warning">${esc(info)} Eine Auswahl ersetzt die andere Version. Vorher am besten ein JSON-Backup exportieren.</div><div class="stack" style="margin-top:16px"><button class="ghost" data-action="export-json">↓ Erst ein JSON-Backup herunterladen</button><button class="button" data-action="cloud-download">Cloud-Daten auf dieses iPhone laden</button><button class="danger-btn" data-action="cloud-upload">Lokale Daten in die Cloud hochladen</button></div>`);}
function queueSync(){if(!cloudUser)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncCloud(),1200);}

/* Interaktionen */
document.addEventListener('click',async ev=>{const el=ev.target.closest('[data-action],[data-page]');if(!el)return;
 const action=el.dataset.action,id=el.dataset.id;if(el.dataset.page){page=el.dataset.page;render();window.scrollTo({top:0,behavior:'instant'});return;}
 switch(action){case'close':closeModal();break;case'member-new':memberForm();break;case'member-edit':memberForm(id);break;case'bulk-2026':bulk2026Form();break;case'meeting-new':if(!data.members.filter(m=>m.active!==false).length){alert('Bitte zuerst ein aktives Mitglied anlegen.');memberForm();}else meetingForm();break;case'meeting-edit':meetingForm(id);break;case'attend':attStatus(id,el.dataset.status);break;case'fine-new':fineForm();break;case'fine-pay':payForm(id);break;case'fine-view':fineView(id);break;case'cash-balance':cashBalanceForm();break;case'cash-expense':cashExpenseForm();break;case'cash-settings':cashSettingsForm();break;case'cash-reverse':{const tx=cash().transactions.find(t=>t.id===id);if(tx&&['expense','adjustment'].includes(tx.type)&&confirm('Diese Buchung stornieren?')){cash().transactions=cash().transactions.filter(t=>t.id!==id);persist();}break;}case'rank-year':rankYear=el.dataset.year;render();break;case'export-json':exportJSON();break;case'share-json':await shareJSON();break;case'snapshot-list':await snapshotList();break;case'snapshot-restore':await snapshotRestore(el.dataset.snapshot);break;
 case'meeting-delete':{const m=data.meetings.find(x=>x.id===id),linked=data.fines.filter(f=>f.meetingId===id);if(!m)break;if(linked.some(f=>finePaid(f.id)>0))return alert('Stammtisch mit bereits bezahlten Strafen kann nicht gelöscht werden.');if(confirm('Diesen Stammtisch und seine unbezahlten Abwesenheitsstrafen endgültig löschen?')){data.meetings=data.meetings.filter(x=>x.id!==id);data.fines=data.fines.filter(f=>f.meetingId!==id);closeModal();persist();}break;}
 case'payment-delete':{const p=data.payments.find(x=>x.id===id);if(p&&confirm('Diese Zahlung stornieren? Der Betrag wird wieder offen.')){const fid=p.fineId;data.payments=data.payments.filter(x=>x.id!==id);closeModal();persist();fineView(fid);}break;}
 case'fine-delete':{const f=data.fines.find(x=>x.id===id);if(f&&!finePaid(f.id)&&confirm('Diese noch unbezahlte Strafe löschen?')){data.fines=data.fines.filter(x=>x.id!==id);closeModal();persist();}break;}
 case'cloud-setup':cloudForm();break;case'cloud-check':closeModal();await syncCloud();break;case'cloud-download':if(pendingRemote&&confirm('Lokale Daten durch die Cloud-Version ersetzen?')){adoptCloud(pendingRemote);pendingRemote=null;closeModal();}break;
 case'cloud-upload':if(confirm('Cloud-Daten durch die lokale Version ersetzen?')){try{await cloudUpload();pendingRemote=null;closeModal();render();}catch(e){alert('Cloud-Upload fehlgeschlagen: '+e.message)}}break;
 case'cloud-logout':if(cloudClient&&confirm('Von der Cloud abmelden? Lokale Daten bleiben auf diesem iPhone.')){await cloudClient.auth.signOut();cloudUser=null;cloudStatus='local';syncMessage='Cloud abgemeldet';closeModal();render();}break;
 }
});
$('#dialog').addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.target,fd=new FormData(form);switch(form.dataset.form){case'member':saveMember(fd);break;case'bulk-2026':saveBulk2026(fd);break;case'meeting':saveMeeting(fd);break;case'fine':saveFine(fd);break;case'payment':savePayment(fd);break;case'cash-balance':saveCashBalance(fd);break;case'cash-expense':saveCashExpense(fd);break;case'cash-settings':saveCashSettings(fd);break;case'cloud-config':{const cfg={url:String(fd.get('url')||'').trim().replace(/\/$/,''),key:String(fd.get('key')||'').trim()};if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cfg.url))return alert('Bitte eine gültige https://…supabase.co Projekt-URL eingeben.');if(cfg.key.length<20)return alert('Bitte einen gültigen Publishable / anon Key eingeben.');const old=getCloudConfig();if(old?.url!==cfg.url||old?.key!==cfg.key){localStorage.removeItem(BASELINE_KEY);cloudClient=null;cloudUser=null;}localStorage.setItem(CLOUD_KEY,JSON.stringify(cfg));closeModal();await connectCloud(false);cloudForm();break;}case'cloud-auth':{const submitter=ev.submitter;await cloudAuth(fd,submitter?.value||'login');break;}}});
document.addEventListener('change',async e=>{const t=e.target;if(t?.name==='organizerId'&&t.matches('[data-organizer-auto]')){t.dataset.organizerAuto='off';return;}if(t?.name==='date'&&t.closest('form[data-form="meeting"]')){const form=t.closest('form');const chooser=form.querySelector('[name="organizerId"]');if(chooser?.dataset.organizerAuto==='on'){const meetingId=form.querySelector('[name="id"]')?.value||'';chooser.value=suggestedOrganizer(t.value,meetingId)?.id||'';}return;}if(t?.id!=='backupFile')return;const file=e.target.files?.[0];if(!file)return;try{const obj=assertData(JSON.parse(await file.text()));if(!confirm('Alle aktuellen Daten durch dieses Backup ersetzen? Vorher am besten selbst ein Backup herunterladen.'))return;await queueSnapshot(data);data=obj;ensureCashbook(data);localStorage.removeItem(BASELINE_KEY);persist();postMonthlyContributions();if(cloudUser)await syncCloud();alert('Backup wiederhergestellt.');}catch(err){alert('Import nicht möglich: '+err.message)}});
window.addEventListener('online',()=>{if(cloudUser)syncCloud()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){postMonthlyContributions();if(cloudUser)syncCloud();}});
if(ensureCashbook(data)){try{localStorage.setItem(DATA_KEY,JSON.stringify(data));}catch(e){console.warn('Kassa-Migration konnte nicht gesichert werden:',e);}}
postMonthlyContributions();render();readSnapshots().then(v=>{snapshotCount=v.length;if(v.length){snapshotStatus='Letzter Sicherungsstand: '+new Date(v[0].savedAt).toLocaleString('de-AT');}else if(data.members.length||data.meetings.length||data.fines.length||data.payments.length){queueSnapshot(data);}if(page==='settings')render();}).catch(e=>{snapshotError=true;snapshotStatus='Lokale Sicherung nicht verfügbar: '+(e.message||String(e));});if(getCloudConfig())connectCloud();
if('serviceWorker'in navigator && window.isSecureContext){navigator.serviceWorker.register('./service-worker.js').catch(console.warn);}
