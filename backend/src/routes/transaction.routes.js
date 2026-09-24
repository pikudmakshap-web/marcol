const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.js');
const { getIO } = require('../socket.js');
const { usersPrisma } = require('../config/database.js');
const { sendPurchaseEmail } = require('../services/emailService.js');
const { requireTenantPrisma } = require('../utils/tenantContext.js');
const { buildUserMapByIds } = require('../utils/userLookup.js');

const router = express.Router();
router.use(authenticateToken);

// POST /api/transactions - יצירת עסקה חדשה (Checkout)
router.post('/', authorizeRoles('admin', 'cashier'), async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const { officerId, walletId, items, notes } = req.body;

        if (!officerId || !walletId || !items || items.length === 0) {
            return res.status(400).json({ error: 'Required fields: officerId, walletId, items' });
        }

        const member = await tenantPrisma.walletUser.findFirst({ where: { walletId, userId: officerId } });
        if (!member) return res.status(400).json({ error: 'מקבל המוצרים אינו משויך לארנק שנבחר' });

        const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.unitPrice) * parseInt(item.quantity, 10)), 0);

        const wallet = await tenantPrisma.wallet.findUnique({ where: { id: walletId } });
        if (!wallet || !wallet.isActive || wallet.environmentId !== req.user.environmentId) {
            return res.status(400).json({ error: 'Invalid or inactive wallet' });
        }

        if (wallet.currentBalance < totalAmount) {
            return res.status(400).json({
                error: 'Insufficient wallet balance',
                balance: wallet.currentBalance,
                required: totalAmount
            });
        }

        const productErrors = [];
        const categoryTotals = {};

        for (const item of items) {
            if (!item.productId) {
                productErrors.push('שגיאה: פריט חסר מזהה מוצר.');
                continue;
            }

            // eslint-disable-next-line no-await-in-loop
            const prod = await tenantPrisma.product.findUnique({ where: { id: item.productId } });
            const qtyRequest = parseInt(item.quantity, 10) || 0;

            if (!prod) {
                productErrors.push(`אין רשומת מוצר '${item.productName}'`);
                continue;
            }

            if (!prod.category) {
                productErrors.push(`למוצר '${prod.name}' אין קטגוריה מוגדרת.`);
                continue;
            }

            if (prod.quantity < qtyRequest) {
                productErrors.push(`אין במלאי '${item.productName}'. נדרש: ${qtyRequest}, זמין: ${prod.quantity}`);
            } else {
                item.imageUrl = prod.imageUrl;
                item.categoryName = prod.category;
            }

            const lineTotal = parseFloat(item.unitPrice) * qtyRequest;
            categoryTotals[prod.category] = (categoryTotals[prod.category] || 0) + lineTotal;
        }

        if (productErrors.length > 0) {
            return res.status(400).json({ error: productErrors.join(' | ') });
        }

        let categoryBalances = [...(wallet.categoryBalances || [])];
        if (categoryBalances.length > 0) {
            for (const [catName, amountNeeded] of Object.entries(categoryTotals)) {
                const catIndex = categoryBalances.findIndex((c) => c.categoryName === catName);
                if (catIndex === -1) {
                    return res.status(400).json({ error: `לארנק אין תקציב מוגדר בקטגוריה '${catName}'.` });
                }
                if (categoryBalances[catIndex].balance < amountNeeded) {
                    return res.status(400).json({
                        error: `חריגה מתקציב בקטגוריה '${catName}'. נדרש: ₪${amountNeeded}, זמין: ₪${categoryBalances[catIndex].balance}.`
                    });
                }
                categoryBalances[catIndex].balance -= amountNeeded;
            }
        }

        const transaction = await tenantPrisma.$transaction(async (tx) => {
            const debited = await tx.wallet.updateMany({
                where: { id: walletId, environmentId: req.user.environmentId,
                    updatedAt: wallet.updatedAt, currentBalance: wallet.currentBalance },
                data: {
                    currentBalance: { decrement: totalAmount },
                    categoryBalances
                }
            });
            if (debited.count !== 1) {
                const conflict = new Error('הארנק עודכן במקביל. יש לרענן את בחירת הארנק ולנסות שוב');
                conflict.status = 409;
                throw conflict;
            }

            // Read back the committed-to-this-transaction value; never substitute today's balance for old history.
            const walletAfterDebit = await tx.wallet.findUnique({
                where: { id: walletId }, select: { currentBalance: true }
            });
            if (!Number.isFinite(wallet.currentBalance) || !Number.isFinite(walletAfterDebit?.currentBalance)) {
                throw new Error('Wallet balance snapshot is unavailable; checkout was not committed');
            }

            const trans = await tx.transaction.create({
                data: {
                    transactionNumber: `TRX-${Date.now()}`,
                    officerId,
                    cashierId: req.user.id,
                    officerSelectionConfirmed: req.body.officerSelectionConfirmed === true,
                    walletId,
                    totalAmount,
                    transactionType: 'sale',
                    walletBalanceBefore: wallet.currentBalance,
                    walletBalanceAfter: walletAfterDebit.currentBalance,
                    notes,
                    items: items.map((item) => ({
                        productId: item.productId || null,
                        productName: item.productName,
                        categoryName: item.categoryName || null,
                        quantity: parseInt(item.quantity, 10),
                        unitPrice: parseFloat(item.unitPrice),
                        lineTotal: parseFloat(item.unitPrice) * parseInt(item.quantity, 10),
                        createdAt: new Date()
                    })),
                    environmentId: req.user.environmentId
                }
            });

            const updatedProducts = [];
            for (const item of items) {
                if (!item.productId) continue;
                // eslint-disable-next-line no-await-in-loop
                const updatedProduct = await tx.product.update({
                    where: { id: item.productId },
                    data: {
                        quantity: { decrement: parseInt(item.quantity, 10) }
                    }
                });
                updatedProducts.push(updatedProduct);
            }

            return { trans, updatedProducts };
        });

        getIO().emit('data_update', { type: 'transaction' });
        getIO().emit('data_update', { type: 'wallet' });
        transaction.updatedProducts.forEach((prod) => {
            getIO().emit('product_updated', prod);
        });

        const walletWithUsers = await tenantPrisma.wallet.findUnique({
            where: { id: walletId },
            include: {
                walletUsers: {
                    select: { userId: true }
                }
            }
        });

        const walletMembersUserIds = walletWithUsers?.walletUsers.map((wu) => wu.userId).filter(Boolean) || [];
        const walletMembersMap = await buildUserMapByIds(usersPrisma, walletMembersUserIds);
        const walletMembers = walletMembersUserIds
            .map((userId) => walletMembersMap.get(userId))
            .filter(Boolean)
            .map((user) => ({
                fullName: user.fullName,
                email: user.email,
                personalNumber: user.personalNumber
            }));
        const officerMap = await buildUserMapByIds(usersPrisma, [transaction.trans.officerId]);
        const officer = officerMap.get(transaction.trans.officerId);
        const transactionResponse = {
            ...transaction.trans,
            officer: officer ? {
                fullName: officer.fullName,
                personalNumber: officer.personalNumber
            } : null,
            wallet: walletWithUsers ? { name: walletWithUsers.name } : null
        };
        const currentBalance = walletWithUsers?.currentBalance || 0;
        const totalItemsCount = items.reduce((sum, item) => sum + parseInt(item.quantity, 10), 0);

        const emailPayload = {
            ...transactionResponse,
            walletMembers,
            currentBalance,
            categoryBalances: walletWithUsers?.categoryBalances || [],
            totalItemsCount,
            items: items.map((reqItem) => ({
                productId: reqItem.productId,
                productName: reqItem.productName,
                categoryName: reqItem.categoryName || null,
                quantity: parseInt(reqItem.quantity, 10),
                unitPrice: parseFloat(reqItem.unitPrice),
                lineTotal: parseFloat(reqItem.unitPrice) * parseInt(reqItem.quantity, 10),
                imageUrl: reqItem.imageUrl
            }))
        };

        try {
            sendPurchaseEmail(emailPayload);
        } catch (emailErr) {
            console.error('Failed to trigger purchase email:', emailErr);
        }

        return res.status(201).json(transactionResponse);
    } catch (error) {
        return next(error);
    }
});

