const express = require('express');
const prisma = require('../config/database.js');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.js');
const { getIO } = require('../socket.js');

const router = express.Router();
router.use(authenticateToken);

// GET /api/products - רשימת מוצרים
router.get('/', async (req, res, next) => {
    try {
        const { search, category, active } = req.query;

        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (category) {
            where.category = category;
        }
        if (active !== undefined) {
            where.isActive = active === 'true';
        }

        const products = await prisma.product.findMany({
            where,
            orderBy: { name: 'asc' }
        });

        res.json(products);
    } catch (error) {
        next(error);
    }
});

// GET /api/products/:id - פרטי מוצר
router.get('/:id', async (req, res, next) => {
    try {
        const product = await prisma.product.findUnique({
            where: { id: req.params.id }
        });

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        next(error);
    }
});

// GET /api/products/barcode/:barcode - חיפוש לפי ברקוד
router.get('/barcode/:barcode', async (req, res, next) => {
    try {
        const product = await prisma.product.findUnique({
            where: { barcode: req.params.barcode }
        });

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        if (!product.isActive) {
            return res.status(400).json({ error: 'Product is not active' });
        }

        res.json(product);
    } catch (error) {
        next(error);
    }
});

// Admin-only routes
router.use(authorizeRoles('admin'));

// POST /api/products - יצירת מוצר חדש
router.post('/', async (req, res, next) => {
    try {
        // 1. Validate Input
        const { name, description, sku, barcode, category, unitPrice, supplierName, imageUrl, initialStock } = req.body;

        console.log('Attempting to create product:', { name, sku, barcode });
        // confirm we are not in a transaction
        console.log('Is inside transaction?', !!prisma.$transaction);

        if (!name || !unitPrice) {
            return res.status(400).json({ error: 'Required fields: name, unitPrice' });
        }

        // 2 & 3. Create Product with initial stock
        const product = await prisma.product.create({
            data: {
                name,
                description,
                sku: sku || null,
                barcode: barcode || null,
                category,
                unitPrice: parseFloat(unitPrice),
                supplierName,
                imageUrl,
                quantity: initialStock !== undefined && initialStock !== null && initialStock !== '' ? parseInt(initialStock) : 0,
                initialQuantity: initialStock !== undefined && initialStock !== null && initialStock !== '' ? parseInt(initialStock) : 0,
                lastRestockDate: initialStock ? new Date() : null,
                lastRestockById: initialStock ? req.user.id : null
            }
        });

        getIO().emit('product_added', product);
        res.status(201).json(product);

    } catch (error) {
        if (error.code === 'P2002') {
            const target = error.meta?.target || '';
            if (target.includes('barcode')) {
                return res.status(400).json({ error: 'קיים כבר מוצר עם הברקוד הזה.' });
            }
            if (target.includes('sku')) {
                return res.status(400).json({ error: 'קיים כבר מוצר עם המק"ט הזה.' });
            }
            return res.status(400).json({ error: 'הנתונים קיימים כבר במערכת (הפרת ייחודיות).' });
        }
        next(error);
    }
});

// PUT /api/products/:id - עדכון מוצר
router.put('/:id', async (req, res, next) => {
    try {
        const { name, description, sku, barcode, category, unitPrice, supplierName, imageUrl, isActive } = req.body;

        const stockToUpdate = req.body.quantity !== undefined ? req.body.quantity : undefined;
        let updateData = {};

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (sku !== undefined) updateData.sku = sku || null;
        if (barcode !== undefined) updateData.barcode = barcode || null;
        if (category !== undefined) updateData.category = category;
        if (unitPrice !== undefined && unitPrice !== '') updateData.unitPrice = parseFloat(unitPrice);
        if (supplierName !== undefined) updateData.supplierName = supplierName;
        if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
        if (isActive !== undefined) updateData.isActive = isActive;

        if (stockToUpdate !== undefined && stockToUpdate !== '') {
            updateData.quantity = parseInt(stockToUpdate);
            updateData.initialQuantity = parseInt(stockToUpdate);
            updateData.lastRestockDate = new Date();
            updateData.lastRestockById = req.user.id;
        }

        // Update product fields
        const updatedProduct = await prisma.product.update({
            where: { id: req.params.id },
            data: updateData
        });

        getIO().emit('product_updated', updatedProduct);
        res.json(updatedProduct);
    } catch (error) {
        if (error.code === 'P2002') {
            const target = error.meta?.target || '';
            if (target.includes('barcode')) {
                return res.status(400).json({ error: 'קיים כבר מוצר אחר עם הברקוד הזה.' });
            }
            if (target.includes('sku')) {
                return res.status(400).json({ error: 'קיים כבר מוצר אחר עם המק"ט הזה.' });
            }
            return res.status(400).json({ error: 'הנתונים קיימים כבר במערכת (הפרת ייחודיות).' });
        }
        next(error);
    }
});

// DELETE /api/products/:id - מחיקת מוצר
router.delete('/:id', async (req, res, next) => {
    try {
        await prisma.product.delete({
            where: { id: req.params.id }
        });

        getIO().emit('product_deleted', req.params.id);
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        next(error);
    }
});

// GET /api/products/:id/history - מחזיר היסטוריית רכישות של מוצר
router.get('/:id/history', async (req, res, next) => {
    try {
        const transactions = await prisma.transaction.findMany({
            where: {
                items: {
                    some: {
                        productId: req.params.id
                    }
                }
            },
            include: {
                wallet: {
                    select: {
                        name: true,
                        walletNumber: true
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

        // Extract the specific item details for the product
        const history = transactions.map(tx => {
            const item = tx.items.find(i => i.productId === req.params.id);
            return {
                transactionId: tx.id,
                transactionNumber: tx.transactionNumber,
                transactionType: tx.transactionType,
                date: tx.createdAt,
                walletName: tx.wallet ? tx.wallet.name : 'ללא ארנק',
                walletNumber: tx.wallet ? tx.wallet.walletNumber : '',
                cashierName: tx.cashier ? tx.cashier.fullName : 'לא ידוע',
                quantity: item ? item.quantity : 0,
                unitPrice: item ? item.unitPrice : 0,
                lineTotal: item ? item.lineTotal : 0
            };
        });

        res.json(history);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
