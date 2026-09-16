const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.js');
const { usersPrisma } = require('../config/database.js');
const { requireTenantPrisma } = require('../utils/tenantContext.js');
const { buildUserMapByIds } = require('../utils/userLookup.js');

const router = express.Router();
router.use(authenticateToken);
router.use(authorizeRoles('admin', 'officer'));

// GET /api/dashboard/stats - Aggregated dashboard statistics
router.get('/stats', async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [
            activeWallets,
            todaySalesTxs,
            recentSales,
            activeProductsImages,
            recentTransactions,
            activeProducts,
            settings
        ] = await Promise.all([
            tenantPrisma.wallet.findMany({ where: { isActive: true, environmentId: req.user.environmentId } }),
            tenantPrisma.transaction.findMany({
                where: { transactionType: 'sale', createdAt: { gte: startOfToday }, environmentId: req.user.environmentId }
            }),
            tenantPrisma.transaction.findMany({
                where: { transactionType: 'sale', createdAt: { gte: thirtyDaysAgo }, environmentId: req.user.environmentId },
                select: { items: true }
            }),
            tenantPrisma.product.findMany({ where: { environmentId: req.user.environmentId }, select: { id: true, name: true } }),
            tenantPrisma.transaction.findMany({
                where: { transactionType: 'sale', environmentId: req.user.environmentId },
                orderBy: { createdAt: 'desc' },
                take: 7,
                select: {
                    id: true,
                    officerId: true,
                    cashierId: true,
                    walletId: true,
                    totalAmount: true,
                    createdAt: true,
                    wallet: { select: { name: true } }
                }
            }),
            tenantPrisma.product.findMany({
                where: { isActive: true, environmentId: req.user.environmentId },
                select: { id: true, name: true, quantity: true, initialQuantity: true, unitPrice: true }
            }),
            tenantPrisma.systemSettings.findFirst({ where: { environmentId: req.user.environmentId } })
        ]);
        const userMap = await buildUserMapByIds(
            usersPrisma,
            recentTransactions.flatMap((t) => [t.officerId, t.cashierId])
        );

        const walletsCount = activeWallets.length;
        const totalCurrentBalance = activeWallets.reduce((sum, w) => sum + w.currentBalance, 0);
        const todaySalesAmount = todaySalesTxs.reduce((sum, t) => sum + t.totalAmount, 0);

        const productStats = {};
        for (const sale of recentSales) {
            for (const item of sale.items) {
                if (!item.productName) continue;

                if (!productStats[item.productName]) {
                    productStats[item.productName] = {
                        name: item.productName,
                        sales: 0,
                        revenue: 0,
                        icon: 'fastfood',
                        color: 'bg-blue-100 text-blue-600',
                        productId: activeProductsImages.find((p) => p.name === item.productName)?.id
                    };
                }
                productStats[item.productName].sales += item.quantity;
                productStats[item.productName].revenue += item.lineTotal;
            }
        }

        const topProducts = Object.values(productStats)
            .sort((a, b) => b.sales - a.sales)
            .slice(0, 5)
            .map((p, idx) => {
                const colors = [
                    'bg-orange-100 text-orange-600',
                    'bg-amber-100 text-amber-600',
                    'bg-green-100 text-green-600',
                    'bg-orange-50 text-orange-500',
                    'bg-pink-100 text-pink-500'
                ];
                const icons = ['coffee', 'bakery_dining', 'lunch_dining', 'local_bar', 'cake'];
                return {
                    ...p,
                    id: idx + 1,
                    color: colors[idx] || colors[0],
                    icon: icons[idx] || icons[0]
                };
            });

        const walletUsage = recentTransactions.map((t, idx) => {
            const date = new Date(t.createdAt);
            const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
            const officer = userMap.get(t.officerId);
            const cashier = userMap.get(t.cashierId);
            const officerName = officer?.role === 'admin'
                ? '???????? ??????????'
                : (officer?.fullName || (cashier?.role === 'admin' ? '???????? ??????????' : cashier?.fullName) || '??????????');

            const colors = [
                'bg-yellow-100 text-yellow-600',
                'bg-blue-100 text-blue-600',
                'bg-purple-100 text-purple-600',
                'bg-gray-100 text-gray-600',
                'bg-green-100 text-green-600'
            ];

            return {
                id: t.id || idx + 1,
                name: officerName,
                wallet: t.wallet?.name || 'ארנק לא קיים',
                time: timeStr,
                date: dateStr,
                amount: t.totalAmount,
                icon: 'account_balance_wallet',
                color: colors[idx % colors.length]
            };
        });

        const lowStockPercentage = settings?.lowStockPercentage || 10;
        const lowStockProductsCalculated = activeProducts.filter((p) => {
            if (p.quantity === 0) return true;
            const refQty = (p.initialQuantity && p.initialQuantity > 0) ? p.initialQuantity : p.quantity;
            const threshold = Math.max(1, Math.ceil(refQty * (lowStockPercentage / 100)));
            return p.quantity <= threshold;
        });

        const productIdsToFetchImages = [
            ...topProducts.map((p) => p.productId).filter(Boolean),
            ...lowStockProductsCalculated.map((p) => p.id)
        ];
        const uniqueProductIds = [...new Set(productIdsToFetchImages)];

        const productImagesResult = await tenantPrisma.product.findMany({
            where: { id: { in: uniqueProductIds }, environmentId: req.user.environmentId },
            select: { id: true, imageUrl: true }
        });

        const imageMap = {};
        productImagesResult.forEach((p) => {
            imageMap[p.id] = p.imageUrl;
        });

        const finalTopProducts = topProducts.map((p) => ({
            ...p,
            imageUrl: imageMap[p.productId] || null
        }));

        const finalLowStockProducts = lowStockProductsCalculated.map((p) => ({
            ...p,
            imageUrl: imageMap[p.id] || null
        }));

        const isCategoryMode = activeWallets.some((w) => Array.isArray(w.categoryBalances) && w.categoryBalances.length > 0);
        const systemMode = activeWallets.length === 0 ? 'none' : (isCategoryMode ? 'category' : 'general');

        const categoryStatsMap = {};
        activeWallets.forEach((w) => {
            if (!Array.isArray(w.categoryBalances)) return;
            w.categoryBalances.forEach((cat) => {
                if (!categoryStatsMap[cat.categoryName]) {
                    categoryStatsMap[cat.categoryName] = { name: cat.categoryName, totalBalance: 0 };
                }
                categoryStatsMap[cat.categoryName].totalBalance += cat.balance;
            });
        });

        const categoryColors = await tenantPrisma.category.findMany({
            where: { environmentId: req.user.environmentId },
            select: { name: true, color: true }
        });
        const colorMap = {};
        categoryColors.forEach((c) => {
            colorMap[c.name] = c.color;
        });

        const walletCategoryStats = Object.values(categoryStatsMap)
            .sort((a, b) => b.totalBalance - a.totalBalance)
            .map((cat) => ({ ...cat, color: colorMap[cat.name] || '#e5e7eb' }));

        const lowestStockProducts = [...activeProducts]
            .sort((a, b) => (a.quantity || 0) - (b.quantity || 0))
            .slice(0, 4)
            .map((p) => ({ ...p, imageUrl: imageMap[p.id] || null }));

        const inventoryValue = activeProducts.reduce((sum, p) => sum + ((p.quantity || 0) * (p.unitPrice || 0)), 0);

        res.json({
            budget: {
                total: totalCurrentBalance,
                current: totalCurrentBalance
            },
            inventoryValue,
            sales: {
                today: todaySalesAmount,
                goal: 5000
            },
            wallets: {
                count: walletsCount,
                totalBalance: totalCurrentBalance
            },
            topProducts: finalTopProducts,
            walletUsage,
            lowStockProducts: finalLowStockProducts,
            walletCategoryStats,
            lowestStockProducts,
            systemMode
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
