const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { amountToCents, balanceToCents, creditPlan, creditWallet } = require('../src/services/walletCreditService');
const WALLET = '111111111111111111111111', ENV = '222222222222222222222222';
const actor = { id: '333333333333333333333333', environmentId: ENV, role: 'admin' };
const makeWallet = (overrides = {}) => ({ id: WALLET, environmentId: ENV, isActive: true, currentBalance: 100, categoryBalances: [], ...overrides });
const request = (overrides = {}) => ({ amount: '25.10', environmentId: ENV, notes: '', requestId: randomUUID(), ...overrides });

// An in-memory transactional fake. This suite does NOT connect to MongoDB.
function memoryTenant(initial = makeWallet(), options = {}) {
    let state = { wallet: structuredClone(initial), transactions: [] };
    let lock = Promise.resolve();
    let failures = options.conflicts || 0;
    return {
        snapshot: () => structuredClone(state),
        async $transaction(callback) {
            if (failures-- > 0) throw Object.assign(new Error('simulated write conflict'), { code: 'P2034' });
            const prior = lock; let release;
            lock = new Promise((resolve) => { release = resolve; });
            await prior;
            const next = structuredClone(state);
            const tx = {
                transaction: {
                    findUnique: async ({ where }) => next.transactions.find((t) => t.id === where.id) || null,
                    create: async ({ data }) => { const value = { id: randomUUID(), createdAt: new Date(), ...data }; next.transactions.push(value); return value; }
                },
                wallet: {
                    findFirst: async ({ where }) => next.wallet?.id === where.id && next.wallet.environmentId === where.environmentId ? structuredClone(next.wallet) : null,
                    update: async ({ data }) => {
                        if (options.failWalletWrite) throw new Error('simulated write failure');
                        Object.assign(next.wallet, data); return structuredClone(next.wallet);
                    }
                }
            };
            try { const result = await callback(tx); state = next; return result; } finally { release(); }
        }
    };
}
for (const [value, cents] of [['0.01', 1], ['25.1', 2510], [' 12.50 ', 1250], [0.1, 10], ['999999999.99', 99999999999]]) {
    test(`accept amount ${JSON.stringify(value)}`, () => assert.equal(amountToCents(value), cents));
}
for (const value of [0, -1, '', ' ', '1.001', '1e3', '12x', 'Infinity', Infinity, NaN, true, null, [], {}, '1,000', '1000000000.00']) {
    test(`reject invalid amount ${String(value)}`, () => assert.throws(() => amountToCents(value), { status: 400 }));
}
test('round only insignificant historical float noise', () => {
    assert.equal(balanceToCents(0.1 + 0.2), 30);
    assert.throws(() => balanceToCents(12.345), { status: 409 });
});
test('general wallet adds, rather than replaces', () => {
    const plan = creditPlan(makeWallet(), 5000, ''); assert.equal(plan.before, 100); assert.equal(plan.after, 150);
});
test('category credit changes only selected category and total; no input mutation', () => {
    const wallet = makeWallet({ categoryBalances: [{ categoryName: 'A', balance: 60 }, { categoryName: 'B', balance: 40 }] });
    const plan = creditPlan(wallet, 2500, 'A');
    assert.equal(plan.after, 125); assert.deepEqual(plan.categories.map((c) => c.balance), [85, 40]); assert.equal(wallet.categoryBalances[0].balance, 60);
});
test('category required and unknown category rejected', () => {
    const w = makeWallet({ categoryBalances: [{ categoryName: 'A', balance: 100 }] });
    for (const c of ['', 'other']) assert.throws(() => creditPlan(w, 100, c), { status: 400 });
});
test('general wallet rejects accidental category', () => assert.throws(() => creditPlan(makeWallet(), 100, 'A'), { status: 400 }));
test('inconsistent category totals rejected', () => assert.throws(() => creditPlan(makeWallet({ categoryBalances: [{ categoryName: 'A', balance: 90 }] }), 100, 'A'), { status: 409 }));
test('duplicate category names rejected', () => assert.throws(() => creditPlan(makeWallet({ categoryBalances: [{ categoryName: 'A', balance: 50 }, { categoryName: 'A', balance: 50 }] }), 100, 'A'), { status: 409 }));
test('wallet limit prevents overflow', () => assert.throws(() => creditPlan(makeWallet({ currentBalance: 999999999.99 }), 1, ''), { status: 400 }));
test('deposit includes actor, notes and before/after snapshots', async () => {
    const db = memoryTenant(); const result = await creditWallet(db, actor, WALLET, request({ notes: 'test' }));
    assert.equal(result.wallet.currentBalance, 125.1); assert.equal(result.transaction.officerId, actor.id);
    assert.equal(result.transaction.walletBalanceBefore, 100); assert.equal(result.transaction.walletBalanceAfter, 125.1);
    assert.equal(result.transaction.transactionType, 'deposit'); assert.match(result.transaction.notes, /test/);
});
test('identical request replay creates one deposit only', async () => {
    const db = memoryTenant(), body = request();
    await creditWallet(db, actor, WALLET, body);
    const result = await creditWallet(db, actor, WALLET, body);
    assert.equal(result.replayed, true); assert.equal(db.snapshot().transactions.length, 1); assert.equal(result.wallet.currentBalance, 125.1);
});
test('same request id with changed payload rejected', async () => {
    const db = memoryTenant(), body = request(); await creditWallet(db, actor, WALLET, body);
    await assert.rejects(creditWallet(db, actor, WALLET, { ...body, amount: '30' }), { status: 409 });
    assert.equal(db.snapshot().wallet.currentBalance, 125.1);
});
test('parallel repeats still credit once in transactional fake', async () => {
    const db = memoryTenant(), body = request(); const results = await Promise.all(Array.from({ length: 8 }, () => creditWallet(db, actor, WALLET, body)));
    assert.equal(results.filter((r) => !r.replayed).length, 1); assert.equal(db.snapshot().transactions.length, 1);
});
test('independent parallel requests all add in transactional fake', async () => {
    const db = memoryTenant(); await Promise.all(Array.from({ length: 10 }, () => creditWallet(db, actor, WALLET, request({ amount: '0.01' }))));
    assert.equal(db.snapshot().wallet.currentBalance, 100.1); assert.equal(db.snapshot().transactions.length, 10);
});
test('wallet write failure rolls back the audit in transactional fake', async () => {
    const db = memoryTenant(makeWallet(), { failWalletWrite: true }); await assert.rejects(creditWallet(db, actor, WALLET, request()));
    assert.equal(db.snapshot().transactions.length, 0); assert.equal(db.snapshot().wallet.currentBalance, 100);
});
test('retry transient conflict', async () => {
    const db = memoryTenant(makeWallet(), { conflicts: 2 }); await creditWallet(db, actor, WALLET, request()); assert.equal(db.snapshot().wallet.currentBalance, 125.1);
});
test('replica set requirement yields explicit unavailable response', async () => {
    const db = { $transaction: async () => { throw Object.assign(new Error('standalone'), { code: 'P2031' }); } };
    await assert.rejects(creditWallet(db, actor, WALLET, request()), { status: 503 });
});
for (const role of ['cashier', 'officer', 'unknown']) test(`deny ${role}`, async () => {
    const db = memoryTenant(); await assert.rejects(creditWallet(db, { ...actor, role }, WALLET, request()), { status: 403 }); assert.equal(db.snapshot().transactions.length, 0);
});
test('superadmin with selected environment allowed', async () => assert.equal((await creditWallet(memoryTenant(), { ...actor, role: 'superadmin' }, WALLET, request())).wallet.currentBalance, 125.1));
test('cross-environment wallet rejected', async () => {
    const db = memoryTenant(makeWallet({ environmentId: '444444444444444444444444' })); await assert.rejects(creditWallet(db, actor, WALLET, request()), { status: 404 });
});
test('stale browser environment rejected before transaction', async () => await assert.rejects(creditWallet(memoryTenant(), actor, WALLET, request({ environmentId: 'other' })), { status: 409 }));
test('inactive wallet rejected', async () => await assert.rejects(creditWallet(memoryTenant(makeWallet({ isActive: false })), actor, WALLET, request()), { status: 409 }));
test('missing operation id rejected', async () => await assert.rejects(creditWallet(memoryTenant(), actor, WALLET, request({ requestId: '' })), { status: 400 }));
test('invalid wallet id rejected', async () => await assert.rejects(creditWallet(memoryTenant(), actor, 'bad', request()), { status: 400 }));
test('long notes rejected', async () => await assert.rejects(creditWallet(memoryTenant(), actor, WALLET, request({ notes: 'a'.repeat(501) })), { status: 400 }));

