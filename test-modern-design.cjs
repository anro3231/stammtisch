// Synthetic accounts only. JSDOM validates real form ownership and click handlers.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.FANTASTIX_JSDOM||'jsdom');
const appVersion=fs.readFileSync(__dirname+'/version.js','utf8').match(/FX_VERSION='([^']+)'/)[1];
function environment(file){
 const dom=new JSDOM(fs.readFileSync(__dirname+'/'+(file==='app.js'?'index.html':'lesen.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''),{url:'https://example.test/app/',runScripts:'outside-only'});
 const w=dom.window;w.scrollTo=()=>{};w.alert=()=>{};w.confirm=()=>true;w.Notification={permission:'granted'};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const BaseDate=w.Date;w.Date=class extends BaseDate{constructor(...args){super(...(args.length?args:['2026-10-24T12:00:00Z']));}static now(){return new this().getTime();}};
 const source=fs.readFileSync(__dirname+'/'+file,'utf8');w.eval(source.split(file==='app.js'?'/* Interaktionen */':"document.addEventListener('submit'")[0]+'\nwindow.testRun=code=>eval(code);');
 const clickStart=source.indexOf("document.addEventListener('click'");const clickEnd=source.indexOf(file==='app.js'?"document.addEventListener('submit'":"$('#notice-dialog').addEventListener",clickStart);w.testRun(source.slice(clickStart,clickEnd));
 const fixture={members:[{id:'a',name:'Anna <A>',memberNumber:12},{id:'b',name:'Berta'}],meetings:Array.from({length:25},(_,i)=>({id:'m'+i,date:'2026-09-'+String(i+1).padStart(2,'0'),location:'Ort '+i,organizerId:'a',attendance:{a:{status:'present'}}})).concat([{id:'today',date:'2026-10-24'},{id:'future',date:'2099-01-01'}]),excursions:[{id:'past',title:'Past',date:'2026-10-23'},{id:'future',title:'Future',date:'2099-01-01'},{id:'today',title:'Today',date:'2026-10-24'},{id:'ongoing',title:'Ongoing',date:'2026-10-23',endDate:'2026-10-25'},{id:'closed',title:'Closed',completed:true},{id:'open',title:'Open'}],fines:[],payments:[],sections:{members:true,meetings:true,excursions:true,fines:true}};
 w.fixture=fixture;w.testRun("data=fixture;"+(file==='lesen.js'?"profile={member_id:'a'};user={id:'reader'};":''));
 return {dom,w,run:s=>w.testRun(s),doc:w.document};
}

for(const file of ['app.js','lesen.js']){
 const env=environment(file);env.w.eval(fs.readFileSync(__dirname+'/ui-icons.js','utf8'));
 for(const key of ['home','meetings','excursions','calendar','members','ranking','fines','settings','bell','crown','flame']){
  const svg=env.w.FantastixUI.icon(key);const parsed=new env.w.DOMParser().parseFromString(svg,'image/svg+xml');assert.equal(parsed.querySelector('parsererror'),null,key+' SVG');
 }
 env.run("data.excursions=[{id:'new-event',title:'Event <Test>',date:'2099-01-01',organizerIds:['a','b'],organizerOther:'Gastwirt & Team'}];");
 env.run(file==='app.js'?"page='home';render()":"tab='dashboard';renderApp()");
 const event=env.doc.querySelector('.excursion-preview');assert.ok(event);assert.match(event.querySelector('.event-organizer').textContent,/Anna <A>.*Berta.*Gastwirt & Team/);assert.equal(event.querySelector('.event-organizer a'),null);
 assert.match(event.querySelector('.meeting-status').textContent,/Geplant/);assert.ok(event.querySelector('.event-date').textContent.includes('2099'));
 assert.equal(env.doc.querySelectorAll('.next-card .dashboard-open').length,1);assert.equal(env.doc.querySelectorAll('.navinner svg').length,file==='app.js'?8:7);
 assert.ok(env.doc.querySelector(`link[href="./modern.css?v=${appVersion}"]`));assert.ok(fs.readFileSync(__dirname+'/'+(file==='app.js'?'index.html':'lesen.html'),'utf8').includes('./ui-icons.js?v='+appVersion));
 if(file==='lesen.js'){env.run("data.sections.excursions=false;renderApp()");assert.equal(env.doc.querySelector('.excursion-preview'),null);}
 env.run("avatarUrls={a:'https://example.test/anna.jpg'};");
 for(const selected of ['all','2026']){
  env.run(file==='app.js'?`rankYear='${selected}'`:`year='${selected}'`);
  const ranking=env.doc.createElement('div');ranking.innerHTML=env.run(file==='app.js'?'rankingHTML()':'ranking()');
  const anna=[...ranking.querySelectorAll('.ranking-member')].find(row=>row.textContent.includes('Anna <A>'));assert.ok(anna);assert.equal(anna.querySelector('img').src,'https://example.test/anna.jpg');assert.ok(anna.querySelector('[data-profile-photo]'));assert.equal(ranking.querySelectorAll('.ranking-member').length,2);assert.equal(ranking.querySelectorAll('.ranking-member img').length,1,'Member without photo retains a placeholder');
 }
 env.dom.window.close();
}
console.log('PASS modern design: shared assets, valid local icons, organizer names/free text/escaping, event sharing, event date/status, one primary action and all navigation targets.');
