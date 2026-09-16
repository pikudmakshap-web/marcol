const express = require('express');
const prisma = require('../config/database.js');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.js');

const router = express.Router();

router.use(authenticateToken);

// GET /api/settings - משיכת הגדרות מערכת (כולם יכולים לקרוא, כדי לדעת אחוז ולהציג מלאי נמוך תקין לרופאים למשל)
router.get('/', async (req, res, next) => {
    try {
        let settings = await prisma.systemSettings.findFirst();

        // אם לא קיימות הגדרות, ניצור הגדרות ברירת מחדל
        if (!settings) {
            settings = await prisma.systemSettings.create({
                data: {
                    lowStockPercentage: 10.0 // 10% ברירת מחדל
                }
            });
        }

        res.json(settings);
    } catch (error) {
        next(error);
    }
});

// רק מנהלים יכולים לעדכן הגדרות
router.use(authorizeRoles('admin'));

// PUT /api/settings - עדכון הגדרות מערכת
router.put('/', async (req, res, next) => {
    try {
        let { lowStockPercentage } = req.body;

        if (lowStockPercentage !== undefined) {
            lowStockPercentage = parseFloat(lowStockPercentage);
            if (isNaN(lowStockPercentage) || lowStockPercentage < 0 || lowStockPercentage > 100) {
                return res.status(400).json({ error: 'אחוז המלאי חייב להיות בין 0 ל-100' });
            }
        }

        let settings = await prisma.systemSettings.findFirst();

        if (settings) {
            settings = await prisma.systemSettings.update({
                where: { id: settings.id },
                data: {
                    lowStockPercentage: lowStockPercentage !== undefined ? lowStockPercentage : settings.lowStockPercentage
                }
            });
        } else {
            settings = await prisma.systemSettings.create({
                data: {
                    lowStockPercentage: lowStockPercentage !== undefined ? lowStockPercentage : 10.0
                }
            });
        }

        res.json(settings);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
