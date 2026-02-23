import express from 'express';
import prisma from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

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

        // Search by walletNumber OR by user's personalNumber
        const wallets = await prisma.wallet.findMany({
            where: {
                OR: [
                    { walletNumber: q },
                    {
                        walletUsers: {
                            some: {
                                user: {
                                    OR: [
                                        { personalNumber: q },
                                        { barcode: q }
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

// Admin only routes below
router.use(authorizeRoles('admin'));

// GET /api/wallets - רשימת ארנקים
router.get('/', async (req, res, next) => {
    try {
        const wallets = await prisma.wallet.findMany({
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
router.get('/:id', async (req, res, next) => {
    try {
        const wallet = await prisma.wallet.findUnique({
            where: { id: req.params.id },
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

        res.json(wallet);
    } catch (error) {
        next(error);
    }
});

// POST /api/wallets - יצירת ארנק חדש
router.post('/', async (req, res, next) => {
    try {
        const { name, walletNumber, description, maxLimit, renewalDate, renewalPeriod, userIds } = req.body;

        if (!name || !walletNumber || !maxLimit) {
            return res.status(400).json({ error: 'Required fields: name, walletNumber, maxLimit' });
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
                currentBalance: parseFloat(maxLimit), // Initial balance = max limit
                maxLimit: parseFloat(maxLimit),
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

        res.status(201).json(completeWallet);
    } catch (error) {
        next(error);
    }
});

// PUT /api/wallets/:id - עדכון ארנק
router.put('/:id', async (req, res, next) => {
    try {
        const { name, walletNumber, description, maxLimit, renewalDate, renewalPeriod, isActive, userIds, currentBalance } = req.body;

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
                        notes: 'עדכון יתרה ידני'
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
                maxLimit: maxLimit !== undefined && maxLimit !== '' ? parseFloat(maxLimit) : undefined,
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

        res.json(updatedWallet);
    } catch (error) {
        next(error);
    }
});


// DELETE /api/wallets/:id - מחיקת ארנק
router.delete('/:id', async (req, res, next) => {
    try {
        await prisma.wallet.delete({
            where: { id: req.params.id }
        });

        res.json({ message: 'Wallet deleted successfully' });
    } catch (error) {
        next(error);
    }
});

// POST /api/wallets/:id/credit - זיכוי ארנק (הטענת תקציב)
router.post('/:id/credit', async (req, res, next) => {
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

        res.json(wallet);
    } catch (error) {
        next(error);
    }
});

// POST /api/wallets/:id/debit - חיוב ארנק (משיכה ידנית)
router.post('/:id/debit', async (req, res, next) => {
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

        res.json(updated);
    } catch (error) {
        next(error);
    }
});

// GET /api/wallets/:id/transactions - עסקאות של ארנק
router.get('/:id/transactions', async (req, res, next) => {
    try {
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
                },
                items: {
                    include: {
                        product: {
                            select: {
                                name: true,
                                barcode: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(transactions);
    } catch (error) {
        next(error);
    }
});

export default router;
