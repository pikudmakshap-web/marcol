const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.js');
const { getIO } = require('../socket.js');
const { usersPrisma } = require('../config/database.js');
const { CATEGORY_COLORS, hexToRgba } = require('../utils/colors.js');
const { cleanupUnusedCategories } = require('../utils/categoryCleanup.js');
const { requireTenantPrisma } = require('../utils/tenantContext.js');
const { buildUserMapByIds } = require('../utils/userLookup.js');

const normalizeColor = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const normalizeCategoryName = (value) => (typeof value === 'string' ? value.trim() : '');
const DEFAULT_CATEGORY_NAME = 'ללא קטגוריה';

async function getNextCategoryColor(environmentId, tenantPrisma) {
    const usedColors = await tenantPrisma.category.findMany({ where: { environmentId }, select: { color: true } });
    const usedSet = new Set(usedColors.map((c) => normalizeColor(c.color)).filter(Boolean));
    const available = CATEGORY_COLORS.find((c) => !usedSet.has(c.toLowerCase()));
    return available || hexToRgba('#d1d5db', 0.15);
}

async function syncCategoryColorsForWallet(categoryBalances, environmentId, tenantPrisma) {
    const normalizedCategories = categoryBalances
        .map((cat) => ({
            categoryName: normalizeCategoryName(cat.categoryName),
            balance: parseFloat(cat.balance) || 0
        }))
        .filter((cat) => cat.categoryName);

    if (normalizedCategories.length === 0) return normalizedCategories;

    for (const cat of normalizedCategories) {
        // eslint-disable-next-line no-await-in-loop
        const existing = await tenantPrisma.category.findFirst({
            where: {
                name: {
                    equals: cat.categoryName,
                    mode: 'insensitive'
                },
                environmentId
            }
        });

        if (!existing) {
            const color = await getNextCategoryColor(environmentId, tenantPrisma);
            // eslint-disable-next-line no-await-in-loop
            await tenantPrisma.category.create({ data: { name: cat.categoryName, color, environmentId } });
            continue;
        }

        const existingColor = normalizeColor(existing.color);
        if (!existingColor || existingColor === '#fff' || existingColor === '#ffffff') {
            const color = existing.name === DEFAULT_CATEGORY_NAME
                ? hexToRgba('#f5f5f5', 0.15)
                : await getNextCategoryColor(environmentId, tenantPrisma);

            // eslint-disable-next-line no-await-in-loop
            await tenantPrisma.category.update({
                where: { id: existing.id },
                data: { color }
            });
        }
    }

    return normalizedCategories;
}

const router = express.Router();
router.use(authenticateToken);

// GET /api/wallets/search - חיפוש ארנקים
router.get('/search', authorizeRoles('admin', 'cashier'), async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const { q } = req.query;
        if (!q) return res.json([]);
        const searchTerm = String(q).trim();

        const matchingAssignments = await usersPrisma.userEnvironment.findMany({
            where: {
                environmentId: req.user.environmentId,
                user: {
                    OR: [
                        { fullName: { contains: searchTerm, mode: 'insensitive' } },
                        { personalNumber: { contains: searchTerm, mode: 'insensitive' } },
                        { barcode: { contains: searchTerm, mode: 'insensitive' } }
                    ]
                }
            },
            select: { userId: true }
        });
        const matchingUserIds = [...new Set(matchingAssignments.map((assignment) => assignment.userId))];

        const walletFilters = [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { walletNumber: { contains: searchTerm, mode: 'insensitive' } }
        ];
        if (matchingUserIds.length > 0) {
            walletFilters.push({
                walletUsers: {
                    some: { userId: { in: matchingUserIds } }
                }
            });
        }

        const wallets = await tenantPrisma.wallet.findMany({
            where: {
                OR: walletFilters,
                isActive: true,
                environmentId: req.user.environmentId
            },
            include: {
                walletUsers: {
                    select: { userId: true }
                }
            }
        });

        const usersMap = await buildUserMapByIds(
            usersPrisma,
            wallets.flatMap((wallet) => wallet.walletUsers.map((walletUser) => walletUser.userId))
        );
        const result = wallets.map((wallet) => ({
            ...wallet,
            walletUsers: wallet.walletUsers.map((walletUser) => ({
                userId: walletUser.userId,
                user: usersMap.get(walletUser.userId)
                    ? {
                        id: walletUser.userId,
                        fullName: usersMap.get(walletUser.userId).fullName,
                        personalNumber: usersMap.get(walletUser.userId).personalNumber
                    }
                    : null
            }))
        }));

        return res.json(result);
    } catch (error) {
        return next(error);
    }
});

