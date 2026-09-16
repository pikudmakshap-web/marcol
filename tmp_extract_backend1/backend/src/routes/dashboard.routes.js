const express = require('express');
const prisma = require('../config/database.js');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.js');

const router = express.Router();
router.use(authenticateToken);
router.use(authorizeRoles('admin', 'officer'));

// GET /api/dashboard/stats - Aggregated dashboard statistics
router.get('/stats', async (req, res, next) => {
    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Run all independent queries concurrently to eliminate waterfall delays
        const [
            activeWallets,
            todaySalesTxs,
            recentSales,
            activeProductsImages,
            recentTransactions,
            activeProducts,
            settings
        ] = await Promise.all([
            // 1. Wallets Overview
            prisma.wallet.findMany({ where: { isActive: true } }),

            // 2. Today's Sales
            prisma.transaction.findMany({
                where: { transactionType: 'sale', createdAt: { gte: startOfToday } }
            }),

            // 3. Top Selling Products Base Data
            prisma.transaction.findMany({
                where: { transactionType: 'sale', createdAt: { gte: thirtyDaysAgo } },
                select: { items: true }
            }),
            prisma.product.findMany({ select: { id: true, name: true } }), // Only fetch ID and name, NOT imageUrl

            // 4. Recent Wallet Usage (Transactions)
            prisma.transaction.findMany({
                where: { transactionType: 'sale' },
                orderBy: { createdAt: 'desc' },
                take: 7,
                include: {
                    officer: { select: { fullName: true } },
                    cashier: { select: { fullName: true } },
                    wallet: { select: { name: true } }
                }
            }),

            // 5. Low Stock Alerts Base Data
            prisma.product.findMany({
                where: { isActive: true },
                select: { id: true, name: true, quantity: true, initialQuantity: true } // Removed imageUrl here
            }),
            prisma.systemSettings.findFirst()
        ]);

        // Process 1: Wallets Overview
        const walletsCount = activeWallets.length;
        const totalCurrentBalance = activeWallets.reduce((sum, w) => sum + w.currentBalance, 0);

        // Process 2: Today's Sales
        const todaySalesAmount = todaySalesTxs.reduce((sum, t) => sum + t.totalAmount, 0);

        // Process 3: Top Selling Products
        const productStats = {};
        for (const sale of recentSales) {
            for (const item of sale.items) {
                if (item.productName) {
                    if (!productStats[item.productName]) {
                        productStats[item.productName] = {
                            name: item.productName,
                            sales: 0,
                            revenue: 0,
                            // Mapping a default icon, usually you'd have an icon ID in DB
                            icon: "fastfood",
                            color: "bg-blue-100 text-blue-600",
                            productId: activeProductsImages.find(p => p.name === item.productName)?.id // Attach product ID for later
                        };
                    }
                    productStats[item.productName].sales += item.quantity;
                    productStats[item.productName].revenue += item.lineTotal;
                }
            }
        }

        const topProducts = Object.values(productStats)
            .sort((a, b) => b.sales - a.sales)
            .slice(0, 5)
            .map((p, idx) => {
                p.id = idx + 1;
                // Give dynamic colors based on rank
                const colors = [
                    "bg-orange-100 text-orange-600",
                    "bg-amber-100 text-amber-600",
                    "bg-green-100 text-green-600",
                    "bg-orange-50 text-orange-500",
                    "bg-pink-100 text-pink-500"
                ];
                const icons = ["coffee", "bakery_dining", "lunch_dining", "local_bar", "cake"];
                p.color = colors[idx] || colors[0];
                p.icon = icons[idx] || icons[0];
                return p;
            });

        // Process 4: Recent Wallet Usage (Transactions)
        const walletUsage = recentTransactions.map((t, idx) => {
            const date = new Date(t.createdAt);
            const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
            const officerName = t.officer?.fullName || t.cashier?.fullName || 'מערכת';

            const colors = [
                "bg-yellow-100 text-yellow-600",
                "bg-blue-100 text-blue-600",
                "bg-purple-100 text-purple-600",
                "bg-gray-100 text-gray-600",
                "bg-green-100 text-green-600"
            ];

            return {
                id: t.id || idx + 1,
                name: officerName,
                wallet: t.wallet?.name || 'ללא ארנק',
                time: timeStr,
                date: dateStr,
                amount: t.totalAmount,
                icon: "account_balance_wallet",
                color: colors[idx % colors.length]
            };
        });

        // Process 5: Low Stock Alerts
        const lowStockPercentage = settings?.lowStockPercentage || 10;

        const lowStockProductsCalculated = activeProducts.filter(p => {
            if (p.quantity === 0) return true; // Always include Out of Stock
            const threshold = Math.ceil((p.initialQuantity || 0) * (lowStockPercentage / 100));
            return p.quantity <= threshold && (p.initialQuantity || 0) > 0;
        });

        // --- SECONDARY FETCH for Base64 Images ---
        // Now that we have calculated exactly which handful of products we are returning (Top 5 and Low Stock),
        // we can fetch their `imageUrl` specifically, instead of downloading all product images. 
        const productIdsToFetchImages = [
            ...topProducts.map(p => p.productId).filter(id => id),
            ...lowStockProductsCalculated.map(p => p.id)
        ];

        // Ensure uniqueness
        const uniqueProductIds = [...new Set(productIdsToFetchImages)];

        const productImagesResult = await prisma.product.findMany({
            where: { id: { in: uniqueProductIds } },
            select: { id: true, imageUrl: true }
        });

        const imageMap = {};
        productImagesResult.forEach(p => {
            imageMap[p.id] = p.imageUrl;
        });

        // Stitch images into topProducts
        const finalTopProducts = topProducts.map(p => ({
            ...p,
            imageUrl: imageMap[p.productId] || null
        }));

        // Stitch images into lowStockProducts
        const finalLowStockProducts = lowStockProductsCalculated.map(p => ({
            ...p,
            imageUrl: imageMap[p.id] || null
        }));

        res.json({
            budget: {
                total: totalCurrentBalance,
                current: totalCurrentBalance
            },
            sales: {
                today: todaySalesAmount,
                goal: 5000 // Configurable or fixed goal
            },
            wallets: {
                count: walletsCount,
                totalBalance: totalCurrentBalance
            },
            topProducts: finalTopProducts,
            walletUsage,
            lowStockProducts: finalLowStockProducts
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
