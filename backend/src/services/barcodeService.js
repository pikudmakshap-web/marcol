'use strict';
const { randomUUID } = require('node:crypto');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const MAX_LENGTH = 128;
function barcodeError(status, message, code = 'BARCODE_INVALID', details = {}) {
    return Object.assign(new Error(message), { barcodeStatus: status, barcodeCode: code, ...details });
}
function normalizeBarcode(value) {
    if (typeof value !== 'string' || !/^[0-9]{1,128}$/.test(value.trim())) {
        throw barcodeError(400, 'יש להזין ברקוד המכיל ספרות בלבד (עד 128 ספרות), ללא אותיות או סימנים.');
    }
    return value.trim(); // Keep leading zeros. Never convert an identifier to a number.
}
function validateScope(environmentId, kind, excludeId) {
    if (!/^[a-f\d]{24}$/i.test(environmentId || '')) throw barcodeError(400, 'יש לבחור סביבת עבודה.', 'BARCODE_SCOPE');
    if (!['product', 'wallet'].includes(kind)) throw barcodeError(400, 'סוג ברקוד לא תקין.');
    if (excludeId !== undefined && !/^[a-f\d]{24}$/i.test(excludeId)) throw barcodeError(400, 'מזהה רשומה לא תקין.');
}
async function findConflict(db, environmentId, value, kind, excludeId) {
    validateScope(environmentId, kind, excludeId);
    const product = await db.product.findFirst({
        where: { environmentId, barcode: value, ...(kind === 'product' && excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true }
    });
    if (product) return 'product';
    const wallet = await db.wallet.findFirst({
        where: { environmentId, walletNumber: value, ...(kind === 'wallet' && excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true }
    });
    return wallet ? 'wallet' : null;
}
function conflictError(kind) {
    return barcodeError(409, `הברקוד כבר משויך ל${kind === 'product' ? 'מוצר' : 'ארנק'} בסביבת העבודה הנוכחית. יש להזין ברקוד אחר.`, 'BARCODE_IN_USE', { conflictType: kind });
}
async function assertAvailable(db, environmentId, value, kind, excludeId) {
    const conflict = await findConflict(db, environmentId, value, kind, excludeId);
    if (conflict) throw conflictError(conflict);
}
function retryable(error) {
    // Retry only a known aborted write-conflict, never a timeout/unknown commit outcome.
    return error?.code === 'P2034' || /\bWriteConflict\b|write conflict/i.test(error?.message || '');
}
async function ensureLock(db, environmentId) {
    if (!db.barcodeWriteLock) throw barcodeError(503, 'יש לייצר Prisma Client ולהפעיל מחדש את השרת לפני שמירת ברקוד.', 'BARCODE_SETUP_REQUIRED');
    try {
        await db.barcodeWriteLock.upsert({ where: { id: environmentId }, create: { id: environmentId, token: randomUUID() }, update: {} });
    } catch (error) {
        // Two processes can create the same built-in unique _id for the first time.
        if (error?.code !== 'P2002' || !await db.barcodeWriteLock.findUnique({ where: { id: environmentId } })) throw error;
    }
}
/** Both collections use the same per-environment write lock inside the transaction.
 * No TTL/lease or process-local mutex: crashes/rollbacks release the MongoDB lock.
 * Existing identifiers are read in the same transaction. No backfill or renumbering.
 */
async function withBarcodeWrite(db, environmentId, kind, value, excludeId, work) {
    validateScope(environmentId, kind, excludeId);
    const normalized = value === undefined ? undefined : normalizeBarcode(value);
    if (!excludeId && normalized === undefined) throw barcodeError(400, 'חובה להזין ברקוד.');
    try {
        await ensureLock(db, environmentId);
        for (let attempt = 0; ; attempt++) {
            try {
                return await db.$transaction(async tx => {
                    await tx.barcodeWriteLock.update({ where: { id: environmentId }, data: { token: randomUUID() } });
                    if (excludeId && !await tx[kind].findFirst({ where: { id: excludeId, environmentId }, select: { id: true } })) {
                        throw barcodeError(404, 'הרשומה לא נמצאה בסביבת העבודה הנוכחית.', 'BARCODE_RECORD_NOT_FOUND');
                    }
                    if (normalized !== undefined) await assertAvailable(tx, environmentId, normalized, kind, excludeId);
                    return work(tx, normalized);
                }, { maxWait: 5000, timeout: 15000 });
            } catch (error) {
                if (!retryable(error) || attempt >= 3) throw error;
                await sleep(20 * (2 ** attempt));
            }
        }
    } catch (error) {
        if (error?.code === 'P2031' || /replica set|Transaction numbers are only allowed/i.test(error?.message || '')) {
            throw barcodeError(503, 'שמירת ברקוד דורשת MongoDB עם תמיכה בטרנזקציות. הפעולה לא נשמרה.', 'BARCODE_TRANSACTIONS_REQUIRED');
        }
        throw error;
    }
}
function sendBarcodeError(error, res) {
    if (!error?.barcodeStatus) return false;
    res.status(error.barcodeStatus).json({ error: error.message, code: error.barcodeCode, ...(error.conflictType ? { conflictType: error.conflictType } : {}) });
    return true;
}
async function availabilityHandler(req, res, next) {
    try {
        const { requireTenantPrisma } = require('../utils/tenantContext.js');
        const db = requireTenantPrisma(req);
        const { value, kind, excludeId } = req.query;
        const barcode = normalizeBarcode(value);
        const conflictType = await findConflict(db, req.user.environmentId, barcode, kind, excludeId || undefined);
        return res.json({ environmentId: req.user.environmentId, available: !conflictType, conflictType, message: conflictType ? conflictError(conflictType).message : '' });
    } catch (error) { if (!sendBarcodeError(error, res)) next(error); }
}
module.exports = { MAX_LENGTH, barcodeError, normalizeBarcode, findConflict, assertAvailable, withBarcodeWrite, sendBarcodeError, availabilityHandler };