router.use(authorizeRoles('admin', 'officer', 'cashier'));

// GET /api/wallets - רשימת ארנקים
router.get('/', authorizeRoles('admin', 'officer'), async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const query = { where: { environmentId: req.user.environmentId } };

        if (req.user.role === 'officer') {
            query.where = {
                environmentId: req.user.environmentId,
                walletUsers: {
                    some: {
                        userId: req.user.id
                    }
                }
            };
        }

        const wallets = await tenantPrisma.wallet.findMany({
            ...query,
            include: {
                walletUsers: {
                    select: { userId: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return res.json(wallets);
    } catch (error) {
        return next(error);
    }
});

// GET /api/wallets/:id - פרטי ארנק
router.get('/:id', authorizeRoles('admin', 'officer', 'cashier'), async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const walletId = req.params.id;
        const wallet = await tenantPrisma.wallet.findUnique({
            where: { id: walletId },
            include: {
                walletUsers: {
                    select: { userId: true }
                }
            }
        });

        if (!wallet || wallet.environmentId !== req.user.environmentId) {
            return res.status(404).json({ error: 'Wallet not found' });
        }

        if (req.user.role === 'officer') {
            const hasAccess = wallet.walletUsers.some((wu) => wu.userId === req.user.id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied to this wallet' });
            }
        }

        const walletUsersMap = await buildUserMapByIds(
            usersPrisma,
            wallet.walletUsers.map((walletUser) => walletUser.userId)
        );

        return res.json({
            ...wallet,
            walletUsers: wallet.walletUsers.map((walletUser) => ({
                userId: walletUser.userId,
                user: walletUsersMap.get(walletUser.userId)
                    ? {
                        id: walletUser.userId,
                        fullName: walletUsersMap.get(walletUser.userId).fullName,
                        personalNumber: walletUsersMap.get(walletUser.userId).personalNumber,
                        role: walletUsersMap.get(walletUser.userId).role
                    }
                    : null
            }))
        });
    } catch (error) {
        return next(error);
    }
});

// POST /api/wallets - יצירת ארנק חדש
router.post('/', authorizeRoles('admin'), async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const { name, walletNumber, description, categories, generalBalance, renewalDate, renewalPeriod, userIds } = req.body;

        if (!name || !walletNumber) {
            return res.status(400).json({ error: 'Required fields: name, walletNumber' });
        }

        const existingWallet = await tenantPrisma.wallet.findUnique({
            where: { walletNumber_environmentId: { walletNumber, environmentId: req.user.environmentId } }
        });
        if (existingWallet) {
            return res.status(400).json({ error: 'מספר הארנק כבר קיים במערכת' });
        }

        let currentBalance = 0;
        let categoryBalances = [];

        if (categories && categories.length > 0) {
            categoryBalances = await syncCategoryColorsForWallet(categories, req.user.environmentId, tenantPrisma);
            currentBalance = categoryBalances.reduce((sum, cat) => sum + cat.balance, 0);
        } else if (generalBalance !== undefined && generalBalance !== '') {
            currentBalance = parseFloat(generalBalance) || 0;
        }

        const wallet = await tenantPrisma.wallet.create({
            data: {
                name,
                walletNumber,
                description,
                currentBalance,
                categoryBalances,
                renewalDate: renewalDate ? new Date(renewalDate) : null,
                renewalPeriod,
                environmentId: req.user.environmentId
            }
        });

        if (userIds && userIds.length > 0) {
            await tenantPrisma.walletUser.createMany({
                data: userIds.map((userId) => ({
                    walletId: wallet.id,
                    userId
                }))
            });
        }

        const completeWallet = await tenantPrisma.wallet.findUnique({
            where: { id: wallet.id },
            include: {
                walletUsers: {
                    select: { userId: true }
                }
            }
        });
        const completeWalletUsersMap = await buildUserMapByIds(
            usersPrisma,
            completeWallet.walletUsers.map((walletUser) => walletUser.userId)
        );

        getIO().emit('data_update', { type: 'wallet' });
        return res.status(201).json({
            ...completeWallet,
            walletUsers: completeWallet.walletUsers.map((walletUser) => ({
                userId: walletUser.userId,
                user: completeWalletUsersMap.get(walletUser.userId)
                    ? {
                        id: walletUser.userId,
                        fullName: completeWalletUsersMap.get(walletUser.userId).fullName,
                        role: completeWalletUsersMap.get(walletUser.userId).role
                    }
                    : null
            }))
        });
    } catch (error) {
        return next(error);
    }
});

