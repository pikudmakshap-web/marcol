import express from 'express';
import prisma from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);
router.use(authorizeRoles('admin', 'officer'));

// GET /api/reports/transactions - דוח עסקאות
router.get('/transactions', async (req, res, next) => {
    try {
        const { startDate, endDate, walletId, groupBy } = req.query;

        const where = {};

        // Officers can only see their own transactions
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

        const transactions = await prisma.transaction.findMany({
            where,
            include: {
                officer: { select: { fullName: true } },
                wallet: { select: { name: true } },
                items: true
            },
            orderBy: { createdAt: 'desc' }
        });

        // Basic statistics
        const stats = {
            totalTransactions: transactions.length,
            totalSales: transactions.filter(t => t.transactionType === 'sale').length,
            totalReturns: transactions.filter(t => t.transactionType === 'return').length,
            totalAmount: transactions.reduce((sum, t) =>
                sum + (t.transactionType === 'sale' ? parseFloat(t.totalAmount) : -parseFloat(t.totalAmount)), 0
            ),
            transactions
        };

        res.json(stats);

    } catch (error) {
        next(error);
    }
});

// GET /api/reports/inventory - דוח מלאי
router.get('/inventory', authorizeRoles('admin'), async (req, res, next) => {
    try {
        const inventory = await prisma.inventory.findMany({
            include: {
                product: {
                    select: {
                        name: true,
                        category: true,
                        unitPrice: true,
                        sku: true
                    }
                }
            }
        });

        const stats = {
            totalProducts: inventory.length,
            lowStockItems: inventory.filter(i => i.quantity <= i.minStockAlert).length,
            totalValue: inventory.reduce((sum, i) =>
                sum + (i.costPerUnit ? parseFloat(i.costPerUnit) * i.quantity : 0), 0
            ),
            inventory
        };

        res.json(stats);

    } catch (error) {
        next(error);
    }
});

// GET /api/reports/wallet/:id - דוח ארנק
router.get('/wallet/:id', async (req, res, next) => {
    try {
        const walletId = req.params.id;

        // Check if officer has access to this wallet
        if (req.user.role === 'officer') {
            const hasAccess = await prisma.walletUser.findFirst({
                where: {
                    walletId,
                    userId: req.user.id
                }
            });

            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        const wallet = await prisma.wallet.findUnique({
            where: { id: walletId },
            include: {
                transactions: {
                    include: {
                        officer: { select: { fullName: true } },
                        items: true
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!wallet) {
            return res.status(404).json({ error: 'Wallet not found' });
        }

        const stats = {
            wallet: {
                name: wallet.name,
                currentBalance: wallet.currentBalance,
                maxLimit: wallet.maxLimit,
                utilization: (parseFloat(wallet.currentBalance) / parseFloat(wallet.maxLimit)) * 100
            },
            totalSpent: wallet.transactions
                .filter(t => t.transactionType === 'sale')
                .reduce((sum, t) => sum + parseFloat(t.totalAmount), 0),
            transactionCount: wallet.transactions.length,
            transactions: wallet.transactions
        };

        res.json(stats);

    } catch (error) {
        next(error);
    }
});

export default router;