const scannerModule = () => import(pathToFileURL(path.resolve(__dirname, '../../frontend/src/utils/posScanner.mjs')));
async function scanWithGap(text, gap, endingDelay = gap, modifier = {}) {
    const { createScanCollector } = await scannerModule(); const scanner = createScanCollector(); let now = 1000;
    for (const key of text) { scanner.push({ key, ...modifier }, now); now += gap; }
    return scanner.push({ key: 'Enter' }, now - gap + endingDelay);
}
test('scanner accepts quick barcode plus Enter', async () => assert.equal(await scanWithGap('7290001234567', 10), '7290001234567'));
test('scanner rejects ordinary typing', async () => assert.equal(await scanWithGap('7290001234567', 140), null));
test('scanner rejects delayed Enter', async () => assert.equal(await scanWithGap('729000', 10, 1000), null));
test('scanner rejects too-short identifier', async () => assert.equal(await scanWithGap('12', 10), null));
test('scanner rejects held keys', async () => assert.equal(await scanWithGap('1234567', 10, 10, { repeat: true }), null));
test('scanner rejects modified shortcuts', async () => assert.equal(await scanWithGap('1234567', 10, 10, { ctrlKey: true }), null));
test('scanner rejects composition input', async () => assert.equal(await scanWithGap('1234567', 10, 10, { isComposing: true }), null));
test('scanner resets between complete scans', async () => {
    const { createScanCollector } = await scannerModule(); const s = createScanCollector(); let t = 1000;
    for (const key of '123') { s.push({ key }, t); t += 10; } assert.equal(s.push({ key: 'Enter' }, t), '123');
    assert.equal(s.push({ key: 'Enter' }, t + 1), null);
});