// PUT /api/wallets/:id - עדכון ארנק
router.put('/:id', authorizeRoles('admin'), async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const { name, walletNumber, description, renewalDate, renewalPeriod, isActive, userIds, categories, generalBalance, notes } = req.body;

        if (walletNumber) {
            const existingWallet = await tenantPrisma.wallet.findUnique({
                where: { walletNumber_environmentId: { walletNumber, environmentId: req.user.environmentId } }
            });
            if (existingWallet && existingWallet.id !== req.params.id) {
                return res.status(400).json({ error: 'מספר הארנק כבר קיים במערכת' });
            }
        }

        const currentWallet = await tenantPrisma.wallet.findUnique({ where: { id: req.params.id } });
        if (!currentWallet || currentWallet.environmentId !== req.user.environmentId) {
            return res.status(404).json({ error: 'Wallet not found' });
        }

        let transactionPromise = null;
        const updateData = {
            name,
            walletNumber,
            description,
            renewalDate: renewalDate ? new Date(renewalDate) : null,
            renewalPeriod,
            isActive
        };

        let newBalance = currentWallet.currentBalance;
        let diff = 0;
        let balanceUpdated = false;

        if (Array.isArray(categories)) {
            const categoryBalances = await syncCategoryColorsForWallet(categories, req.user.environmentId, tenantPrisma);

            if (categoryBalances.length > 0) {
                newBalance = categoryBalances.reduce((sum, cat) => sum + cat.balance, 0);
                updateData.categoryBalances = categoryBalances;
                updateData.currentBalance = newBalance;
            } else {
                newBalance = (generalBalance !== undefined && generalBalance !== '') ? parseFloat(generalBalance) : 0;
                updateData.categoryBalances = [];
                updateData.currentBalance = newBalance;
            }
            balanceUpdated = true;
        } else if (generalBalance !== undefined && generalBalance !== '') {
            newBalance = parseFloat(generalBalance) || 0;
            updateData.categoryBalances = [];
            updateData.currentBalance = newBalance;
            balanceUpdated = true;
        }

        if (balanceUpdated) {
            diff = newBalance - currentWallet.currentBalance;
            if (diff !== 0) {
                const transactionType = diff > 0 ? 'deposit' : 'withdrawal';
                const totalAmount = Math.abs(diff);

                const prefix = transactionType === 'deposit' ? 'DEP' : 'WDL';
                const datePart = new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14);
                const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                const transactionNumber = `${prefix}-${datePart}-${randomPart}`;

                transactionPromise = tenantPrisma.transaction.create({
                    data: {
                        transactionNumber,
                        officerId: req.user.id,
                        walletId: currentWallet.id,
                        totalAmount,
                        transactionType,
                        notes: notes || 'עדכון יתרה ידני',
                        environmentId: req.user.environmentId
                    }
                });
            }
        }

        await tenantPrisma.wallet.updateMany({
            where: { id: req.params.id, environmentId: req.user.environmentId },
            data: updateData
        });

        await cleanupUnusedCategories(req.user.environmentId, tenantPrisma);

        if (transactionPromise) {
            await transactionPromise;
        }

        if (userIds) {
            await tenantPrisma.walletUser.deleteMany({ where: { walletId: req.params.id } });
            if (userIds.length > 0) {
                await tenantPrisma.walletUser.createMany({
                    data: userIds.map((userId) => ({
                        walletId: req.params.id,
                        userId
                    }))
                });
            }
        }

        const updatedWallet = await tenantPrisma.wallet.findUnique({
            where: { id: req.params.id },
            include: {
                walletUsers: {
                    select: { userId: true }
                }
            }
        });
        const updatedWalletUsersMap = await buildUserMapByIds(
            usersPrisma,
            updatedWallet.walletUsers.map((walletUser) => walletUser.userId)
        );

        getIO().emit('data_update', { type: 'wallet' });
        return res.json({
            ...updatedWallet,
            walletUsers: updatedWallet.walletUsers.map((walletUser) => ({
                userId: walletUser.userId,
                user: updatedWalletUsersMap.get(walletUser.userId)
                    ? {
                        id: walletUser.userId,
                        fullName: updatedWalletUsersMap.get(walletUser.userId).fullName,
                        role: updatedWalletUsersMap.get(walletUser.userId).role
                    }
                    : null
            }))
        });
    } catch (error) {
        return next(error);
    }
});

