const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.js');
const { usersPrisma } = require('../config/database.js');
const { requireTenantPrisma } = require('../utils/tenantContext.js');
const { buildUserMapByIds } = require('../utils/userLookup.js');

const router = express.Router();
router.use(authenticateToken);
router.use(authorizeRoles('admin', 'officer'));

// GET /api/reports/transactions - דוח עסקאות
router.get('/transactions', async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const { startDate, endDate, walletId } = req.query;
        const where = { environmentId: req.user.environmentId };

        if (req.user.role === 'officer') {
            where.officerId = req.user.id;
        }
        if (startDate) where.createdAt = { gte: new Date(startDate) };
        if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
        if (walletId) where.walletId = walletId;

        const transactions = await tenantPrisma.transaction.findMany({
            where,
            select: {
                id: true,
                transactionNumber: true,
                officerId: true,
                walletId: true,
                totalAmount: true,
                transactionType: true,
                status: true,
                notes: true,
                createdAt: true,
                environmentId: true,
                wallet: { select: { name: true } },
                items: true
            },
            orderBy: { createdAt: 'desc' }
        });
        const userMap = await buildUserMapByIds(usersPrisma, transactions.map((t) => t.officerId));
        const enrichedTransactions = transactions.map((transaction) => ({
            ...transaction,
            officer: userMap.get(transaction.officerId)
                ? { fullName: userMap.get(transaction.officerId).fullName }
                : null
        }));

        const stats = {
            totalTransactions: transactions.length,
            totalSales: transactions.filter((t) => t.transactionType === 'sale').length,
            totalReturns: transactions.filter((t) => t.transactionType === 'return').length,
            totalAmount: transactions.reduce((sum, t) => (
                sum + (t.transactionType === 'sale' ? parseFloat(t.totalAmount) : -parseFloat(t.totalAmount))
            ), 0),
            transactions: enrichedTransactions
        };

        return res.json(stats);
    } catch (error) {
        return next(error);
    }
});

// GET /api/reports/inventory - דוח מלאי
router.get('/inventory', authorizeRoles('admin'), async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const inventory = await tenantPrisma.product.findMany({
            where: { environmentId: req.user.environmentId },
            select: {
                id: true,
                name: true,
                category: true,
                unitPrice: true,
                sku: true,
                quantity: true,
                minStockAlert: true,
                costPerUnit: true,
                lastRestockDate: true
            }
        });

        const stats = {
            totalProducts: inventory.length,
            lowStockItems: inventory.filter((i) => i.quantity <= i.minStockAlert).length,
            totalValue: inventory.reduce((sum, i) => (
                sum + (i.costPerUnit ? parseFloat(i.costPerUnit) * i.quantity : 0)
            ), 0),
            inventory
        };

        return res.json(stats);
    } catch (error) {
        return next(error);
    }
});

// GET /api/reports/wallet/:id - דוח ארנק
router.get('/wallet/:id', async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const walletId = req.params.id;

        if (req.user.role === 'officer') {
            const hasAccess = await tenantPrisma.walletUser.findFirst({
                where: { walletId, userId: req.user.id }
            });
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        const wallet = await tenantPrisma.wallet.findUnique({
            where: { id: walletId },
            include: {
                transactions: {
                    select: {
                        id: true,
                        transactionNumber: true,
                        officerId: true,
                        totalAmount: true,
                        transactionType: true,
                        status: true,
                        notes: true,
                        createdAt: true,
                        items: true
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        const walletUserMap = await buildUserMapByIds(
            usersPrisma,
            wallet?.transactions?.map((transaction) => transaction.officerId) || []
        );
        const enrichedWalletTransactions = (wallet?.transactions || []).map((transaction) => ({
            ...transaction,
            officer: walletUserMap.get(transaction.officerId)
                ? { fullName: walletUserMap.get(transaction.officerId).fullName }
                : null
        }));

        if (!wallet || wallet.environmentId !== req.user.environmentId) {
            return res.status(404).json({ error: 'Wallet not found' });
        }

        const stats = {
            wallet: {
                name: wallet.name,
                currentBalance: wallet.currentBalance
            },
            totalSpent: wallet.transactions
                .filter((t) => t.transactionType === 'sale')
                .reduce((sum, t) => sum + parseFloat(t.totalAmount), 0),
            transactionCount: wallet.transactions.length,
            transactions: enrichedWalletTransactions
        };

        return res.json(stats);
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
