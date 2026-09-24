'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../..');
const svc = require('../src/services/barcodeService.js');
const ENV = 'a'.repeat(24), ENV2 = 'b'.repeat(24), ID = 'c'.repeat(24), ID2 = 'd'.repeat(24);
function match(row, query = {}) { return Object.entries(query).every(([key, v]) => v === undefined || (v && typeof v === 'object' && !(v instanceof Date) ? ('not' in v ? row[key] !== v.not : 'in' in v ? v.in.includes(row[key]) : 'equals' in v ? String(row[key]).toLowerCase() === String(v.equals).toLowerCase() : true) : row[key] === v)); }
function fakeDb(initial = {}) {
    const state = { product: [], wallet: [], walletUser: [], category: [], transaction: [], barcodeWriteLock: [], ...structuredClone(initial) };
    const events = []; let counter = 1, tail = Promise.resolve(); const fail = {}, trace = [];
    function client(data) {
        const db = {};
        for (const name of Object.keys(state)) db[name] = {
            async findFirst({ where } = {}) { trace.push(name + '.findFirst'); return structuredClone(data[name].find(v => match(v, where)) || null); },
            async findUnique({ where } = {}) {
                const q = where.name_environmentId || where.walletNumber_environmentId || where.barcode_environmentId || where;
                const row = data[name].find(v => match(v, q)); return row ? { ...structuredClone(row), ...(name === 'wallet' ? { walletUsers: data.walletUser.filter(v => v.walletId === row.id) } : {}) } : null;
            },
            async findMany({ where } = {}) { return structuredClone(data[name].filter(v => match(v, where))); },
            async create({ data: value }) {
                if (fail[name]) throw Object.assign(new Error('injected failure'), { code: fail[name] });
                const row = { id: (counter++).toString(16).padStart(24, '0'), ...structuredClone(value) }; data[name].push(row); return structuredClone(row);
            },
            async createMany({ data: rows }) { for (const row of rows) await db[name].create({ data: row }); return { count: rows.length }; },
            async update({ where, data: value }) {
                trace.push(name + '.update'); if (fail[name]) throw Object.assign(new Error('injected failure'), { code: fail[name] });
                const row = data[name].find(v => match(v, where)); if (!row) throw new Error('not found');
                Object.assign(row, Object.fromEntries(Object.entries(value).filter(([,v]) => v !== undefined))); return structuredClone(row);
            },
            async updateMany({ where, data: value }) { let count = 0; for (const row of data[name]) if (match(row, where)) { await db[name].update({ where: { id: row.id }, data: value }); count++; } return { count }; },
            async deleteMany({ where }) { const before = data[name].length; data[name] = data[name].filter(v => !match(v, where)); return { count: before - data[name].length }; },
            async upsert({ where, create, update }) { const found = data[name].find(v => match(v, where)); if (found) { Object.assign(found, update); return structuredClone(found); } return db[name].create({ data: create }); },
            async count({ where } = {}) { return data[name].filter(v => match(v, where)).length; }
        };
        return db;
    }
    const db = client(state);
    db.$transaction = (work) => {
        const run = tail.then(async () => {
            const draft = structuredClone(state); const tx = client(draft); trace.push('transaction.start');
            const result = await work(tx);
            for (const key of Object.keys(state)) state[key] = draft[key];
            trace.push('transaction.commit'); return result;
        }); tail = run.catch(() => {}); return run;
    };
    return { db, state, fail, trace, events };
}
const record = (kind, id = ID, code = '00123', env = ENV) => ({ id, environmentId: env, [kind === 'product' ? 'barcode' : 'walletNumber']: code, isActive: true, name: kind, currentBalance: 10, categoryBalances: [], updatedAt: 'baseline' });
const write = (f, kind, code, id, env = ENV) => svc.withBarcodeWrite(f.db, env, kind, code, id, (tx, normalized) => id ? tx[kind].update({ where: { id }, data: { [kind === 'product' ? 'barcode' : 'walletNumber']: normalized } }) : tx[kind].create({ data: { environmentId: env, [kind === 'product' ? 'barcode' : 'walletNumber']: normalized } }));
for (const input of ['0','00123','987654321012345678901234567890', '5'.repeat(128)]) test(`preserves numeric identifier ${input.slice(0,32)}`, () => assert.equal(svc.normalizeBarcode(input), input));
for (const input of ['', 'abc', '12a3','1e3','1.2','-1','+1','12 3',123,null,undefined,'٠١٢','5'.repeat(129)]) test(`rejects invalid barcode ${String(input).slice(0,16)}`, () => assert.throws(() => svc.normalizeBarcode(input), e => e.barcodeStatus === 400));
for (const source of ['product','wallet']) for (const target of ['product','wallet']) test(`${source} to ${target} duplicate is blocked in same environment`, async () => {
    const f=fakeDb({ [source]:[record(source)] }); await assert.rejects(write(f,target,'00123'), e => e.barcodeStatus === 409 && e.conflictType === source); assert.equal(f.state[target].length, source === target ? 1 : 0);
});
for (const kind of ['product','wallet']) test(`${kind} can keep own barcode on edit`, async () => { const f=fakeDb({ [kind]:[record(kind)] }); await write(f,kind,'00123',ID); assert.equal(f.state[kind].length,1); });
for (const kind of ['product','wallet']) test(`${kind} can change barcode when free`, async () => { const f=fakeDb({ [kind]:[record(kind)] }); await write(f,kind,'00234',ID); assert.equal(f.state[kind][0][kind==='product'?'barcode':'walletNumber'],'00234'); });
test('same identifier allowed across environments', async () => { const f=fakeDb({ wallet:[record('wallet')] }); await write(f,'product','00123',undefined,ENV2); assert.equal(f.state.product[0].environmentId,ENV2); });
test('inactive records reserve their identifier', async () => { const f=fakeDb({ wallet:[{...record('wallet'),isActive:false}] }); await assert.rejects(write(f,'product','00123'),e=>e.barcodeStatus===409); });
test('numeric strings with leading zeros are distinct without coercion', async () => { const f=fakeDb({wallet:[record('wallet')]});await write(f,'product','123');assert.equal(f.state.product[0].barcode,'123'); });
test('foreign record ID cannot be edited', async () => { const f=fakeDb({product:[record('product',ID,'00123',ENV2)]});await assert.rejects(write(f,'product','00555',ID),e=>e.barcodeStatus===404);assert.equal(f.state.product[0].barcode,'00123'); });
test('self exclusion does not exclude the opposite collection with equal IDs', async () => { const f=fakeDb({product:[record('product')],wallet:[record('wallet')]});await assert.rejects(write(f,'product','00123',ID),e=>e.barcodeStatus===409); });
test('two concurrent cross-collection creates have one winner in transactional fixture', async () => { const f=fakeDb();const r=await Promise.allSettled([write(f,'product','789'),write(f,'wallet','789')]);assert.equal(r.filter(v=>v.status==='fulfilled').length,1);assert.equal(r.filter(v=>v.status==='rejected')[0].reason.barcodeStatus,409); });
test('failed write rolls back token and data in transactional fixture', async () => { const f=fakeDb();await svc.withBarcodeWrite(f.db,ENV,'product','123',undefined,async()=>{});const token=f.state.barcodeWriteLock[0].token;f.fail.product='P2000';await assert.rejects(write(f,'product','124'));assert.equal(f.state.barcodeWriteLock[0].token,token);assert.equal(f.state.product.length,0); });
test('write lock is acquired before reading identifier owners', async () => { const f=fakeDb();await write(f,'product','123');const start=f.trace.indexOf('transaction.start');assert.equal(f.trace[start+1],'barcodeWriteLock.update');assert.ok(f.trace.indexOf('product.findFirst')>start+1); });
test('known aborted conflict retries, unknown commit timeout does not', async () => { const f=fakeDb();const real=f.db.$transaction;let calls=0;f.db.$transaction=async fn=>{if(++calls===1)throw Object.assign(new Error('conflict'),{code:'P2034'});return real(fn);};await write(f,'product','123');assert.equal(calls,2);f.db.$transaction=async()=>{calls++;throw Object.assign(new Error('timeout'),{code:'P2028'});};await assert.rejects(write(f,'wallet','124'));assert.equal(calls,3); });
test('standalone database yields an actionable error without fallback write', async()=>{const f=fakeDb();f.db.$transaction=async()=>{throw Object.assign(new Error('requires replica set'),{code:'P2031'});};await assert.rejects(write(f,'product','123'),e=>e.barcodeStatus===503);assert.equal(f.state.product.length,0);});
// Load the actual changed routes; Express/network and central-user lookup are fixtures.
function route(kind,f){
 const routes=[];const router={use(){},get(p,...h){routes.push({method:'get',p,h});},post(p,...h){routes.push({method:'post',p,h});},put(p,...h){routes.push({method:'put',p,h});},delete(p,...h){routes.push({method:'delete',p,h});}};
 const module={exports:{}};
 const reqMod=name=>{
  if(name==='express')return {Router:()=>router};
  if(name.includes('middleware/auth'))return {authenticateToken(){},authorizeRoles:()=>()=>{}};
  if(name.includes('barcodeService'))return svc;
  if(name.includes('tenantContext'))return {requireTenantPrisma:req=>{if(!req.user.environmentId)throw new Error('scope');return f.db;}};
  if(name.includes('socket'))return {getIO:()=>({emit:(...args)=>f.events.push(args)})};
  if(name.includes('database'))return {usersPrisma:{}};
  if(name.includes('userLookup'))return {buildUserMapByIds:async()=>new Map()};
  if(name.includes('colors'))return {CATEGORY_COLORS:['#fff'],hexToRgba:v=>v};
  if(name.includes('categoryCleanup'))return {cleanupUnusedCategories:async()=>{}};
  if(name.includes('verifiedMutation'))return {requireVerifiedMutation:()=>{}};
  if(name.includes('walletCreditService'))return {};
  throw new Error('Unexpected import '+name);
 };
 const file=path.join(root,`backend/src/routes/${kind}.routes.js`);
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{require:reqMod,module,exports:module.exports,console,Date,Buffer,Number,Set,Map},{filename:file});
 return async(method,p,body,params={})=>{const r=routes.find(r=>r.method===method&&r.p===p);assert.ok(r,'missing route');const res={statusCode:200,status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};let error;await r.h.at(-1)({body,params,user:{id:ID2,environmentId:ENV,role:'admin'},query:body},res,e=>{error=e;});if(error)throw error;return res;};
}
test('product POST cross-wallet duplicate is shown to user',async()=>{const f=fakeDb({wallet:[record('wallet')]});const r=await route('product',f)('post','/',{name:'p',unitPrice:4,category:'general',barcode:'00123'});assert.equal(r.statusCode,409);assert.match(r.body.error,/ארנק/);assert.equal(f.events.length,0);});
test('product POST stores numeric string and emits once',async()=>{const f=fakeDb();const r=await route('product',f)('post','/',{name:'p',unitPrice:4,category:'general',barcode:'0042'});assert.equal(r.statusCode,201);assert.equal(r.body.barcode,'0042');assert.equal(f.events.length,1);});
test('product PUT checks cross-wallet duplicate and leaves original untouched',async()=>{const f=fakeDb({product:[record('product',ID,'00123')],wallet:[record('wallet',ID2,'0042')]});const r=await route('product',f)('put','/:id',{barcode:'0042'},{id:ID});assert.equal(r.statusCode,409);assert.equal(f.state.product[0].barcode,'00123');});
test('wallet POST duplicate product is blocked without creating money or users',async()=>{const f=fakeDb({product:[record('product')]});const r=await route('wallet',f)('post','/',{name:'w',walletNumber:'00123',generalBalance:30});assert.equal(r.statusCode,409);assert.equal(f.state.wallet.length,0);assert.equal(f.state.transaction.length,0);});
test('wallet creation and assignment stay inside one transaction',async()=>{const f=fakeDb();const r=await route('wallet',f)('post','/',{name:'w',walletNumber:'00234',generalBalance:30,userIds:[ID2]});assert.equal(r.statusCode,201);assert.equal(f.state.walletUser.length,1);assert.equal(r.body.currentBalance,30);assert.equal(f.events.length,1);});
test('wallet assignment failure aborts wallet creation',async()=>{const f=fakeDb();f.fail.walletUser='P2000';await assert.rejects(route('wallet',f)('post','/',{name:'w',walletNumber:'00234',generalBalance:30,userIds:[ID2]}));assert.equal(f.state.wallet.length,0);assert.equal(f.events.length,0);});
test('wallet PUT own identifier preserves balance and top-up endpoints exist',async()=>{const f=fakeDb({wallet:[record('wallet')]});const r=await route('wallet',f)('put','/:id',{name:'updated',walletNumber:'00123'},{id:ID});assert.equal(r.statusCode,200);assert.equal(r.body.currentBalance,10);});
test('wallet PUT cross-product duplicate does not adjust balance',async()=>{const f=fakeDb({wallet:[record('wallet')],product:[record('product',ID2,'0099')]});const r=await route('wallet',f)('put','/:id',{walletNumber:'0099',generalBalance:999},{id:ID});assert.equal(r.statusCode,409);assert.equal(f.state.wallet[0].currentBalance,10);assert.equal(f.state.transaction.length,0);});
test('nonbarcode metadata update works without manufacturing a new identifier',async()=>{const f=fakeDb({wallet:[record('wallet')]});const r=await route('wallet',f)('put','/:id',{description:'x'},{id:ID});assert.equal(r.statusCode,200);assert.equal(r.body.walletNumber,'00123');});
test('manual resolver never matches names, partials or duplicates',async()=>{const {resolveManualBarcode:r,filterManualBarcodes:flt}=await import(pathToFileURL(path.join(root,'frontend/src/utils/manualBarcode.mjs')));const p={id:ID,name:'00123',barcode:'00555',isActive:true};assert.equal(r([p],'00123'),null);assert.equal(r([p],'0055'),null);assert.equal(r([p,p],'00555'),null);assert.equal(r([p],'00555').id,ID);assert.equal(flt([p],'00').length,1);assert.equal(flt([p],'aaa').length,0);});
test('longer-prefix ambiguity waits for Enter, which still requires unique exact match',async()=>{const {resolveManualBarcode:r}=await import(pathToFileURL(path.join(root,'frontend/src/utils/manualBarcode.mjs')));const p=[{id:ID,barcode:'23'},{id:ID2,barcode:'234'}];assert.equal(r(p,'23'),null);assert.equal(r(p,'23',{explicit:true}).id,ID);assert.equal(r(p,'234').id,ID2);assert.equal(r([{barcode:'23',isActive:false}],'23'),null);});
test('patched source retains report receiver confirmation, entry and both scanner routes',()=>{const p=fs.readFileSync(path.join(root,'frontend/src/pages/pos/POSCheckout.jsx'),'utf8');assert.match(p,/useManualBarcodeAdd/);assert.match(p,/readOnly=\{manualEntryDisabled\}/);assert.match(p,/resolveManualBarcode\(products, scannedBarcode/);assert.match(p,/resolveManualBarcode\(products, value/);assert.match(p,/policyLoading \|\| !!policyError/);assert.match(p,/catalogReady: isLoaded && !hasMore && !loading/);const c=fs.readFileSync(path.join(root,'frontend/src/pages/admin/Products.jsx'),'utf8');assert.doesNotMatch(c,/<datalist/);assert.match(c,/ProductCategoryPicker/);assert.match(c,/allowCreate=\{!hasCategorySelection\}/);});
test('availability endpoint only reports conflicts in the current environment',async()=>{const f=fakeDb({wallet:[record('wallet',ID,'00123',ENV2)]});const res={status(n){this.n=n;return this;},json(v){this.body=v;}};let failure;await svc.availabilityHandler({user:{environmentId:ENV},envPrisma:f.db,query:{value:'00123',kind:'product'}},res,e=>failure=e);assert.equal(failure,undefined);assert.equal(res.body.available,true);assert.equal(res.body.environmentId,ENV);assert.equal(f.state.barcodeWriteLock.length,0);});
test('availability endpoint never returns a foreign owner name or ID',async()=>{const f=fakeDb({wallet:[record('wallet')]});const res={status(n){this.n=n;return this;},json(v){this.body=v;}};await svc.availabilityHandler({user:{environmentId:ENV},envPrisma:f.db,query:{value:'00123',kind:'product'}},res,e=>{throw e});assert.equal(res.body.available,false);assert.equal(res.body.conflictType,'wallet');assert.equal(res.body.id,undefined);assert.equal(res.body.name,undefined);});
test('wallet audit insertion failure aborts balance and identifier edit together',async()=>{const f=fakeDb({wallet:[record('wallet')]});f.fail.transaction='P2000';await assert.rejects(route('wallet',f)('put','/:id',{walletNumber:'00234',generalBalance:40},{id:ID}));assert.equal(f.state.wallet[0].currentBalance,10);assert.equal(f.state.wallet[0].walletNumber,'00123');assert.equal(f.events.length,0);});
test('wallet edit assignment failure restores previous balance and audit in fixture',async()=>{const f=fakeDb({wallet:[record('wallet')]});f.fail.walletUser='P2000';await assert.rejects(route('wallet',f)('put','/:id',{walletNumber:'00234',generalBalance:40,userIds:[ID2]},{id:ID}));assert.equal(f.state.wallet[0].currentBalance,10);assert.equal(f.state.transaction.length,0);assert.equal(f.state.wallet[0].walletNumber,'00123');});
