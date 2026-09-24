'use strict';
const MAX_TRANSACTIONS = 5000, MAX_LINES = 50000, MAX_PRODUCTS = 10000;
const TYPES = ['sale', 'return', 'deposit', 'withdrawal'];
const bad = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const str = (value) => String(value ?? '');
const includes = (value, query) => str(value).toLocaleLowerCase('he-IL').includes(query.toLocaleLowerCase('he-IL'));
function list(value, id = false) {
    if (value === undefined || value === '') return [];
    if (typeof value !== 'string' || value.length > 6000) bad('מסנן אינו תקין');
    let raw;
    try { raw = value.startsWith('[') ? JSON.parse(value) : value.split(','); } catch { bad('מסנן אינו תקין'); }
    if (!Array.isArray(raw) || raw.some(x => typeof x !== 'string')) bad('מסנן אינו תקין');
    const values = [...new Set(raw.map(x => x.trim()).filter(Boolean))];
    if (values.length > 100 || values.some(x => x.length > 200 || (id && !/^[a-f\d]{24}$/i.test(x)))) bad('ערכי הסינון אינם תקינים');
    return values;
}
function parseFilters(query, now = new Date()) {
    const modes = ['transactions', 'officers', 'wallets', 'products', 'inventory', 'credits'];
    const mode = query.mode || 'transactions'; if (!modes.includes(mode)) bad('סוג הדוח אינו תקין');
    if (query.q !== undefined && typeof query.q !== 'string') bad('טקסט החיפוש אינו תקין');
    const q = typeof query.q === 'string' ? query.q.trim() : ''; if (q.length > 120) bad('טקסט החיפוש ארוך מדי');
    for (const k of ['from', 'to']) if (query[k] !== undefined && (typeof query[k] !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(query[k]))) bad('תאריך אינו תקין');
    for (const k of ['from', 'to']) if (query[k]) {
        const [year, month, day] = query[k].slice(0, 10).split('-').map(Number);
        const calendar = new Date(Date.UTC(year, month - 1, day));
        if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) bad('תאריך אינו תקין');
    }
    const from = query.from ? new Date(query.from) : new Date(now.getTime() - 30 * 86400000);
    const to = query.to ? new Date(query.to) : now;
    if (![from, to].every(d => Number.isFinite(d.getTime())) || from >= to) bad('טווח תאריכים אינו תקין');
    if (to - from > 366 * 86400000 && mode !== 'inventory') bad('טווח הדוח מוגבל לשנה; יש להפיק טווחים נפרדים');
    const types = list(query.types); if (types.some(t => !TYPES.includes(t))) bad('סוג תנועה אינו תקין');
    const status = query.status || 'completed'; if (!['completed', 'cancelled', 'all'].includes(status)) bad('סטטוס אינו תקין');
    const money = key => {
        const v = query[key]; if (v === undefined || v === '') return null;
        if (typeof v !== 'string' || !/^\d{1,9}(\.\d{1,2})?$/.test(v)) bad('מסנן סכום אינו תקין');
        return Number(v);
    };
    const min = money('min'), max = money('max'); if (min !== null && max !== null && min > max) bad('טווח סכומים אינו תקין');
    return { mode, q, from, to, types, status, min, max, walletIds: list(query.walletIds, true), officerIds: list(query.officerIds, true), cashierIds: list(query.cashierIds, true), actorIds: list(query.actorIds, true), productIds: list(query.productIds, true), categories: list(query.categories), includeInactive: query.includeInactive === 'true' };
}
const sum = (rows, key) => Math.round(rows.reduce((s, r) => s + (Number(r[key]) || 0), 0) * 100) / 100;
function buildReport(transactions, users, wallets, f) {
    const userMap = new Map(users.map(u => [u.id, u])); const walletMap = new Map(wallets.map(w => [w.id, w]));
    const options = { officers: [], cashiers: [], actors: [], wallets: [], products: [], categories: [] };
    const seen = Object.fromEntries(Object.keys(options).map(k => [k, new Set()]));
    const option = (kind, id, label) => { if (id && !seen[kind].has(id)) { seen[kind].add(id); options[kind].push({ id, label }); } };
    const lines = []; const rows = [];
    const lineFilter = f.productIds.length || f.categories.length;
    for (const t of transactions) {
        const officer = userMap.get(t.officerId), cashier = userMap.get(t.cashierId), wallet = walletMap.get(t.walletId);
        const purchase = ['sale', 'return'].includes(t.transactionType);
        const officerName = officer?.fullName || t.officerId || 'לא תועד';
        const cashierName = cashier?.fullName || t.cashierId || 'לא תועד';
        const walletName = wallet?.name || t.walletId || 'לא תועד';
        if (purchase) option('officers', t.officerId, `${officerName}${officer?.personalNumber ? ' — ' + officer.personalNumber : ''}`);
        option('actors', purchase ? t.cashierId : t.officerId, purchase ? cashierName : officerName);
        option('cashiers', t.cashierId, cashierName); option('wallets', t.walletId, `${walletName}${wallet?.walletNumber ? ' — ' + wallet.walletNumber : ''}`);
        for (const i of t.items || []) { option('products', i.productId, i.productName); option('categories', i.categoryName, i.categoryName); }
        if (f.mode === 'credits' && purchase) continue;
        if (['officers', 'products'].includes(f.mode) && !purchase) continue;
        if (f.types.length && !f.types.includes(t.transactionType)) continue;
        if (f.status !== 'all' && t.status !== f.status) continue;
        if (f.walletIds.length && !f.walletIds.includes(t.walletId)) continue;
        if (f.officerIds.length && (!purchase || !f.officerIds.includes(t.officerId))) continue;
        if (f.cashierIds.length && !f.cashierIds.includes(t.cashierId)) continue;
        if (f.actorIds?.length && !f.actorIds.includes(purchase ? t.cashierId : t.officerId)) continue;
        if (f.min !== null && t.totalAmount < f.min) continue;
        if (f.max !== null && t.totalAmount > f.max) continue;
        const matchingItems = (t.items || []).filter(i => (!f.productIds.length || f.productIds.includes(i.productId)) && (!f.categories.length || f.categories.includes(i.categoryName)));
        if (lineFilter && !matchingItems.length) continue;
        if (f.q && ![t.transactionNumber, t.notes, officerName, officer?.personalNumber, cashierName, walletName, wallet?.walletNumber, ...matchingItems.map(i => i.productName)].some(v => includes(v, f.q))) continue;
        const matchedAmount = lineFilter ? sum(matchingItems, 'lineTotal') : Number(t.totalAmount);
        const { requestFingerprint: _privateFingerprint, ...publicTransaction } = t;
        const row = { ...publicTransaction, items: matchingItems, officerName: purchase ? officerName : '', personalNumber: purchase ? officer?.personalNumber || '' : '', actorName: purchase ? cashierName : officerName, cashierName, walletName, walletNumber: wallet?.walletNumber || '', matchedAmount,
            receiverEvidence: !purchase ? 'לא רלוונטי' : t.officerSelectionConfirmed === true ? 'בחירה שאושרה בקופה' : 'הקצין שנרשם בעסקה — רישום ישן',
            walletBalanceBefore: t.walletBalanceBefore ?? null, walletBalanceAfter: t.walletBalanceAfter ?? null,
            walletCurrentBalance: Number.isFinite(wallet?.currentBalance) ? wallet.currentBalance : null };
        rows.push(row);
        for (const item of matchingItems) lines.push({ transactionId: t.id, transactionNumber: t.transactionNumber, createdAt: t.createdAt, officerId: t.officerId, officerName: row.officerName, personalNumber: row.personalNumber, cashierName, walletName, walletNumber: row.walletNumber, transactionType: t.transactionType, status: t.status, ...item, createdAt: t.createdAt });
    }
    const completed = rows.filter(r => r.status === 'completed');
    const amount = type => sum(completed.filter(r => r.transactionType === type), 'matchedAmount');
    const sales = amount('sale'), returns = amount('return'), deposits = amount('deposit'), withdrawals = amount('withdrawal');
    const group = (records, keyFn, labelFn, amountKey = 'matchedAmount', identity = () => ({})) => {
        const map = new Map();
        for (const r of records) {
            const key = keyFn(r); if (!key) continue;
            const g = map.get(key) || { id: key, name: labelFn(r), ...identity(r), transactions: new Set(), sales: 0, returns: 0, deposits: 0, withdrawals: 0, quantityTaken: 0, quantityReturned: 0, lastAt: null };
            g.transactions.add(r.transactionId || r.id);
            if (!g.lastAt || new Date(r.createdAt) > new Date(g.lastAt)) g.lastAt = r.createdAt;
            if (r.status === 'completed') {
                const field = { sale: 'sales', return: 'returns', deposit: 'deposits', withdrawal: 'withdrawals' }[r.transactionType];
                if (field) g[field] += Number(r[amountKey]) || 0;
                const units = Number(r.quantity) || (r.items || []).reduce((s, i) => s + i.quantity, 0);
                if (r.transactionType === 'sale') g.quantityTaken += units;
                if (r.transactionType === 'return') g.quantityReturned += units;
            }
            map.set(key, g);
        }
        return [...map.values()].map(g => ({ ...g, transactions: g.transactions.size, net: Math.round((g.sales - g.returns) * 100) / 100, sales: Math.round(g.sales * 100) / 100, returns: Math.round(g.returns * 100) / 100, deposits: Math.round(g.deposits * 100) / 100, withdrawals: Math.round(g.withdrawals * 100) / 100 }));
    };
    for (const items of Object.values(options)) items.sort((a,b) => a.label.localeCompare(b.label, 'he'));
    return { rows, lines, options, groups: {
        officers: group(rows.filter(r => ['sale','return'].includes(r.transactionType)), r => r.officerId || 'unrecorded', r => r.officerName, 'matchedAmount', r => ({ personalNumber: r.personalNumber || '' })),
        wallets: group(rows, r => r.walletId || 'unrecorded', r => r.walletName, 'matchedAmount', r => ({ walletNumber: r.walletNumber || '' })),
        products: group(lines, r => r.productId || `deleted:${r.productName}`, r => r.productName, 'lineTotal')
    }, summary: { transactions: rows.length, sales, returns, deposits, withdrawals, netSales: Math.round((sales-returns)*100)/100, walletMovement: Math.round((deposits+returns-sales-withdrawals)*100)/100 }, lineFiltered: !!lineFilter };
}
async function loadReport(tenant, usersDb, environment, query) {
    const generatedAt = new Date(); const f = parseFilters(query, generatedAt);
    if (f.mode === 'inventory') {
        const raw = await tenant.product.findMany({ where: { environmentId: environment.id, ...(f.includeInactive ? {} : { isActive: true }) }, take: MAX_PRODUCTS + 1, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
        if (raw.length > MAX_PRODUCTS) bad('הדוח גדול מדי; יש לצמצם את הנתונים', 422);
        const rows = raw.filter(p => (!f.productIds.length || f.productIds.includes(p.id)) && (!f.categories.length || f.categories.includes(p.category)) && (!f.q || [p.name,p.sku,p.barcode,p.supplierName].some(x => includes(x,f.q))))
            .map(p => ({ ...p, inventoryValue: p.costPerUnit == null ? null : Math.round(p.quantity*p.costPerUnit*100)/100 }));
        return { mode: f.mode, environment: { id: environment.id, name: environment.name }, generatedAt, filters: f, rows, summary: { products: rows.length, units: sum(rows, 'quantity'), knownInventoryValue: sum(rows,'inventoryValue'), missingCosts: rows.filter(p => p.costPerUnit == null).length }, options: { products: raw.map(p => ({id:p.id,label:p.name})), categories: [...new Set(raw.map(p=>p.category).filter(Boolean))].map(x=>({id:x,label:x})) } };
    }
    const transactions = await tenant.transaction.findMany({ where: { environmentId: environment.id, createdAt: { gte: f.from, lt: f.to } }, orderBy: [{ createdAt: 'desc' },{ id: 'desc' }], take: MAX_TRANSACTIONS + 1 });
    if (transactions.length > MAX_TRANSACTIONS) bad('נמצאו יותר מ־5,000 תנועות בטווח. צמצם תאריכים; לא הופק דוח חלקי', 422);
    if (transactions.reduce((s,t)=>s+(t.items || []).length,0) > MAX_LINES) bad('דוח הפירוט גדול מדי; צמצם את טווח התאריכים', 422);
    const ids = [...new Set(transactions.flatMap(t => [t.officerId,t.cashierId]).filter(Boolean))];
    const walletIds = [...new Set(transactions.map(t=>t.walletId).filter(Boolean))];
    const [users,wallets] = await Promise.all([
        ids.length ? usersDb.user.findMany({ where: { id:{in:ids} }, select:{ id:true,fullName:true,personalNumber:true } }) : [],
        walletIds.length ? tenant.wallet.findMany({where:{id:{in:walletIds},environmentId:environment.id},select:{id:true,name:true,walletNumber:true,currentBalance:true}}) : []
    ]);
    return { mode:f.mode, environment:{id:environment.id,name:environment.name},generatedAt,walletBalancesReadAt:new Date(),filters:f,...buildReport(transactions,users,wallets,f) };
}
module.exports = { parseFilters, buildReport, loadReport, MAX_TRANSACTIONS };
