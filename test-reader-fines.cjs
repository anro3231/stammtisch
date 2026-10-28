const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(__dirname+'/lesen.js','utf8').split("document.addEventListener('submit'")[0],ctx);
const run=s=>vm.runInContext(s,ctx);
run(`data={sections:{fines:true},members:[{id:'a',name:'Anna <Test>'},{id:'b',name:'Berta'},{id:'c',name:'Clara'}],fines:[
 {id:'f1',memberId:'a',date:'2026-10-17',reason:'Teststrafe',amountCents:1000},
 {id:'f2',memberId:'a',amountCents:500},{id:'f3',memberId:'b',amountCents:800},
 {id:'f4',memberId:'a',amountCents:100}
 ],payments:[{fineId:'f1',amountCents:300},{fineId:'f1',amountCents:200},{fineId:'f2',amountCents:500},{fineId:'f4',amountCents:200}]};`);
assert.equal(run('readerFineBalances()[0].name'),'Berta','Highest outstanding amount first');
assert.equal(run('readerFineBalances().find(x=>x.id===\'a\').amount'),500,'Partial payments deducted per fine; overpayment does not reduce other fines');
assert.equal(run('readerFineBalances().find(x=>x.id===\'a\').count'),1);
assert.equal(run('readerFineBalances().find(x=>x.id===\'c\').amount'),0,'Members without fines included');
let html=run('cash()');
assert.match(html,/Anna &lt;Test&gt;/);
assert.match(html,/17\.10\.2026/);
assert.doesNotMatch(html,/<input|<textarea|name="date"/,'Reader dates remain read only');
assert.ok(html.indexOf('Offene Strafen pro Mitglied')<html.indexOf('Teststrafe'),'Member totals appear above individual fines');
run('data.sections.fines=false');assert.doesNotMatch(run('cash()'),/Offene Strafen pro Mitglied|Teststrafe/,'Fine sharing permissions preserved');
run('data.sections.fines=true;data.members=[];data.fines=[];data.payments=[]');
assert.match(run('cash()'),/Keine Mitglieder vorhanden/);
console.log('PASS reader fines: member totals, partial/full payments, zero balances, ordering, dates, escaping, read-only fields and sharing permissions.');
