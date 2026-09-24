const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.js');
const { verifiedMutation } = require('../middleware/verifiedMutation.js');
const { requireTenantPrisma } = require('../utils/tenantContext.js');
const { getIO } = require('../socket.js');
const router = express.Router();
router.use(authenticateToken);
const normalized = (settings) => ({ ...settings, posManualEntryDisabled: settings.posManualEntryDisabled === true });
router.get('/', async (req, res, next) => {
    try {
        const tenant = requireTenantPrisma(req);
        const settings = await tenant.systemSettings.findFirst({ where: { environmentId: req.user.environmentId } });
        // Do not create data on a GET. A missing/legacy field preserves the original behavior.
        return res.json(normalized(settings || { environmentId: req.user.environmentId, lowStockPercentage: 10 }));
    } catch (error) { return next(error); }
});
router.put('/', authorizeRoles('admin'), verifiedMutation, async (req, res, next) => {
    try {
        const tenant = requireTenantPrisma(req);
        const data = {};
        if (req.body.lowStockPercentage !== undefined) {
            const value = req.body.lowStockPercentage;
            if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100) {
                return res.status(400).json({ error: 'אחוז המלאי חייב להיות בין 0 ל-100' });
            }
            data.lowStockPercentage = Number(value);
        }
        if (req.body.posManualEntryDisabled !== undefined) {
            if (typeof req.body.posManualEntryDisabled !== 'boolean') return res.status(400).json({ error: 'הגדרת ההקלדה חייבת להיות פעילה או כבויה' });
            data.posManualEntryDisabled = req.body.posManualEntryDisabled;
        }
        if (!Object.keys(data).length) return res.status(400).json({ error: 'לא נשלחו הגדרות לעדכון' });
        const settings = await tenant.systemSettings.upsert({
            where: { environmentId: req.user.environmentId }, update: data,
            create: { environmentId: req.user.environmentId, lowStockPercentage: 10, posManualEntryDisabled: false, ...data }
        });
        try { getIO().emit('data_update', { type: 'settings', environmentId: req.user.environmentId }); } catch (_error) { /* Saved successfully. */ }
        return res.json(normalized(settings));
    } catch (error) { return next(error); }
});
module.exports = router;
