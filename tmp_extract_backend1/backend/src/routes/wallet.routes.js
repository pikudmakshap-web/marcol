const express = require('express');
const prisma = require('../config/database.js');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.js');
const { getIO } = require('../socket.js');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/wallets/search - חיפוש ארנקים (נגיש לקופאי ומנהל)
router.get('/search', authorizeRoles('admin', 'cashier'), async (req, res, next) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.json([]);
        }

        // Search by walletNumber OR by user's personalNumber OR by user's name
        const wallets = await prisma.wallet.findMany({
            where: {
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { walletNumber: { contains: q, mode: 'insensitive' } },
                    {
                        walletUsers: {
                            some: {
                                user: {
                                    OR: [
                                        { fullName: { contains: q, mode: 'insensitive' } },
                                        { personalNumber: { contains: q, mode: 'insensitive' } },
                                        { barcode: { contains: q, mode: 'insensitive' } }
                                    ]
                                }
                            }
                        }
                    }
                ],
                isActive: true
            },
            include: {
                walletUsers: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                personalNumber: true
                            }
                        }
                    }
                }
            }
        });

        res.json(wallets);
    } catch (error) {
        next(error);
    }
});

// Restricted routes below
router.use(authorizeRoles('admin', 'officer', 'cashier'));

// GET /api/wallets - רשימת ארנקים
router.get('/', authorizeRoles('admin', 'officer'), async (req, res, next) => {
    try {
        const query = {};

        // If user is an officer, only fetch wallets they are assigned to
        if (req.user.role === 'officer') {
            query.where = {
                walletUsers: {
                    some: {
                        userId: req.user.id
                    }
                }
            };
        }

        const wallets = await prisma.wallet.findMany({
            ...query,
            include: {
                walletUsers: {
                    select: { userId: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(wallets);
    } catch (error) {
        next(error);
    }
});

// GET /api/wallets/:id - פרטי ארנק
router.get('/:id', authorizeRoles('admin', 'officer', 'cashier'), async (req, res, next) => {
    try {
        const walletId = req.params.id;
        const wallet = await prisma.wallet.findUnique({
            where: { id: walletId },
            include: {
                walletUsers: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                personalNumber: true,
                                role: true
                            }
                        }
                    }
                }
            }
        });

        if (!wallet) {
            return res.status(404).json({ error: 'Wallet not found' });
        }

        // Access check for officers
        if (req.user.role === 'officer') {
            const hasAccess = wallet.walletUsers.some(wu => wu.user.id === req.user.id);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied to this wallet' });
            }
        }

        res.json(wallet);
    } catch (error) {
        next(error);
    }
});

// POST /api/wallets - יצירת ארנק חדש
router.post('/', authorizeRoles('admin'), async (req, res, next) => {
    try {
        const { name, walletNumber, description, initialBalance, renewalDate, renewalPeriod, userIds } = req.body;

        if (!name || !walletNumber) {
            return res.status(400).json({ error: 'Required fields: name, walletNumber' });
        }

        const existingWallet = await prisma.wallet.findUnique({ where: { walletNumber } });
        if (existingWallet) {
            return res.status(400).json({ error: 'מספר הארנק כבר קיים במערכת' });
        }

        // 2. Create Wallet (Step 1 - Core Data)
        // Avoid nested `walletUsers: { create: ... }` to avoid transaction error on standalone Mongo
        const wallet = await prisma.wallet.create({
            data: {
                name,
                walletNumber,
                description,
                currentBalance: initialBalance !== undefined && initialBalance !== '' ? parseFloat(initialBalance) : 0,
                renewalDate: renewalDate ? new Date(renewalDate) : null,
                renewalPeriod
            }
        });

        // 3. Assign Users (Step 2 - Optional)
        if (userIds && userIds.length > 0) {
            await prisma.walletUser.createMany({
                data: userIds.map(userId => ({
                    walletId: wallet.id,
                    userId: userId
                }))
            });
        }

        // 4. Return Complete Data
        const completeWallet = await prisma.wallet.findUnique({
            where: { id: wallet.id },
            include: {
                walletUsers: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                role: true
                            }
                        }
                    }
                }
            }
        });

        getIO().emit('data_update', { type: 'wallet' });
        res.status(201).json(completeWallet);
    } catch (error) {
        next(error);
    }
});