// DELETE /api/wallets/:id - מחיקת ארנק
router.delete('/:id', authorizeRoles('admin'), async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);

        await tenantPrisma.walletUser.deleteMany({ where: { walletId: req.params.id } });
        await tenantPrisma.wallet.deleteMany({ where: { id: req.params.id, environmentId: req.user.environmentId } });

        await cleanupUnusedCategories(req.user.environmentId, tenantPrisma);

        const remainingWallets = await tenantPrisma.wallet.count({ where: { environmentId: req.user.environmentId } });
        if (remainingWallets === 0) {
            await tenantPrisma.category.deleteMany({ where: { environmentId: req.user.environmentId } });

            await tenantPrisma.category.upsert({
                where: {
                    name_environmentId: {
                        name: DEFAULT_CATEGORY_NAME,
                        environmentId: req.user.environmentId
                    }
                },
                update: {},
                create: {
                    name: DEFAULT_CATEGORY_NAME,
                    color: hexToRgba('#f5f5f5', 0.15),
                    environmentId: req.user.environmentId
                }
            });

            await tenantPrisma.product.updateMany({
                where: { environmentId: req.user.environmentId },
                data: { category: DEFAULT_CATEGORY_NAME }
            });

            getIO().emit('data_update', { type: 'category' });
            getIO().emit('data_update', { type: 'product' });
        }

        getIO().emit('data_update', { type: 'wallet' });
        return res.json({ message: 'Wallet deleted successfully' });
    } catch (error) {
        return next(error);
    }
});

