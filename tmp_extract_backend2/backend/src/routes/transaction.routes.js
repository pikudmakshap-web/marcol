const express = require('express');
const prisma = require('../config/database.js');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.js');
const { getIO } = require('../socket.js');
const { sendPurchaseEmail } = require('../services/emailService.js');

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

        // Check inventory stock and prepare category groupings
        const productErrors = [];
        const categoryTotals = {}; // { [categoryName]: totalAmountForCategory }

        for (const item of items) {
            if (item.productId) {
                const prod = await prisma.product.findUnique({ where: { id: item.productId } });
                const qtyRequest = parseInt(item.quantity) || 0;

                if (!prod) {
                    productErrors.push(`אין רשומת מוצר '${item.productName}'`);
                    continue;
                }
                
                if (!prod.category) {
                    productErrors.push(`למוצר '${prod.name}' אין קטגוריה מוגדרת. יש להגדיר לו קטגוריה כדי לבצע רכישה.`);
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
            } else {
                 productErrors.push(`שגיאה: פריט חסר מזהה מוצר (קטגוריה חסרה).`);
            }
        }

        if (productErrors.length > 0) {
            return res.status(400).json({ error: productErrors.join(' | ') });
        }

        // Validate Wallet category balances
        let categoryBalances = [...(wallet.categoryBalances || [])];
        if (categoryBalances.length > 0) {
            for (const [catName, amountNeeded] of Object.entries(categoryTotals)) {
                const catIndex = categoryBalances.findIndex(c => c.categoryName === catName);
                if (catIndex === -1) {
                    return res.status(400).json({ error: `לארנק זה אין תקציב מוגדר תחת הקטגוריה '${catName}'. העסקה נדחתה.` });
                }
                if (categoryBalances[catIndex].balance < amountNeeded) {
                    return res.status(400).json({ error: `חריגה מתקציב בארנק בקטגוריה '${catName}'. נדרש: ₪${amountNeeded}, זמין: ₪${categoryBalances[catIndex].balance}.` });
                }
                categoryBalances[catIndex].balance -= amountNeeded;
            }
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
                    items: items.map(item => ({
                        productId: item.productId || null,
                        productName: item.productName,
                        categoryName: item.categoryName || null,
                        quantity: parseInt(item.quantity),
                        unitPrice: parseFloat(item.unitPrice),
                        lineTotal: parseFloat(item.unitPrice) * parseInt(item.quantity),
                        createdAt: new Date()
                    }))
                },
                include: {
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
                    },
                    categoryBalances
                }
            });

            // Deduct from inventory
            const updatedProducts = [];
            for (const item of items) {
                if (item.productId) {
                    const updatedProduct = await tx.product.update({
                        where: { id: item.productId },
                        data: {
                            quantity: {
                                decrement: parseInt(item.quantity)
                            }
                        }
                    });
                    updatedProducts.push(updatedProduct);
                }
            }

            return { trans, updatedProducts };
        });

        getIO().emit('data_update', { type: 'transaction' });
        getIO().emit('data_update', { type: 'wallet' });

        // Emit explicit product updates for the UI to catch instantly
        transaction.updatedProducts.forEach(prod => {
            getIO().emit('product_updated', prod);
        });

        // Fetch all users associated with this wallet to include in the email
        const walletWithUsers = await prisma.wallet.findUnique({
            where: { id: walletId },
            include: {
                walletUsers: {
                    include: {
                        user: {
                            select: {
                                fullName: true,
                                email: true,
                                personalNumber: true
                            }
                        }
                    }
                }
            }
        });

        const walletMembers = walletWithUsers?.walletUsers.map(wu => wu.user) || [];
        const currentBalance = walletWithUsers?.currentBalance || 0;
        
        // Calculate total items quantity
        const totalItemsCount = items.reduce((sum, item) => sum + parseInt(item.quantity), 0);

        // Send purchase email
        const emailPayload = {
            ...transaction.trans,
            walletMembers,
            currentBalance,
            categoryBalances: walletWithUsers?.categoryBalances || [],
            totalItemsCount,
            items: items.map(reqItem => ({
                productId: reqItem.productId,
                productName: reqItem.productName,
                categoryName: reqItem.categoryName || null,
                quantity: parseInt(reqItem.quantity),
                unitPrice: parseFloat(reqItem.unitPrice),
                lineTotal: parseFloat(reqItem.unitPrice) * parseInt(reqItem.quantity),
                imageUrl: reqItem.imageUrl
            }))
        };

        try {
            // Calling asynchronously without blocking response
            sendPurchaseEmail(emailPayload);
        } catch (emailErr) {
            console.error('Failed to trigger purchase email:', emailErr);
        }

        res.status(201).json(transaction.trans);

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
                }
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
            where: { id: req.params.id }
        });

        if (!originalTransaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        if (originalTransaction.transactionType === 'return') {
            return res.status(400).json({ error: 'Cannot return a return transaction' });
        }

        // Create return transaction
        const returnTransaction = await prisma.$transaction(async (tx) => {
            const wallet = await tx.wallet.findUnique({
                where: { id: originalTransaction.walletId }
            });
            let categoryBalances = [...(wallet.categoryBalances || [])];

            const transItems = originalTransaction.items.map(item => {
                if (item.categoryName && categoryBalances.length > 0) {
                    const catIndex = categoryBalances.findIndex(c => c.categoryName === item.categoryName);
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

            const trans = await tx.transaction.create({
                data: {
                    transactionNumber: `RTN-${Date.now()}`,
                    officerId: originalTransaction.officerId,
                    cashierId: req.user.id,
                    walletId: originalTransaction.walletId,
                    totalAmount: originalTransaction.totalAmount,
                    transactionType: 'return',
                    notes: `Return of ${originalTransaction.transactionNumber}`,
                    items: transItems
                }
            });

            // Credit wallet
            await tx.wallet.update({
                where: { id: originalTransaction.walletId },
                data: {
                    currentBalance: {
                        increment: originalTransaction.totalAmount
                    },
                    categoryBalances
                }
            });

            // Return to inventory
            for (const item of originalTransaction.items) {
                if (item.productId) {
                    await tx.product.update({
                        where: { id: item.productId },
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

        getIO().emit('data_update', { type: 'transaction' });
        getIO().emit('data_update', { type: 'wallet' });
        getIO().emit('data_update', { type: 'product' });

        res.status(201).json(returnTransaction);

    } catch (error) {
        next(error);
    }
});

module.exports = router;
