import express from 'express';
import prisma from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);
router.use(authorizeRoles('admin'));

// GET /api/inventory - מצב מלאי
router.get('/', async (req, res, next) => {
    try {
        const inventory = await prisma.inventory.findMany({
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        sku: true,
                        barcode: true,
                        category: true,
                        unitPrice: true,
                        isActive: true
                    }
                },
                restockedBy: {
                    select: {
                        fullName: true
                    }
                }
            }
        });

        res.json(inventory);
    } catch (error) {
        next(error);
    }
});

// POST /api/inventory/restock - הוספת מלאי
router.post('/restock', async (req, res, next) => {
    try {
        const { productId, quantity, costPerUnit, location, expiryDate } = req.body;

        if (!productId || !quantity) {
            return res.status(400).json({ error: 'Required fields: productId, quantity' });
        }

        const inventory = await prisma.inventory.upsert({
            where: { productId: productId },
            update: {
                quantity: {
                    increment: parseInt(quantity)
                },
                costPerUnit: costPerUnit ? parseFloat(costPerUnit) : undefined,
                location,
                expiryDate: expiryDate ? new Date(expiryDate) : undefined,
                lastRestockDate: new Date(),
                lastRestockBy: req.user.id
            },
            create: {
                productId: productId,
                quantity: parseInt(quantity),
                costPerUnit: costPerUnit ? parseFloat(costPerUnit) : undefined,
                location,
                expiryDate: expiryDate ? new Date(expiryDate) : undefined,
                lastRestockDate: new Date(),
                lastRestockBy: req.user.id
            },
            include: {
                product: {
                    select: {
                        name: true
                    }
                }
            }
        });

        res.json(inventory);
    } catch (error) {
        next(error);
    }
});

// GET /api/inventory/alerts - התראות מלאי נמוך
router.get('/alerts', async (req, res, next) => {
    try {
        const alerts = await prisma.inventory.findMany({
            where: {
                quantity: {
                    lte: prisma.inventory.fields.minStockAlert
                },
                product: {
                    isActive: true
                }
            },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        sku: true,
                        category: true
                    }
                }
            }
        });

        res.json(alerts);
    } catch (error) {
        next(error);
    }
});

export default router;
