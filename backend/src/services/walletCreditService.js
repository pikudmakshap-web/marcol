const { createHash } = require('node:crypto');

const MAX_CENTS = 99_999_999_999; // Consistent, explicit upper bound: ILS 999,999,999.99.
function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
function amountToCents(value) {
    if (typeof value !== 'string' && typeof value !== 'number') fail(400, 'יש להזין סכום חיובי תקין');
    const text = String(value).trim();
    if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(text)) fail(400, 'יש להזין סכום חיובי עם עד שתי ספרות אחרי הנקודה');
    const [whole, fraction = ''] = text.split('.');
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_CENTS) fail(400, 'הסכום מחוץ לטווח המותר');
    return cents;
}
function balanceToCents(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) fail(409, 'יתרת הארנק אינה תקינה; נדרשת בדיקה');
    const cents = Math.round(value * 100);
    if (!Number.isSafeInteger(cents) || Math.abs(value * 100 - cents) > 0.001 || Math.abs(cents) > MAX_CENTS) {
        fail(409, 'יתרת הארנק אינה תקינה; נדרשת בדיקה');
    }
    return cents;
}
function creditPlan(wallet, amountCents, categoryName) {
    const beforeCents = balanceToCents(wallet.currentBalance);
    const categories = (wallet.categoryBalances || []).map((category) => ({ ...category }));
    if (categories.length) {
        const seen = new Set();
        let sum = 0;
        for (const category of categories) {
            if (!category.categoryName || seen.has(category.categoryName)) fail(409, 'רשימת הקטגוריות בארנק אינה תקינה');
            seen.add(category.categoryName);
            sum += balanceToCents(category.balance);
        }
        if (sum !== beforeCents) fail(409, 'יתרת הארנק אינה תואמת לסכום הקטגוריות; יש לבדוק את הארנק');
        const target = categories.find((category) => category.categoryName === categoryName);
        if (!target) fail(400, 'יש לבחור קטגוריה קיימת בארנק');
        const targetCents = balanceToCents(target.balance) + amountCents;
        if (targetCents > MAX_CENTS) fail(400, 'היתרה החדשה גדולה מדי');
        target.balance = targetCents / 100;
    } else if (categoryName) {
        fail(400, 'בארנק כללי אין לבחור קטגוריה');
    }
    const afterCents = beforeCents + amountCents;
    if (afterCents > MAX_CENTS) fail(400, 'היתרה החדשה גדולה מדי');
    return { before: beforeCents / 100, after: afterCents / 100, categories };
}
async function creditWallet(tenant, actor, walletId, body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'בקשה לא תקינה');
    if (!actor?.environmentId || !['admin', 'superadmin'].includes(actor.role)) fail(403, 'אין הרשאה להוסיף כסף לארנק');
    if (!/^[a-f\d]{24}$/i.test(walletId)) fail(400, 'מזהה הארנק אינו תקין');
    if (body.environmentId !== actor.environmentId) fail(409, 'סביבת העבודה השתנתה; יש לרענן');
    if (typeof body.requestId !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(body.requestId)) {
        fail(400, 'מזהה הפעולה חסר או אינו תקין');
    }
    const cents = amountToCents(body.amount);
    if (body.categoryName != null && typeof body.categoryName !== 'string') fail(400, 'הקטגוריה אינה תקינה');
    if (body.notes != null && typeof body.notes !== 'string') fail(400, 'ההערה אינה תקינה');
    const categoryName = (body.categoryName || '').trim();
    const notes = (body.notes || '').trim();
    if (categoryName.length > 200 || notes.length > 500) fail(400, 'הטקסט ארוך מדי');
    const transactionNumber = `DEP-${body.requestId.toLowerCase()}`;
    const fingerprint = createHash('sha256').update(JSON.stringify([actor.id, walletId, cents, categoryName, notes])).digest('hex');
    const operationId = createHash('sha256').update(`${actor.environmentId}:${transactionNumber}`).digest('hex').slice(0, 24);
    const whereKey = { id: operationId };

    for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
            return await tenant.$transaction(async (tx) => {
                const previous = await tx.transaction.findUnique({ where: whereKey });
                if (previous) {
                    if (previous.requestFingerprint !== fingerprint || previous.transactionType !== 'deposit') {
                        fail(409, 'מזהה הפעולה כבר שימש לבקשה אחרת; לא בוצעה הפקדה נוספת');
                    }
                    const wallet = await tx.wallet.findFirst({ where: { id: walletId, environmentId: actor.environmentId } });
                    if (!wallet) fail(404, 'הארנק אינו קיים עוד; ההפקדה הקודמת נשמרה');
                    return { wallet, transaction: previous, replayed: true };
                }
                const wallet = await tx.wallet.findFirst({ where: { id: walletId, environmentId: actor.environmentId } });
                if (!wallet) fail(404, 'הארנק לא נמצא בסביבת העבודה הנוכחית');
                if (!wallet.isActive) fail(409, 'לא ניתן להוסיף כסף לארנק לא פעיל');
                const plan = creditPlan(wallet, cents, categoryName);
                const summary = `הוספת כסף לארנק | יתרה לפני: ₪${plan.before.toFixed(2)} | יתרה אחרי: ₪${plan.after.toFixed(2)}`;
                const transaction = await tx.transaction.create({ data: {
                    id: operationId, transactionNumber, environmentId: actor.environmentId,
                    officerId: actor.id, walletId, transactionType: 'deposit', status: 'completed',
                    totalAmount: cents / 100, items: [],
                    walletBalanceBefore: plan.before, walletBalanceAfter: plan.after,
                    walletCategoryName: categoryName || null, requestFingerprint: fingerprint,
                    notes: [summary, categoryName ? `קטגוריה: ${categoryName}` : '', notes].filter(Boolean).join(' | ')
                } });
                const updated = await tx.wallet.update({ where: { id: walletId }, data: {
                    currentBalance: plan.after, categoryBalances: plan.categories
                } });
                return { wallet: updated, transaction, replayed: false };
            }, { maxWait: 5000, timeout: 10000 });
        } catch (error) {
            if (['P2034', 'P2002'].includes(error.code) && attempt < 3) {
                await new Promise((resolve) => setTimeout(resolve, 30 * (attempt + 1)));
                continue;
            }
            if (error.code === 'P2031') fail(503, 'פעולה זו דורשת MongoDB עם Replica Set; לא בוצעה הפקדה');
            if (['P2034', 'P2002'].includes(error.code)) fail(409, 'בוצע עדכון מקביל; יש לנסות שוב לאחר רענון');
            throw error;
        }
    }
}
module.exports = { amountToCents, balanceToCents, creditPlan, creditWallet };
