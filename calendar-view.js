/* FantastiX 3.11 - read-only calendar renderer. No storage and no network. */
(function(){
 'use strict';
 const enc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const iso=/^\d{4}-\d{2}-\d{2}$/;
 function valid(s){if(!iso.test(s||''))return false;const d=new Date(s+'T12:00:00');return !isNaN(d)&&local(d)===s;}
 function local(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
 function shift(date,offset){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+offset);return local(d);}
 function datesBetween(start,end,low,high){if(!valid(start))return[];const a=start<low?low:start,b=(valid(end)&&end>=start?end:start)>high?high:(valid(end)&&end>=start?end:start);const days=[];for(let x=a;x<=b&&days.length<42;x=shift(x,1))days.push(x);return days;}
 function period(x){if(!valid(x.date))return 'Termin offen';const d=s=>new Date(s+'T12:00:00').toLocaleDateString('de-AT',{day:'2-digit',month:'2-digit',year:'numeric'});return x.endDate&&x.endDate!==x.date?d(x.date)+' – '+d(x.endDate):d(x.date);}
 function render(data,month,selected,admin){
  const {meetings=[],excursions=[]}=data||{};month=/^\d{4}-\d{2}$/.test(month||'')?month:local(new Date()).slice(0,7);
  const base=new Date(month+'-01T12:00:00');if(isNaN(base))return '<p>Kalenderdatum ungültig</p>';
  const first=local(base);const next=new Date(base);next.setMonth(next.getMonth()+1);const last=shift(local(next),-1);
  const prefix=(base.getDay()+6)%7;const gridStart=shift(first,-prefix);const entries={};
  const add=(day,obj)=>{(entries[day]??=[]).push(obj)};
  for(const m of meetings){if(valid(m.date)&&m.date>=gridStart&&m.date<=shift(gridStart,41))add(m.date,{type:'meeting',id:m.id||'',title:'Stammtisch',sub:m.location||'Gasthaus noch offen',date:m.date,raw:m});}
  for(const x of excursions){if(valid(x.date)){for(const day of datesBetween(x.date,x.endDate,gridStart,shift(gridStart,41)))add(day,{type:'event',id:x.id||'',title:x.title||'Event',sub:x.location||'',date:day,raw:x});}}
  selected=valid(selected)?selected:first;
  const monthTitle=base.toLocaleDateString('de-AT',{month:'long',year:'numeric'});
  const cells=Array.from({length:42},(_,i)=>{const day=shift(gridStart,i);const items=entries[day]||[];return `<button type="button" data-calendar-day="${day}" class="fxcal-day ${day.slice(0,7)!==month?'fxcal-other':''} ${day===local(new Date())?'fxcal-today':''} ${day===selected?'fxcal-selected':''}" aria-label="${day}, ${items.length} Termine"><span class="fxcal-num">${Number(day.slice(-2))}</span><span class="fxcal-dots">${items.slice(0,4).map(e=>`<i class="fxcal-dot ${e.type==='meeting'?'fxcal-meeting':'fxcal-event'}"></i>`).join('')}</span></button>`;}).join('');
  const agenda=(entries[selected]||[]);
  const monthEvents=Object.values(entries).flat().filter(e=>e.date.slice(0,7)===month);
  const overviewUnique=[...new Map(monthEvents.map(e=>[e.type+':'+e.id,e])).values()].sort((a,b)=>a.date.localeCompare(b.date));
  const dayTitle=new Date(selected+'T12:00:00').toLocaleDateString('de-AT',{weekday:'long',day:'numeric',month:'long'});
  const eventItem=e=>{const btn=admin?`<button type="button" class="smallbtn" data-action="${e.type==='meeting'?'meeting-edit':'excursion-edit'}" data-id="${enc(e.id)}">Öffnen</button>`:`<button type="button" class="smallbtn" data-tab="${e.type==='meeting'?'meetings':'excursions'}">Ansehen</button>`;
   return `<div class="fxcal-item"><span class="fxcal-stripe ${e.type==='meeting'?'fxcal-meeting':'fxcal-event'}"></span><div class="fxcal-info"><strong>${enc(e.title)}</strong><small>${e.type==='meeting'?'Stammtisch':'Event'} · ${enc(e.type==='event'?period(e.raw):e.date)}${e.sub?' · '+enc(e.sub):''}</small></div>${btn}</div>`;};
  const undated=excursions.filter(x=>!valid(x.date)&&!x.completed);
  return `<div class="fxcal-wrap"><section class="card fxcal-card"><div class="fxcal-toolbar"><button type="button" class="fxcal-arrow" data-calendar-move="-1" aria-label="Vorheriger Monat">‹</button><h2>${enc(monthTitle)}</h2><button type="button" class="fxcal-arrow" data-calendar-move="1" aria-label="Nächster Monat">›</button></div><div class="fxcal-legend"><span><i class="fxcal-dot fxcal-meeting"></i> Stammtisch</span><span><i class="fxcal-dot fxcal-event"></i> Event</span></div><div class="fxcal-weekdays">${['Mo','Di','Mi','Do','Fr','Sa','So'].map(s=>`<span>${s}</span>`).join('')}</div><div class="fxcal-grid">${cells}</div><div class="fxcal-today-action"><button class="smallbtn" type="button" data-calendar-today>Heute</button></div></section><section class="card"><h2>${enc(dayTitle)}</h2>${agenda.length?agenda.map(eventItem).join(''):'<p class="muted">Keine Termine an diesem Tag.</p>'}</section><section class="card"><h2>Alle Termine im Monat</h2>${overviewUnique.length?overviewUnique.map(eventItem).join(''):'<p class="muted">Keine Stammtische oder Events in diesem Monat.</p>'}</section>${undated.length?`<section class="card"><h2>Events · Termin offen</h2>${undated.map(x=>eventItem({type:'event',id:x.id,title:x.title||'Event',sub:x.location||'',raw:x})).join('')}</section>`:''}</div>`;
 }
 function move(month,count){const d=new Date(month+'-01T12:00:00');d.setMonth(d.getMonth()+count);return local(d).slice(0,7)}
 window.FantastiXCalendar={render,move,local,period};
})();
