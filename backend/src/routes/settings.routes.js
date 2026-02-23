import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';


const router = express.Router();
const prisma = new PrismaClient();

// Get System Settings
// Public or protected depending on needs, but usually authenticated
router.get('/', authenticateToken, async (req, res, next) => {
    try {
        console.log("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

        let settings = await prisma.systemSettings.findFirst();
        if (!settings) {
            settings = await prisma.systemSettings.create({
                data: {
                    lowStockThreshold: 10
                }
            });
        }
        res.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Server error fetching settings' });
    }
});

// Update System Settings (Admin Only)
router.put('/', authenticateToken, authorizeRoles('admin', 'officer'), async (req, res) => {
    try {
        const { lowStockThreshold } = req.body;

        let settings = await prisma.systemSettings.findFirst();

        if (!settings) {
            settings = await prisma.systemSettings.create({
                data: {
                    lowStockThreshold: lowStockThreshold !== undefined ? parseInt(lowStockThreshold, 10) : 10
                }
            });
        } else {
            settings = await prisma.systemSettings.update({
                where: { id: settings.id },
                data: {
                    lowStockThreshold: lowStockThreshold !== undefined ? parseInt(lowStockThreshold, 10) : settings.lowStockThreshold
                }
            });
        }

        res.json(settings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Server error updating settings' });
    }
});

export default router;