// Real JWT signature verification, without the application's database module.
let jwt; try { jwt = require('jsonwebtoken'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
const verifiedMutation = jwt ? require('../src/middleware/verifiedMutation').verifiedMutation : null;
const jwtTest = (name, fn) => test(name, { skip: !jwt ? 'jsonwebtoken is not installed in this validation environment' : false }, fn);
const SECRET = 'test-only-secret-never-used-for-real-users';
function runVerified(headers, user = actor, body = { environmentId: ENV }) {
    const previous = process.env.JWT_SECRET; process.env.JWT_SECRET = SECRET;
    let result = 'next'; const response = { status(code) { result = code; return this; }, json() { return result; } };
    verifiedMutation({ headers, user, body }, response, () => { result = 'next'; });
    if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous;
    return result;
}
jwtTest('valid signed session accepted', () => assert.equal(runVerified({ authorization: `Bearer ${jwt.sign({ id: actor.id }, SECRET)}` }), 'next'));
jwtTest('missing bearer rejected', () => assert.equal(runVerified({}), 401));
jwtTest('spoofed x-user-id without matching JWT rejected', () => assert.equal(runVerified({ authorization: `Bearer ${jwt.sign({ id: 'other' }, SECRET)}` }), 401));
jwtTest('invalid signature rejected', () => assert.equal(runVerified({ authorization: `Bearer ${jwt.sign({ id: actor.id }, 'wrong-secret')}` }), 401));
jwtTest('expired token rejected', () => assert.equal(runVerified({ authorization: `Bearer ${jwt.sign({ id: actor.id }, SECRET, { expiresIn: -1 })}` }), 401));
jwtTest('JWT environment mismatch rejected', () => assert.equal(runVerified({ authorization: `Bearer ${jwt.sign({ id: actor.id, environmentId: 'other' }, SECRET)}` }), 409));

// Execute the actual settings handlers with stubbed boundaries; no DB/network.
function settingsHandlers(tenant) {
    const entries = [];
    const router = { use() {}, get(route, ...handlers) { entries.push({ method: 'GET', handlers }); }, put(route, ...handlers) { entries.push({ method: 'PUT', handlers }); } };
    const sandbox = { module: { exports: {} }, require(name) {
        if (name === 'express') return { Router: () => router };
        if (name.includes('/auth.js')) return { authenticateToken() {}, authorizeRoles: () => () => {} };
        if (name.includes('verifiedMutation')) return { verifiedMutation() {} };
        if (name.includes('tenantContext')) return { requireTenantPrisma: () => tenant };
        if (name.includes('socket')) return { getIO: () => ({ emit() {} }) };
        throw new Error(`Unexpected require: ${name}`);
    } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/routes/settings.routes.js'), 'utf8'), sandbox);
    return async (method, body = {}) => {
        let status = 200, payload;
        const res = { status(code) { status = code; return this; }, json(data) { payload = data; return this; } };
        await entries.find((e) => e.method === method).handlers.at(-1)({ user: actor, body }, res, (error) => { throw error; });
        return { status, payload };
    };
}
test('legacy or absent settings default to manual entry allowed, GET stays read-only', async () => {
    const run = settingsHandlers({ systemSettings: { findFirst: async () => null } });
    const result = await run('GET'); assert.equal(result.payload.posManualEntryDisabled, false);
});
test('settings switch persists alongside low stock and is tenant-scoped', async () => {
    let saved;
    const run = settingsHandlers({ systemSettings: { upsert: async (args) => { saved = args; return args.create; } } });
    const result = await run('PUT', { posManualEntryDisabled: true, lowStockPercentage: 17 });
    assert.equal(result.status, 200); assert.equal(saved.where.environmentId, ENV); assert.equal(saved.update.posManualEntryDisabled, true); assert.equal(saved.update.lowStockPercentage, 17);
});
test('settings rejects string Boolean instead of coercing it', async () => {
    const run = settingsHandlers({}); assert.equal((await run('PUT', { posManualEntryDisabled: 'false' })).status, 400);
});
test('settings rejects non-finite low stock percentage', async () => {
    const run = settingsHandlers({}); assert.equal((await run('PUT', { lowStockPercentage: Infinity })).status, 400);
});
test('settings partial update does not reset POS switch', async () => {
    let saved; const run = settingsHandlers({ systemSettings: { upsert: async (args) => { saved = args; return args.create; } } });
    await run('PUT', { lowStockPercentage: 20 }); assert.equal(Object.hasOwn(saved.update, 'posManualEntryDisabled'), false);
});
test('reports UI and API not imported or changed by feature entry points', () => {
    for (const name of ['../src/services/walletCreditService.js', '../../frontend/src/components/WalletTopUpModal.jsx']) {
        assert.doesNotMatch(fs.readFileSync(path.join(__dirname, name), 'utf8'), /report\.routes|pages\/admin\/Reports/);
    }
});

test('auth cleanup preserves unfinished financial operation IDs', () => {
    const api = fs.readFileSync(path.join(__dirname, '../../frontend/src/services/api.js'), 'utf8');
    assert.match(api, /marcol:pending-topup:v1:/);
    assert.match(api, /for \(const \[key, value\] of pendingTopUps\) sessionStorage.setItem/);
});
