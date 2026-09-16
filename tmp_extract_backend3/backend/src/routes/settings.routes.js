const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.js');
const { requireTenantPrisma } = require('../utils/tenantContext.js');

const router = express.Router();
router.use(authenticateToken);

// GET /api/settings
router.get('/', async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        let settings = await tenantPrisma.systemSettings.findFirst({
            where: { environmentId: req.user.environmentId }
        });

        if (!settings) {
            settings = await tenantPrisma.systemSettings.create({
                data: {
                    lowStockPercentage: 10.0,
                    environmentId: req.user.environmentId
                }
            });
        }

        return res.json(settings);
    } catch (error) {
        return next(error);
    }
});

router.use(authorizeRoles('admin'));

// PUT /api/settings
router.put('/', async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        let { lowStockPercentage } = req.body;

        if (lowStockPercentage !== undefined) {
            lowStockPercentage = parseFloat(lowStockPercentage);
            if (Number.isNaN(lowStockPercentage) || lowStockPercentage < 0 || lowStockPercentage > 100) {
                return res.status(400).json({ error: 'אחוז המלאי חייב להיות בין 0 ל-100' });
            }
        }

        let settings = await tenantPrisma.systemSettings.findFirst({
            where: { environmentId: req.user.environmentId }
        });

        if (settings) {
            settings = await tenantPrisma.systemSettings.update({
                where: { id: settings.id },
                data: {
                    lowStockPercentage: lowStockPercentage !== undefined ? lowStockPercentage : settings.lowStockPercentage
                }
            });
        } else {
            settings = await tenantPrisma.systemSettings.create({
                data: {
                    lowStockPercentage: lowStockPercentage !== undefined ? lowStockPercentage : 10.0,
                    environmentId: req.user.environmentId
                }
            });
        }

        return res.json(settings);
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
