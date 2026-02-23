import express from 'express';
import prisma from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// POST /api/transactions - יצירת עסקה חדשה (Checkout)
router.post('/', authorizeRoles('admin', 'cashier'), async (req, res, next) => {
    try {
        const { officerId, walletId, items, notes } = req.body;

        if (!officerId || !walletId || !items || items.length === 0) {
            return res.status(400).json({
                error: 'Required fields: officerId, walletId, items'
            });
        }

        // Calculate total
        const totalAmount = items.reduce((sum, item) => {
            return sum + (parseFloat(item.unitPrice) * parseInt(item.quantity));
        }, 0);

        // Check wallet balance
        const wallet = await prisma.wallet.findUnique({
            where: { id: walletId }
        });

        if (!wallet || !wallet.isActive) {
            return res.status(400).json({ error: 'Invalid or inactive wallet' });
        }

        if (wallet.currentBalance < totalAmount) {
            return res.status(400).json({
                error: 'Insufficient wallet balance',
                balance: wallet.currentBalance,
                required: totalAmount
            });
        }

        // Check inventory stock
        const productErrors = [];
        for (const item of items) {
            if (item.productId) {
                const inv = await prisma.inventory.findUnique({ where: { productId: item.productId } });
                const qtyRequest = parseInt(item.quantity) || 0;

                if (!inv) {
                    productErrors.push(`אין רשומת מלאי למוצר '${item.productName}'`);
                } else if (inv.quantity < qtyRequest) {
                    productErrors.push(`אין במלאי '${item.productName}'. נדרש: ${qtyRequest}, זמין: ${inv.quantity}`);
                }
            }
        }

        if (productErrors.length > 0) {
            return res.status(400).json({ error: productErrors.join(' | ') });
        }

        // Create transaction with items
        const transaction = await prisma.$transaction(async (tx) => {
            // Create transaction
            const trans = await tx.transaction.create({
                data: {
                    transactionNumber: `TRX-${Date.now()}`,
                    officerId: officerId,
                    cashierId: req.user.id,
                    walletId: walletId,
                    totalAmount,
                    transactionType: 'sale',
                    notes,
                    items: {
                        create: items.map(item => ({
                            productId: item.productId ? item.productId : null,
                            productName: item.productName,
                            quantity: parseInt(item.quantity),
                            unitPrice: parseFloat(item.unitPrice),
                            lineTotal: parseFloat(item.unitPrice) * parseInt(item.quantity)
                        }))
                    }
                },
                include: {
                    items: true,
                    officer: {
                        select: {
                            fullName: true,
                            personalNumber: true
                        }
                    },
                    wallet: {
                        select: {
                            name: true
                        }
                    }
                }
            });

            // Deduct from wallet
            await tx.wallet.update({
                where: { id: walletId },
                data: {
                    currentBalance: {
                        decrement: totalAmount
                    }
                }
            });

            // Deduct from inventory
            for (const item of items) {
                if (item.productId) {
                    await tx.inventory.update({
                        where: { productId: item.productId },
                        data: {
                            quantity: {
                                decrement: parseInt(item.quantity)
                            }
                        }
                    });
                }
            }

            return trans;
        });

        res.status(201).json(transaction);

    } catch (error) {
        next(error);
    }
});

// GET /api/transactions - רשימת עסקאות
router.get('/', async (req, res, next) => {
    try {
        const { startDate, endDate, walletId, officerId } = req.query;

        const where = {};

        // Filter by role
        if (req.user.role === 'officer') {
            where.officerId = req.user.id;
        }

        if (startDate) {
            where.createdAt = { gte: new Date(startDate) };
        }
        if (endDate) {
            where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
        }
        if (walletId) {
            where.walletId = walletId;
        }
        if (officerId) {
            where.officerId = officerId;
        }

        const transactions = await prisma.transaction.findMany({
            where,
            include: {
                officer: {
                    select: {
                        fullName: true,
                        personalNumber: true
                    }
                },
                cashier: {
                    select: {
                        fullName: true
                    }
                },
                wallet: {
                    select: {
                        name: true
                    }
                },
                items: true
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(transactions);

    } catch (error) {
        next(error);
    }
});

// GET /api/transactions/:id - פרטי עסקה
router.get('/:id', async (req, res, next) => {
    try {
        const transaction = await prisma.transaction.findUnique({
            where: { id: req.params.id },
            include: {
                officer: {
                    select: {
                        fullName: true,
                        personalNumber: true
                    }
                },
                cashier: {
                    select: {
                        fullName: true
                    }
                },
                wallet: {
                    select: {
                        name: true,
                        currentBalance: true
                    }
                },
                items: {
                    include: {
                        product: {
                            select: {
                                name: true,
                                sku: true
                            }
                        }
                    }
                }
            }
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Check permissions
        if (req.user.role === 'officer' && transaction.officerId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(transaction);

    } catch (error) {
        next(error);
    }
});

// POST /api/transactions/:id/return - החזרת עסקה
router.post('/:id/return', authorizeRoles('admin', 'cashier'), async (req, res, next) => {
    try {
        const originalTransaction = await prisma.transaction.findUnique({
            where: { id: req.params.id },
            include: { items: true }
        });

        if (!originalTransaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        if (originalTransaction.transactionType === 'return') {
            return res.status(400).json({ error: 'Cannot return a return transaction' });
        }

        // Create return transaction
        const returnTransaction = await prisma.$transaction(async (tx) => {
            const trans = await tx.transaction.create({
                data: {
                    transactionNumber: `RTN-${Date.now()}`,
                    officerId: originalTransaction.officerId,
                    cashierId: req.user.id,
                    walletId: originalTransaction.walletId,
                    totalAmount: originalTransaction.totalAmount,
                    transactionType: 'return',
                    notes: `Return of ${originalTransaction.transactionNumber}`,
                    items: {
                        create: originalTransaction.items.map(item => ({
                            productId: item.productId,
                            productName: item.productName,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            lineTotal: item.lineTotal
                        }))
                    }
                },
                include: { items: true }
            });

            // Credit wallet
            await tx.wallet.update({
                where: { id: originalTransaction.walletId },
                data: {
                    currentBalance: {
                        increment: originalTransaction.totalAmount
                    }
                }
            });

            // Return to inventory
            for (const item of originalTransaction.items) {
                if (item.productId) {
                    await tx.inventory.update({
                        where: { productId: item.productId },
                        data: {
                            quantity: {
                                increment: item.quantity
                            }
                        }
                    });
                }
            }

            return trans;
        });

        res.status(201).json(returnTransaction);

    } catch (error) {
        next(error);
    }
});

export default router;