// PUT /api/wallets/:id - עדכון ארנק
router.put('/:id', authorizeRoles('admin'), async (req, res, next) => {
    try {
        const { name, walletNumber, description, renewalDate, renewalPeriod, isActive, userIds, currentBalance, notes } = req.body;

        if (walletNumber) {
            const existingWallet = await prisma.wallet.findUnique({ where: { walletNumber } });
            if (existingWallet && existingWallet.id !== req.params.id) {
                return res.status(400).json({ error: 'מספר הארנק כבר קיים במערכת' });
            }
        }

        const currentWallet = await prisma.wallet.findUnique({ where: { id: req.params.id } });
        if (!currentWallet) {
            return res.status(404).json({ error: 'Wallet not found' });
        }

        let transactionPromise = null;
        if (currentBalance !== undefined && currentBalance !== '') {
            const newBalance = parseFloat(currentBalance);
            const diff = newBalance - currentWallet.currentBalance;
            if (diff !== 0) {
                const transactionType = diff > 0 ? 'deposit' : 'withdrawal';
                const totalAmount = Math.abs(diff);

                // Create a unique transaction string
                const prefix = transactionType === 'deposit' ? 'DEP' : 'WDL';
                const datePart = new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14);
                const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                const transactionNumber = `${prefix}-${datePart}-${randomPart}`;

                transactionPromise = prisma.transaction.create({
                    data: {
                        transactionNumber,
                        officerId: req.user.id,
                        walletId: currentWallet.id,
                        totalAmount,
                        transactionType,
                        notes: notes || 'עדכון יתרה ידני'
                    }
                });
            }
        }

        // Update wallet
        const wallet = await prisma.wallet.update({
            where: { id: req.params.id },
            data: {
                name,
                walletNumber,
                description,
                currentBalance: currentBalance !== undefined && currentBalance !== '' ? parseFloat(currentBalance) : undefined,
                renewalDate: renewalDate ? new Date(renewalDate) : null,
                renewalPeriod,
                isActive
            }
        });

        if (transactionPromise) {
            await transactionPromise;
        }

        // Update user assignments if provided
        if (userIds) {
            // Delete existing assignments
            await prisma.walletUser.deleteMany({
                where: { walletId: wallet.id }
            });

            // Create new assignments
            if (userIds.length > 0) {
                await prisma.walletUser.createMany({
                    data: userIds.map(userId => ({
                        walletId: wallet.id,
                        userId: userId
                    }))
                });
            }
        }

        // Fetch updated wallet with users
        const updatedWallet = await prisma.wallet.findUnique({
            where: { id: wallet.id },
            include: {
                walletUsers: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                role: true
                            }
                        }
                    }
                }
            }
        });

        getIO().emit('data_update', { type: 'wallet' });
        res.json(updatedWallet);
    } catch (error) {
        next(error);
    }
});


// DELETE /api/wallets/:id - מחיקת ארנק
router.delete('/:id', authorizeRoles('admin'), async (req, res, next) => {
    try {
        await prisma.walletUser.deleteMany({
            where: { walletId: req.params.id }
        });

        await prisma.wallet.delete({
            where: { id: req.params.id }
        });

        getIO().emit('data_update', { type: 'wallet' });
        res.json({ message: 'Wallet deleted successfully' });
    } catch (error) {
        next(error);
    }
});

// POST /api/wallets/:id/credit - זיכוי ארנק (הטענת תקציב)
router.post('/:id/credit', authorizeRoles('admin'), async (req, res, next) => {
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid amount required' });
        }

        const wallet = await prisma.wallet.update({
            where: { id: req.params.id },
            data: {
                currentBalance: {
                    increment: parseFloat(amount)
                }
            }
        });

        getIO().emit('data_update', { type: 'wallet' });
        res.json(wallet);
    } catch (error) {
        next(error);
    }
});

// POST /api/wallets/:id/debit - חיוב ארנק (משיכה ידנית)
router.post('/:id/debit', authorizeRoles('admin'), async (req, res, next) => {
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid amount required' });
        }

        const wallet = await prisma.wallet.findUnique({
            where: { id: req.params.id }
        });

        if (wallet.currentBalance < parseFloat(amount)) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        const updated = await prisma.wallet.update({
            where: { id: req.params.id },
            data: {
                currentBalance: {
                    decrement: parseFloat(amount)
                }
            }
        });

        getIO().emit('data_update', { type: 'wallet' });
        res.json(updated);
    } catch (error) {
        next(error);
    }
});

// GET /api/wallets/:id/transactions - עסקאות של ארנק
router.get('/:id/transactions', authorizeRoles('admin', 'officer', 'cashier'), async (req, res, next) => {
    try {
        // Access check for officers
        if (req.user.role === 'officer') {
            const hasAccess = await prisma.walletUser.findFirst({
                where: { walletId: req.params.id, userId: req.user.id }
            });
            if (!hasAccess) {
                // If the officer has no access to this specific wallet, return empty list instead of throwing an error
                return res.json([]);
            }
        }

        const transactions = await prisma.transaction.findMany({
            where: { walletId: req.params.id },
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
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(transactions);
    } catch (error) {
        console.error("HISTORY ERROR:", error);
        next(error);
    }
});

module.exports = router;
