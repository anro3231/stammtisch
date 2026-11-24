/* Reader-only appearance. Device storage, no account or database writes. */
(()=>{
'use strict';
const themes=[
 {id:'standard',name:'Standard',description:'Bestehendes Rot-Weiß-Design',color:'#c92540'},
 {id:'dark',name:'Dark',description:'Dunkel mit Türkis-Akzent',color:'#10191c'},
 {id:'blue',name:'Beige',description:'Warmweiß & Sand',color:'#f3eee5'},
 {id:'green',name:'Grau',description:'Kühles Hellgrau & Schiefer',color:'#eef0f2'},
 {id:'violet',name:'Salbei',description:'Sanftes Grün & Creme',color:'#edf2eb'},
 {id:'sand',name:'Sand',description:'Helles Beige & Braun',color:'#f5eddf'},
 {id:'slate',name:'Graphit',description:'Steingrau & Silber',color:'#e9ecef'},
 {id:'night',name:'Nachtblau',description:'Dunkelblau & Eisblau',color:'#101a2b'}
],key='fantastix.reader.theme.device.v1',root=document.documentElement;
const meta=document.querySelector('meta[name="theme-color"]'),originalColor=meta?.content;
const photoKey='fantastix.reader.daily-photo.device.v1';
let selected='standard',dialog,photoVisible=true;
function savedPreference(name,legacy){
 try{const value=localStorage.getItem(name);if(value!==null)return value;}catch{}
 try{const value=sessionStorage.getItem(legacy);if(value!==null){try{localStorage.setItem(name,value);}catch{}return value;}}catch{}
 return null;
}
photoVisible=savedPreference(photoKey,'fantastix.reader.daily-photo.session.v1')!=='hidden';
const saved=savedPreference(key,'fantastix.reader.theme.session.v1');
if(themes.some(t=>t.id===saved))selected=saved;
function apply(id){
 const theme=themes.find(t=>t.id===id);if(!theme)return;
 selected=id;
 if(id==='standard')root.removeAttribute('data-reader-theme');else root.dataset.readerTheme=id;
 if(meta)meta.content=id==='standard'?originalColor:theme.color;
 for(const label of document.querySelectorAll('[data-reader-theme-name]'))label.textContent=theme.name;
}
apply(selected);
function open(){
 if(!dialog){
  dialog=document.createElement('dialog');dialog.className='reader-theme-dialog';dialog.setAttribute('aria-labelledby','reader-theme-heading');
  dialog.innerHTML=`<div class="reader-theme-heading"><h2 id="reader-theme-heading">Darstellung</h2><button type="button" class="reader-theme-close" aria-label="Farbauswahl schließen">×</button></div><p class="reader-theme-hint" id="reader-theme-help">Wähle dein Farbschema für dieses Gerät.</p><fieldset class="reader-theme-options" aria-describedby="reader-theme-help"><legend>Farbschema</legend>${themes.map(t=>`<label class="reader-theme-option theme-preview-${t.id}"><input type="radio" name="reader-theme" value="${t.id}"><span class="reader-theme-preview" aria-hidden="true"><span class="theme-preview-heading"></span><span class="theme-preview-card"></span><span class="theme-preview-accent"></span></span><span class="reader-theme-name">${t.name}<span class="reader-theme-check" aria-hidden="true">✓</span></span><small>${t.description}</small></label>`).join('')}</fieldset>`;
  document.body.appendChild(dialog);
  dialog.querySelector('.reader-theme-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('change',e=>{
   if(!e.target.matches('input[name="reader-theme"]'))return;
   apply(e.target.value);try{localStorage.setItem(key,selected);}catch{}
  });
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
  dialog.addEventListener('close',()=>{const button=document.querySelector('#reader-theme-open');button?.setAttribute('aria-expanded','false');button?.focus();});
 }
 for(const radio of dialog.querySelectorAll('input[name="reader-theme"]'))radio.checked=radio.value===selected;
 if(!dialog.open){dialog.showModal();dialog.querySelector('input:checked')?.focus();}
 document.querySelector('#reader-theme-open')?.setAttribute('aria-expanded','true');
}
window.FantastiXReaderSettings={
 showDailyPhoto:()=>photoVisible,
 card:()=>`<section class="card reader-display-settings"><h2>Darstellung</h2><button type="button" class="ghost" id="reader-theme-open" aria-label="Farbschema wählen" aria-haspopup="dialog" aria-expanded="false">Farbschema wählen · <span data-reader-theme-name>${themes.find(t=>t.id===selected).name}</span></button><label class="reader-photo-switch"><span class="reader-photo-switch-label"><span>Bild des Tages</span><small data-reader-photo-state aria-live="polite">${photoVisible?'Wird angezeigt':'Ausgeblendet'}</small></span><input type="checkbox" role="switch" aria-label="Bild des Tages" name="reader-photo-visibility" ${photoVisible?'checked':''}></label></section>`
};
document.addEventListener('change',e=>{
 if(!e.target.matches('input[name="reader-photo-visibility"][type="checkbox"]'))return;
 photoVisible=e.target.checked;
 for(const status of document.querySelectorAll('[data-reader-photo-state]'))status.textContent=photoVisible?'Wird angezeigt':'Ausgeblendet';
 try{localStorage.setItem(photoKey,photoVisible?'shown':'hidden');}catch{}
 for(const card of document.querySelectorAll('.daily-photo-card'))card.hidden=!photoVisible;
});
document.addEventListener('click',e=>{if(e.target.closest('#reader-theme-open')){e.preventDefault();open();}});
})();
