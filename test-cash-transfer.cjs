// Synthetic accounts only. JSDOM validates real form ownership and click handlers.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.FANTASTIX_JSDOM||'jsdom');
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

(async()=>{
for(const file of ['app.js','lesen.js']){
 const env=environment(file),run=env.run,doc=env.doc,w=env.w;
 run(`data.fines=[{id:'unpaid',memberId:'a',date:'2026-10-25',amountCents:1000,reason:'Zu spät <script>bad</script>'},{id:'partial',memberId:'a',date:'2026-10-24',amountCents:1000,reason:'Teilzahlung'},{id:'paid',memberId:'b',date:'2026-10-23',amountCents:500,reason:'Bezahlt'},{id:'over',memberId:'b',date:'2026-10-22',amountCents:500,reason:'Überzahlt'},{id:'zero',memberId:'a',date:'2026-10-21',amountCents:0},{id:'missing',memberId:'b',amountCents:400}];data.payments=[{fineId:'partial',amountCents:300},{fineId:'paid',amountCents:500},{fineId:'over',amountCents:600}];`);
 if(file==='app.js')run("page='fines';render()");else run("tab='cash';renderApp()");
 const table=doc.querySelector('.fine-table');assert.deepEqual([...table.querySelectorAll('th')].map(x=>x.textContent),['Datum','Mitglied','Grund','Betrag','Status']);
 assert.deepEqual([...table.querySelectorAll('tbody tr')].map(x=>x.dataset.fineRow),['unpaid','partial','paid','over','zero','missing']);
 const row=id=>table.querySelector(`[data-fine-row="${id}"]`);
 assert.equal(row('unpaid').querySelector('time').textContent,'25.10.2026');assert.match(row('unpaid').querySelector('.fine-member').textContent,/Anna <A>/);assert.equal(row('unpaid').querySelector('script'),null);
 for(const id of ['unpaid','partial','missing'])assert.equal(row(id).querySelector('.fine-status').textContent,'Nicht bezahlt');
 for(const id of ['paid','over','zero'])assert.equal(row(id).querySelector('.fine-status').textContent,'Bezahlt');
 assert.match(row('partial').querySelector('.fine-amount strong').textContent,/10,00/);assert.equal(row('partial').querySelector('.fine-amount small'),null);assert.doesNotMatch(row('partial').querySelector('.fine-amount').textContent,/offen/);assert.equal(row('missing').querySelector('time').textContent,'–');
 assert.equal(table.querySelectorAll('[data-action="fine-pay"]').length,file==='app.js'?3:0);assert.equal(table.querySelectorAll('[data-action="fine-view"]').length,file==='app.js'?6:0);
 const account=doc.querySelector('.transfer-account');assert.equal(account.parentElement.lastElementChild,account);assert.match(account.textContent,/Dominik Winkler/);assert.equal(account.querySelector('code').textContent,'DE64 1001 1001 2624 8363 16');
 const copied=[];Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{writeText:async text=>copied.push(text)}});const before=run('JSON.stringify(data)');
 await run('copyTransferIBAN(document.querySelector("[data-copy-iban]"))');assert.deepEqual(copied,['DE64100110012624836316']);assert.match(account.querySelector('[role="status"]').textContent,/wurde kopiert/);
 w.navigator.clipboard.writeText=async()=>{throw Error('Denied');};doc.execCommand=cmd=>{assert.equal(cmd,'copy');copied.push(doc.querySelector('textarea').value);return true;};
 await run('copyTransferIBAN(document.querySelector("[data-copy-iban]"))');assert.equal(copied.at(-1),'DE64100110012624836316');assert.equal(doc.querySelector('textarea'),null,'Temporary clipboard field removed');
 delete doc.execCommand;await run('copyTransferIBAN(document.querySelector("[data-copy-iban]"))');assert.match(account.querySelector('[role="status"]').textContent,/manuell kopieren/);assert.equal(account.querySelector('button').textContent,'IBAN kopieren');assert.equal(run('JSON.stringify(data)'),before,'Copy does not modify financial records');
 if(file==='lesen.js'){run("data.sections.fines=false;data.sections.cash=true;renderApp()");assert.equal(doc.querySelector('.fine-table'),null);assert.ok(doc.querySelector('.transfer-account'));run("data.sections.cash=false");assert.doesNotMatch(run('cash()'),/DE64|Dominik|Zu spät/);}
 env.dom.window.close();
}
console.log('PASS cash transfer: account footer, exact IBAN/API/fallback/manual copy, compact fine fields/order/escaping, partial/full/over/zero payments, admin actions and reader permissions.');
})().catch(e=>{console.error(e);process.exitCode=1;});