// POST /api/wallets/:id/credit - זיכוי ארנק
router.post('/:id/credit', authorizeRoles('admin'), async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const { amount, categoryName } = req.body;

        if (!amount || amount <= 0 || !categoryName) {
            return res.status(400).json({ error: 'Valid amount and category required' });
        }

        const currentWallet = await tenantPrisma.wallet.findUnique({ where: { id: req.params.id } });
        if (!currentWallet || currentWallet.environmentId !== req.user.environmentId) {
            return res.status(404).json({ error: 'Wallet not found' });
        }

        const categoryBalances = [...(currentWallet.categoryBalances || [])];
        const catIndex = categoryBalances.findIndex((c) => c.categoryName === categoryName);
        if (catIndex > -1) {
            categoryBalances[catIndex].balance += parseFloat(amount);
        } else {
            return res.status(400).json({ error: 'הקטגוריה אינה מוגדרת בארנק. יש לערוך את הארנק.' });
        }

        const wallet = await tenantPrisma.wallet.updateMany({
            where: { id: req.params.id, environmentId: req.user.environmentId },
            data: {
                currentBalance: {
                    increment: parseFloat(amount)
                },
                categoryBalances
            }
        });

        getIO().emit('data_update', { type: 'wallet' });
        return res.json(wallet);
    } catch (error) {
        return next(error);
    }
});

// POST /api/wallets/:id/debit - חיוב ארנק
router.post('/:id/debit', authorizeRoles('admin'), async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const { amount, categoryName } = req.body;

        if (!amount || amount <= 0 || !categoryName) {
            return res.status(400).json({ error: 'Valid amount and category required' });
        }

        const wallet = await tenantPrisma.wallet.findUnique({ where: { id: req.params.id } });

        if (!wallet || wallet.environmentId !== req.user.environmentId) {
            return res.status(404).json({ error: 'Wallet not found' });
        }

        const categoryBalances = [...(wallet.categoryBalances || [])];
        const catIndex = categoryBalances.findIndex((c) => c.categoryName === categoryName);
        if (catIndex > -1) {
            if (categoryBalances[catIndex].balance < parseFloat(amount)) {
                return res.status(400).json({ error: 'Insufficient balance in this category' });
            }
            categoryBalances[catIndex].balance -= parseFloat(amount);
        } else {
            return res.status(400).json({ error: 'הקטגוריה אינה מוגדרת בארנק. יש לערוך את הארנק.' });
        }

        if (wallet.currentBalance < parseFloat(amount)) {
            return res.status(400).json({ error: 'Insufficient balance overall' });
        }

        const updated = await tenantPrisma.wallet.updateMany({
            where: { id: req.params.id, environmentId: req.user.environmentId },
            data: {
                currentBalance: {
                    decrement: parseFloat(amount)
                },
                categoryBalances
            }
        });

        getIO().emit('data_update', { type: 'wallet' });
        return res.json(updated);
    } catch (error) {
        return next(error);
    }
});

// GET /api/wallets/:id/transactions - עסקאות של ארנק
router.get('/:id/transactions', authorizeRoles('admin', 'officer', 'cashier'), async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);

        if (req.user.role === 'officer') {
            const hasAccess = await tenantPrisma.walletUser.findFirst({
                where: { walletId: req.params.id, userId: req.user.id }
            });
            if (!hasAccess) {
                return res.json([]);
            }
        }

        const transactions = await tenantPrisma.transaction.findMany({
            where: { walletId: req.params.id, environmentId: req.user.environmentId },
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
                environmentId: true
            },
            orderBy: { createdAt: 'desc' }
        });
        const transactionUsersMap = await buildUserMapByIds(
            usersPrisma,
            transactions.flatMap((transaction) => [transaction.officerId, transaction.cashierId])
        );
        const result = transactions.map((transaction) => {
            const officer = transactionUsersMap.get(transaction.officerId);
            const cashier = transactionUsersMap.get(transaction.cashierId);
            return {
                ...transaction,
                officer: officer ? {
                    fullName: officer.fullName,
                    personalNumber: officer.personalNumber
                } : null,
                cashier: cashier ? {
                    fullName: cashier.fullName
                } : null
            };
        });

        return res.json(result);
    } catch (error) {
        console.error('HISTORY ERROR:', error);
        return next(error);
    }
});

module.exports = router;
