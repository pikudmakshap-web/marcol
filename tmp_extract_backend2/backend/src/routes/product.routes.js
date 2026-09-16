const express = require('express');
const prisma = require('../config/database.js');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.js');
const { getIO } = require('../socket.js');
const { CATEGORY_COLORS } = require('../utils/colors.js');
const { cleanupUnusedCategories } = require('../utils/categoryCleanup.js');

// Helper to get next unused category color
async function getNextCategoryColor() {
    const usedColors = await prisma.category.findMany({ select: { color: true } });
    const usedSet = new Set(usedColors.map(c => c.color));
    const available = CATEGORY_COLORS.find(c => !usedSet.has(c));
    return available || '#ffffff';
}

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
        const { name, description, sku, barcode, unitPrice, supplierName, imageUrl, initialStock } = req.body;
        let { category } = req.body;

        console.log('Attempting to create product:', { name, sku, barcode });
        // confirm we are not in a transaction
        console.log('Is inside transaction?', !!prisma.$transaction);

        if (!name || !unitPrice) {
            return res.status(400).json({ error: 'Required fields: name, unitPrice' });
        }

        if (!category) {
            return res.status(400).json({ error: 'חובה לבחור קטגוריה למוצר' });
        }
        
        // System Mode Detection & Category Logic
        const allWallets = await prisma.wallet.findMany({ select: { categoryBalances: true } });
        const isCategoryMode = allWallets.length > 0 && allWallets.some(w => Array.isArray(w.categoryBalances) && w.categoryBalances.length > 0);

        let targetCategory = await prisma.category.findUnique({ where: { name: category } });

        if (isCategoryMode) {
            // Check if selected category actually belongs to any wallet
            const trimmedCategory = category.trim();
            const existsInWallets = allWallets.some(w => Array.isArray(w.categoryBalances) && w.categoryBalances.some(c => c.categoryName && c.categoryName.trim() === trimmedCategory));
            if (!existsInWallets) {
                return res.status(400).json({ error: 'במערכת מוגדרת חלוקה לקטגוריות. חובה לבחור קטגוריה קיימת מתוך רשימת הקטגוריות המוגדרות בארנקים.' });
            }
            // Add to global Category table if valid but missing (with a color)
            if (!targetCategory) {
                const color = await getNextCategoryColor();
                targetCategory = await prisma.category.upsert({ where: { name: trimmedCategory }, update: {}, create: { name: trimmedCategory, color } });
            }
            category = trimmedCategory;
        } else {
            // Auto-create category in General Mode (or if no wallets yet)
            if (!targetCategory) {
                const color = await getNextCategoryColor();
                targetCategory = await prisma.category.create({ data: { name: category, color } });
            }
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
        
        if (category !== undefined) {
            const allWallets = await prisma.wallet.findMany({ select: { categoryBalances: true } });
            const isCategoryMode = allWallets.length > 0 && allWallets.some(w => Array.isArray(w.categoryBalances) && w.categoryBalances.length > 0);

            let targetCategory = await prisma.category.findUnique({ where: { name: category } });

            if (isCategoryMode) {
                // Check if selected category actually belongs to any wallet
                const trimmedCategory = category.trim();
                console.log(`Checking category: "${category}" (trimmed: "${trimmedCategory}")`);
                
                let foundMatch = false;
                for (const w of allWallets) {
                    if (Array.isArray(w.categoryBalances)) {
                        for (const c of w.categoryBalances) {
                            console.log(`Comparing with wallet category: "${c.categoryName}"`);
                            if (c.categoryName && c.categoryName.trim() === trimmedCategory) {
                                foundMatch = true;
                                break;
                            }
                        }
                    }
                    if (foundMatch) break;
                }

                if (!foundMatch) {
                    console.log('Category not found in any wallet!');
                    return res.status(400).json({ error: 'במערכת מוגדרת חלוקה לקטגוריות. חובה לבחור קטגוריה קיימת מתוך רשימת הקטגוריות המוגדרות בארנקים.' });
                }
                
                // Add to global Category table if valid but missing using the EXACT original case from req.body or trimmed version if you prefer
                if (!targetCategory) {
                    const color = await getNextCategoryColor();
                    targetCategory = await prisma.category.upsert({ 
                        where: { name: trimmedCategory }, 
                        update: {}, 
                        create: { name: trimmedCategory, color } 
                    });
                }
                updateData.category = trimmedCategory;
            } else {
                // Auto-create category in General Mode
                if (!targetCategory) {
                    const color = await getNextCategoryColor();
                    targetCategory = await prisma.category.create({ data: { name: category, color } });
                }
                updateData.category = category;
            }
        }

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

        // Cleanup categories that might have become unused after this update
        await cleanupUnusedCategories();

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

        // Cleanup categories that might have become unused after this deletion
        await cleanupUnusedCategories();

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
                walletName: tx.wallet ? tx.wallet.name : 'ארנק לא קיים',
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
