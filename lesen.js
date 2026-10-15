/* Öffentliche FantastiX-Leseansicht. KEINE Verwaltungs- oder Schreibfunktionen. */
const $=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=x=>Math.max(0,Number.isFinite(+x)?Math.round(+x):0);
const money=c=>new Intl.NumberFormat('de-AT',{style:'currency',currency:'EUR'}).format((Number(c)||0)/100);
const dateLabel=s=>s?new Date(s+'T12:00:00').toLocaleDateString('de-AT',{day:'2-digit',month:'long',year:'numeric'}):'–';
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const currentYear=()=>today().slice(0,4);
let data=null,tab='dashboard',year=currentYear(),lastFetched='';
function daysUntil(s){const parts=s?.split('-').map(Number),t=today().split('-').map(Number);if(!parts||parts.length!==3)return null;return Math.max(0,Math.round((Date.UTC(parts[0],parts[1]-1,parts[2])-Date.UTC(t[0],t[1]-1,t[2]))/86400000));}
const member=id=>data?.members?.find(m=>m.id===id);
const memberName=id=>member(id)?.name||'Mitglied';
const stats=(id,y)=>data.meetings.filter(m=>m.date<=today()&&(!y||m.date.startsWith(y))&&m.attendance?.[id]?.status==='present').length;
const count=(m,y)=>y?stats(m.id,y)+(y==='2026'?n(m.historical2026Count):0):stats(m.id)+n(m.historicalCount);
const ranks=(y)=>[...data.members].map(m=>({...m,count:count(m,y)})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'de'));
const section=k=>!!data?.sections?.[k];
const empty=msg=>`<section class="card"><p class="muted">${esc(msg)}</p></section>`;
function heading(txt){return `<h1 class="title">${esc(txt)}</h1>`;}
function dashboard(){
 const complete=data.meetings.filter(m=>m.date<=today()),next=[...data.meetings].filter(m=>m.date>=today()).sort((a,b)=>a.date.localeCompare(b.date))[0];
 const leader=section('members')?ranks(currentYear()).find(m=>m.count>0):null;
 return `${heading('Übersicht')}<div class="metric-grid">
  ${section('meetings')?`<div class="metric"><small>Stammtische gesamt</small><div class="value">${150+complete.length}</div></div>
  <div class="metric"><small>Tage bis zum nächsten</small><div class="value">${next?daysUntil(next.date):'–'}</div></div>`:''}
  ${section('members')?`<div class="metric"><small>Jahresführender ${currentYear()}</small><div class="value leader-name">${leader?esc(leader.name):'–'}</div><small>${leader?leader.count+' Teilnahmen':''}</small></div>`:''}
  ${section('cash')?`<div class="metric"><small>Kontostand</small><div class="value">${money(data.cashbook?.balanceCents)}</div></div>`:''}
 </div>${next?`<section class="card next-card"><h2>Nächster Stammtisch</h2><strong class="next-date">${dateLabel(next.date)}</strong><div>${esc(next.location||'Gasthaus noch offen')}</div>${section('members')?`<p class="muted">Organisator: ${esc(memberName(next.organizerId))}</p>`:''}</section>`:''}
 <section class="card"><h2>Freigegebene Ansicht</h2><p class="hint">Stand: ${esc(dateTime(data.publishedAt||lastFetched))}</p></section>`;
}
function dateTime(s){if(!s)return '–';const d=new Date(s);return Number.isNaN(d.valueOf())?'–':d.toLocaleString('de-AT');}
function meetings(){
 if(!section('meetings'))return empty('Stammtische sind nicht freigegeben.');
 const items=[...data.meetings].sort((a,b)=>b.date.localeCompare(a.date));
 return `${heading('Stammtische')}${items.length?items.map(m=>`<section class="card">
   <div class="row"><h2>${dateLabel(m.date)}</h2><span class="chip">${m.date>today()?'Geplant':'Vergangen'}</span></div>
   <p>${esc(m.location||'Gasthaus offen')}</p>
   ${section('members')?`<p class="muted tiny">Organisator: ${esc(memberName(m.organizerId))}</p>`:''}
   <div class="separator"></div>
   <div class="list">${Object.entries(m.attendance||{}).map(([id,a])=>`<div class="item"><div class="details"><strong>${esc(memberName(id))}</strong>
     ${section('absences')&&a.status==='absent'?(a.reason?`<small>Grund: ${esc(a.reason)}</small>`:'')+(a.note?`<small>${esc(a.note)}</small>`:''):''}
     </div><span class="chip ${a.status==='present'?'':'gray'}">${a.status==='present'?'Da':'Fehlt'}</span></div>`).join('')||'<p class="muted">Noch keine Anwesenheiten eingetragen</p>'}</div>
   ${section('absences')&&m.notes?`<p class="hint">${esc(m.notes)}</p>`:''}
  </section>`).join(''):empty('Noch keine Stammtische.')}`;
}
function members(){
 if(!section('members'))return empty('Mitglieder sind nicht freigegeben.');
 return `${heading('Mitglieder')}<section class="card"><div class="list">${[...data.members].sort((a,b)=>(a.memberNumber??99999)-(b.memberNumber??99999)).map(m=>`<div class="item"><div class="avatar">${esc(m.memberNumber||m.name.slice(0,1).toUpperCase())}</div><div class="details"><strong>${esc(m.name)}</strong><small>2026: ${count(m,'2026')} · Ewig: ${count(m,null)}</small></div></div>`).join('')||'<p>Keine Mitglieder</p>'}</div></section>`;
}
function ranking(){
 if(!section('members'))return empty('Ranglisten sind nicht freigegeben.');
 const years=[...new Set(['2026',currentYear(),...data.meetings.map(m=>m.date.slice(0,4))])].sort().reverse();
 return `${heading('Ranglisten')}<div class="card"><div class="pill-group"><button class="pill ${year==='all'?'selected':''}" data-year="all">Ewig</button>${years.map(y=>`<button class="pill ${year===y?'selected':''}" data-year="${y}">${y}</button>`).join('')}</div><div class="separator"></div><div class="tablewrap"><table class="table"><thead><tr><th>Platz</th><th>Mitglied</th><th>Teilnahmen</th></tr></thead><tbody>${ranks(year==='all'?null:year).map((m,i)=>`<tr><td>${i+1}.</td><td>${esc(m.name)}</td><td><strong>${m.count}</strong></td></tr>`).join('')}</tbody></table></div></div>`;
}
function fines(){
 if(!section('fines'))return empty('Strafen sind nicht freigegeben.');
 const fined=data.fines.reduce((s,f)=>s+n(f.amountCents),0),paid=data.payments.reduce((s,p)=>s+n(p.amountCents),0);
 return `${heading('Strafen')}<div class="metric-grid"><div class="metric"><small>Strafen</small><div class="value">${money(fined)}</div></div><div class="metric"><small>Eingesammelt</small><div class="value">${money(paid)}</div></div><div class="metric"><small>Offen</small><div class="value">${money(fined-paid)}</div></div></div>
 <section class="card"><h2>Einzelne Strafen</h2><div class="list">${data.fines.map(f=>{const amount=data.payments.filter(p=>p.fineId===f.id).reduce((s,p)=>s+n(p.amountCents),0);return `<div class="item"><div class="details"><strong>${esc(memberName(f.memberId))}</strong><small>${esc(f.reason||'Strafe')}</small></div><div class="right"><strong>${money(f.amountCents)}</strong><small class="muted">${money(f.amountCents-amount)} offen</small></div></div>`}).join('')||'<p>Keine Strafen</p>'}</div></section>
 <section class="card"><h2>Einzahlungen</h2>${data.payments.length?`<div class="list">${data.payments.map(p=>`<div class="item"><div class="details"><strong>${esc(memberName(data.fines.find(f=>f.id===p.fineId)?.memberId))}</strong><small>${esc(p.method||'Zahlung')}</small></div><strong>${money(p.amountCents)}</strong></div>`).join('')}</div>`:'<p class="muted">Noch keine</p>'}</section>`;
}
function cash(){
 if(!section('cash'))return empty('Kassa ist nicht freigegeben.');
 const c=data.cashbook||{};
 return `${heading('Kassa')}<div class="cash-hero"><span>Aktueller Kontostand</span><div class="cash-balance">${money(c.balanceCents)}</div></div><section class="card"><h2>Kassenbuch</h2>
 <div class="list">${(c.transactions||[]).map(t=>`<div class="item"><div class="details"><strong>${esc(t.type==='expense'?'Ausgabe':t.type==='monthly'?'Monatsbeiträge':t.type==='adjustment'?'Korrektur':'Strafzahlung')}</strong><small>${esc(t.note||'')}</small></div><strong>${t.amountCents>0?'+':''}${money(t.amountCents)}</strong></div>`).join('')||'<p class="muted">Keine Buchungen</p>'}</div></section>`;
}
function render(){
 if(!data)return;
 const tabs=[['dashboard','Start',true],['meetings','Stammtische',section('meetings')],['members','Mitglieder',section('members')],['ranking','Rangliste',section('members')],['fines','Strafen',section('fines')],['cash','Kassa',section('cash')]].filter(x=>x[2]);
 if(!tabs.some(x=>x[0]===tab))tab='dashboard';
 $('#tabs').innerHTML=tabs.map(([id,label])=>`<button class="navbutton ${tab===id?'active':''}" data-tab="${id}">${esc(label)}</button>`).join('');
 $('#content').innerHTML=({dashboard,meetings,members,ranking,fines,cash}[tab])();
 $('#updated').textContent='Stand: '+dateTime(data.publishedAt||lastFetched);
}
async function fetchPublic(){
 const cfg=window.FANTASTIX_CLOUD;
 if(!cfg||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/??$/i.test(String(cfg.url||''))||!String(cfg.key||'').startsWith('sb_publishable_')&&!String(cfg.key||'').startsWith('eyJ'))throw Error('Cloud noch nicht eingerichtet.');
 const url=cfg.url.replace(/\/$/,'')+'/rest/v1/fantastix_public?select=content,published_at&id=eq.main&is_published=eq.true';
 const res=await fetch(url,{cache:'no-store',headers:{apikey:cfg.key,Accept:'application/json'}});
 if(!res.ok)throw Error('Cloud-Abfrage fehlgeschlagen ('+res.status+').');
 const rows=await res.json();
 if(!Array.isArray(rows)||!rows.length){data=null;$('#tabs').innerHTML='';$('#content').innerHTML=empty('Für FantastiX wurden noch keine Daten öffentlich freigegeben.');$('#updated').textContent='Nicht veröffentlicht';return;}
 const d=rows[0].content;
 if(!d||!d.sections||!Array.isArray(d.members)||!Array.isArray(d.meetings)||!Array.isArray(d.fines)||!Array.isArray(d.payments))throw Error('Unbekanntes Veröffentlichungsformat.');
 data=d;lastFetched=rows[0].published_at||new Date().toISOString();render();
}
async function update(){try{await fetchPublic();}catch(e){if(!data){$('#content').innerHTML=empty(e.message||String(e));}$('#updated').textContent='Aktualisierung fehlgeschlagen';}}
document.addEventListener('click',e=>{const tabBtn=e.target.closest('[data-tab]');if(tabBtn){tab=tabBtn.dataset.tab;render();return;}const y=e.target.closest('[data-year]');if(y){year=y.dataset.year;render();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
setInterval(()=>{if(!document.hidden)update()},60000);
update();
