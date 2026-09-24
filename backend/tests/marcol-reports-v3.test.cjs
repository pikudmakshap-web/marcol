'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { inflateRawSync } = require('node:zlib');
const { parseFilters, buildReport, loadReport } = require('../src/reports/reportData');
const { workbook, crc32 } = require('../src/reports/reportWorkbook');
const paramsModule = import(pathToFileURL(path.resolve(__dirname, '../../frontend/src/utils/reportParams.mjs')).href);
const id = n => n.toString(16).padStart(24, '0');
const when = new Date('2026-09-17T09:00:00Z');
const users = [{id:id(1),fullName:'מקבל בדיקה',personalNumber:'0000123'}, {id:id(2),fullName:'מנהל בדיקה'}];
const wallets = [{id:id(3),name:'ארנק בדיקה',walletNumber:'00009'}];
const sale = {id:id(10),transactionNumber:'T1',createdAt:when,environmentId:id(9),officerId:id(1),cashierId:id(2),walletId:id(3),totalAmount:12,transactionType:'sale',status:'completed',items:[{productId:id(4),productName:'מחברת',categoryName:'כתיבה',quantity:2,unitPrice:6,lineTotal:12}]};
const deposit = {...sale,id:id(11),transactionNumber:'D1',transactionType:'deposit',officerId:id(2),cashierId:null,totalAmount:100,items:[],requestFingerprint:'private-internal-value'};
const filter = q => parseFilters({from:'2026-09-01T00:00:00Z',to:'2026-09-18T00:00:00Z',...q});
const build = q => ({mode:q?.mode||'transactions',environment:{id:id(9),name:'דוגמה בלבד — לא נתוני חנות'},generatedAt:when,filters:filter(q),...buildReport([sale,deposit],users,wallets,filter(q))});
function unzip(buffer) {
    const entries = new Map(); let p=0;
    while (buffer.readUInt32LE(p) === 0x04034b50) {
        const size=buffer.readUInt32LE(p+18), crc=buffer.readUInt32LE(p+14), len=buffer.readUInt16LE(p+26), extra=buffer.readUInt16LE(p+28);
        const name=buffer.subarray(p+30,p+30+len).toString('utf8'); const start=p+30+len+extra;
        const content=inflateRawSync(buffer.subarray(start,start+size));assert.equal(crc32(content),crc);entries.set(name,content.toString('utf8'));p=start+size;
    }
    assert.equal(buffer.readUInt32LE(p),0x02014b50);return entries;
}
test('actor filter selects funding manager independently of receiving officer',()=>{const r=build({actorIds:id(2)});assert.equal(r.rows.length,2);assert.equal(build({actorIds:id(1)}).rows.length,0);});
test('funding manager filter does not turn a deposit into a receipt of products',()=>assert.equal(build({mode:'credits',officerIds:id(2)}).rows.length,0));
test('actor options include deposit author without cashierId',()=>assert.ok(build().options.actors.some(x=>x.id===id(2))));
test('private idempotency fingerprint is not returned in reports',()=>assert.equal('requestFingerprint' in build().rows[1],false));
test('wallet mode retains per-transaction history and also summary groups',()=>{const r=build({mode:'wallets'});assert.equal(r.rows.length,2);assert.equal(r.groups.wallets[0].deposits,100);assert.equal(r.groups.wallets[0].walletNumber,'00009');});
test('officer grouping retains personal number as text',()=>assert.equal(build().groups.officers[0].personalNumber,'0000123'));
test('zero recorded balance remains zero, not unknown',()=>{const r=buildReport([{...deposit,walletBalanceBefore:0,walletBalanceAfter:100}],users,wallets,filter());assert.equal(r.rows[0].walletBalanceBefore,0);});
test('product filter excludes unrelated deposit and leaves exact line sum',()=>assert.equal(build({productIds:id(4)}).summary.netSales,12));
test('missing referenced user stays explicitly unrecorded rather than changing receiver',()=>{const r=buildReport([sale],[],wallets,filter());assert.equal(r.rows[0].officerId,id(1));assert.equal(r.rows[0].officerName,id(1));});
for (const q of [{q:['x']},{from:[]},{from:'today'},{to:123},{actorIds:'bad'},{actorIds:'[{}]'}])test('reject ambiguous query '+JSON.stringify(q),()=>assert.throws(()=>filter(q),{status:400}));
test('report is bounded by exclusive end date and environment',async()=>{let args;await loadReport({transaction:{findMany:async a=>(args=a,[])},wallet:{}},{user:{}},{id:id(9),name:'test'},{from:'2026-09-16T21:00:00Z',to:'2026-09-17T21:00:00Z'});assert.equal(args.where.environmentId,id(9));assert.equal(args.where.createdAt.lt.toISOString(),'2026-09-17T21:00:00.000Z');});
test('XLSX contains six matching, parseable sheet names',()=>{const z=unzip(workbook(build()));assert.equal([...z.keys()].filter(k=>/^xl\/worksheets\/sheet\d+\.xml$/.test(k)).length,6);assert.match(z.get('xl/workbook.xml'),/לפי קצין ניהול/);});
test('XLSX all worksheets preserve RTL, freeze rows, and local dates',()=>{const z=unzip(workbook(build()));for(const [k,v]of z)if(k.startsWith('xl/worksheets/')){assert.match(v,/rightToLeft="1"/);assert.match(v,/ySplit="7"/);assert.match(v,/state="frozen"/);}});
test('XLSX literal malicious-looking names are never formula elements',()=>{const r=build();r.rows[0].officerName='=HYPERLINK("example","text")';const z=unzip(workbook(r));assert.match(z.get('xl/worksheets/sheet2.xml'),/=HYPERLINK/);for(const v of z.values())assert.doesNotMatch(v,/<f[ >]/);});
test('XLSX personal and wallet numbers keep leading zeros',()=>{const z=unzip(workbook(build()));assert.match(z.get('xl/worksheets/sheet2.xml'),/t="inlineStr"><is><t xml:space="preserve">0000123/);assert.match(z.get('xl/worksheets/sheet2.xml'),/>00009<\/t>/);});
test('XLSX all data is exported beyond UI first 50 rows',()=>{const r=build();r.rows=Array.from({length:61},(_,i)=>({...r.rows[0],transactionNumber:`T-${i}`}));const z=unzip(workbook(r));assert.match(z.get('xl/worksheets/sheet2.xml'),/>T-60<\/t>/);});
test('XLSX metadata includes applied actor filter',()=>{const z=unzip(workbook(build({actorIds:id(2)})));assert.match(z.get('xl/worksheets/sheet1.xml'),/מבצעי פעולה/);assert.match(z.get('xl/worksheets/sheet1.xml'),/מנהל בדיקה/);});
test('XLSX long notes receive taller rows within cap',()=>{const r=build();r.rows[0].notes='הערת בדיקה '.repeat(25);const z=unzip(workbook(r));assert.match(z.get('xl/worksheets/sheet2.xml'),/<row r="8" ht="120"/);});
test('inventory XLSX contains only two worksheets',async()=>{const report=await loadReport({product:{findMany:async()=>[{id:id(4),name:'מוצר',quantity:2,costPerUnit:5}]}},{},{id:id(9),name:'test'},{mode:'inventory'});assert.equal([...unzip(workbook(report)).keys()].filter(k=>k.startsWith('xl/worksheets/')).length,2);});
for(const [day,expected] of [['2026-09-17','2026-09-16T21:00:00.000Z'],['2026-01-15','2026-01-14T22:00:00.000Z']])test('Israel midnight '+day,async()=>assert.equal((await paramsModule).israelMidnight(day),expected));
test('spring daylight change keeps 23-hour day bounds',async()=>{const m=await paramsModule;const p=m.paramsFor({...m.defaults(when),start:'2026-03-27',end:'2026-03-27'},id(9));assert.equal((Date.parse(p.to)-Date.parse(p.from))/3600000,23);});
test('autumn daylight change keeps 25-hour day bounds',async()=>{const m=await paramsModule;const p=m.paramsFor({...m.defaults(when),start:'2026-10-25',end:'2026-10-25'},id(9));assert.equal((Date.parse(p.to)-Date.parse(p.from))/3600000,25);});
test('invalid calendar date rejected rather than normalized',async()=>{const m=await paramsModule;assert.throws(()=>m.israelMidnight('2026-02-31'));});
test('same-day range is allowed and next midnight is exclusive',async()=>{const m=await paramsModule,p=m.paramsFor({...m.defaults(when),start:'2026-09-17',end:'2026-09-17'},id(9));assert.equal(p.to,'2026-09-17T21:00:00.000Z');});
test('reverse date range rejected',async()=>{const m=await paramsModule;assert.throws(()=>m.paramsFor({...m.defaults(when),start:'2026-09-18',end:'2026-09-17'},id(9)));});
test('default end date is Israel date even at UTC day boundary',async()=>assert.equal((await paramsModule).defaults(new Date('2026-09-16T22:00:00Z')).end,'2026-09-17'));
test('scope includes identity, role and environment',async()=>{const m=await paramsModule;assert.notEqual(m.scopeKey({id:'a',role:'admin',environmentId:'e'}),m.scopeKey({id:'b',role:'admin',environmentId:'e'}));});
test('sidebar styles do not target the global body, root or generic navigation',()=>{const s=fs.readFileSync(path.resolve(__dirname,'../../frontend/src/components/Sidebar.compact.v3.css'),'utf8');assert.doesNotMatch(s,/(?:^|\n)\s*(?:body|:root|nav|button)\s*\{/);assert.match(s,/--sidebar-gap: 6px/);assert.match(s,/--sidebar-button: 44px/);});
test('new UI keeps reports menu restricted to managers with accessible labels',()=>{const s=fs.readFileSync(path.resolve(__dirname,'../../frontend/src/components/Sidebar.jsx'),'utf8');assert.match(s,/path: '\/admin\/reports', show: isAdmin/);assert.match(s,/aria-label=\{item.label\}/);assert.match(s,/aria-current=/);});

test('group summaries never label a product or wallet with an arbitrary first receiver',()=>{const g=build().groups;assert.equal('personalNumber' in g.wallets[0],false);assert.equal('walletNumber' in g.officers[0],false);assert.equal('personalNumber' in g.products[0],false);assert.equal('walletNumber' in g.products[0],false);const z=unzip(workbook(build()));assert.doesNotMatch(z.get('xl/worksheets/sheet6.xml'),/>מספר אישי<|>מספר ארנק</);});
for (const from of ['2026-02-31','2026-02-30T00:00:00Z','2026-13-01T00:00:00Z'])test('API rejects impossible calendar date '+from,()=>assert.throws(()=>filter({from}),{status:400}));