// GET /api/transactions - רשימת עסקאות
router.get('/', async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const { startDate, endDate, walletId, officerId } = req.query;
        const where = { environmentId: req.user.environmentId };

        if (req.user.role === 'officer') {
            where.officerId = req.user.id;
        }
        if (startDate) where.createdAt = { gte: new Date(startDate) };
        if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
        if (walletId) where.walletId = walletId;
        if (officerId) where.officerId = officerId;

        const transactions = await tenantPrisma.transaction.findMany({
            where,
            select: {
                id: true,
                transactionNumber: true,
                officerId: true,
                cashierId: true,
                walletId: true,
                totalAmount: true,
                transactionType: true,
                status: true,
                notes: true,
                createdAt: true,
                items: true,
                environmentId: true,
                wallet: {
                    select: { name: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        const usersMap = await buildUserMapByIds(
            usersPrisma,
            transactions.flatMap((transaction) => [transaction.officerId, transaction.cashierId])
        );

        const enrichedTransactions = transactions.map((transaction) => {
            const officer = usersMap.get(transaction.officerId);
            const cashier = usersMap.get(transaction.cashierId);
            return {
                ...transaction,
                officer: officer ? {
                    fullName: officer.fullName,
                    personalNumber: officer.personalNumber,
                    role: officer.role
                } : null,
                cashier: cashier ? {
                    fullName: cashier.fullName,
                    role: cashier.role
                } : null
            };
        });

        return res.json(enrichedTransactions);
    } catch (error) {
        return next(error);
    }
});

// GET /api/transactions/:id - פרטי עסקה
router.get('/:id', async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const transaction = await tenantPrisma.transaction.findUnique({
            where: { id: req.params.id },
            select: {
                id: true,
                transactionNumber: true,
                officerId: true,
                cashierId: true,
                walletId: true,
                totalAmount: true,
                transactionType: true,
                status: true,
                notes: true,
                createdAt: true,
                items: true,
                environmentId: true,
                wallet: {
                    select: {
                        name: true,
                        currentBalance: true
                    }
                }
            }
        });

        if (!transaction || transaction.environmentId !== req.user.environmentId) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        if (req.user.role === 'officer' && transaction.officerId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const usersMap = await buildUserMapByIds(usersPrisma, [transaction.officerId, transaction.cashierId]);
        const officer = usersMap.get(transaction.officerId);
        const cashier = usersMap.get(transaction.cashierId);

        return res.json({
            ...transaction,
            officer: officer ? {
                fullName: officer.fullName,
                personalNumber: officer.personalNumber,
                role: officer.role
            } : null,
            cashier: cashier ? {
                fullName: cashier.fullName,
                role: cashier.role
            } : null
        });
    } catch (error) {
        return next(error);
    }
});

// POST /api/transactions/:id/return - החזרת עסקה
router.post('/:id/return', authorizeRoles('admin', 'cashier'), async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const originalTransaction = await tenantPrisma.transaction.findUnique({
            where: { id: req.params.id }
        });

        if (!originalTransaction || originalTransaction.environmentId !== req.user.environmentId) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        if (originalTransaction.transactionType !== 'sale') {
            return res.status(400).json({ error: 'ניתן לבצע החזרה רק עבור עסקת קנייה' });
        }

        const returnTransaction = await tenantPrisma.$transaction(async (tx) => {
            const wallet = await tx.wallet.findUnique({
                where: { id: originalTransaction.walletId }
            });
            const categoryBalances = [...(wallet.categoryBalances || [])];

            const transItems = originalTransaction.items.map((item) => {
                if (item.categoryName && categoryBalances.length > 0) {
                    const catIndex = categoryBalances.findIndex((c) => c.categoryName === item.categoryName);
                    if (catIndex > -1) {
                        categoryBalances[catIndex].balance += item.lineTotal;
                    } else {
                        categoryBalances.push({
                            categoryName: item.categoryName,
                            balance: item.lineTotal
                        });
                    }
                }
                return {
                    productId: item.productId,
                    productName: item.productName,
                    categoryName: item.categoryName || null,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    lineTotal: item.lineTotal,
                    createdAt: new Date()
                };
            });

            const walletAfterReturn = await tx.wallet.update({
                where: { id: originalTransaction.walletId },
                data: {
                    currentBalance: {
                        increment: originalTransaction.totalAmount
                    },
                    categoryBalances
                }
            });

            if (!Number.isFinite(wallet.currentBalance) || !Number.isFinite(walletAfterReturn?.currentBalance)) {
                throw new Error('Wallet balance snapshot is unavailable; return was not committed');
            }

            const trans = await tx.transaction.create({
                data: {
                    transactionNumber: `RTN-${Date.now()}`,
                    officerId: originalTransaction.officerId,
                    cashierId: req.user.id,
                    walletId: originalTransaction.walletId,
                    totalAmount: originalTransaction.totalAmount,
                    transactionType: 'return',
                    walletBalanceBefore: wallet.currentBalance,
                    walletBalanceAfter: walletAfterReturn.currentBalance,
                    notes: `Return of ${originalTransaction.transactionNumber}`,
                    items: transItems,
                    environmentId: req.user.environmentId
                }
            });

            for (const item of originalTransaction.items) {
                if (!item.productId) continue;
                // eslint-disable-next-line no-await-in-loop
                await tx.product.update({
                    where: { id: item.productId },
                    data: {
                        quantity: {
                            increment: item.quantity
                        }
                    }
                });
            }

            return trans;
        });

        getIO().emit('data_update', { type: 'transaction' });
        getIO().emit('data_update', { type: 'wallet' });
        getIO().emit('data_update', { type: 'product' });

        return res.status(201).json(returnTransaction);
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
