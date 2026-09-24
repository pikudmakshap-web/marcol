const express = require('express');
const { normalizeBarcode, assertAvailable, withBarcodeWrite, sendBarcodeError, availabilityHandler } = require('../services/barcodeService.js');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.js');
const { getIO } = require('../socket.js');
const { usersPrisma } = require('../config/database.js');
const { CATEGORY_COLORS } = require('../utils/colors.js');
const { cleanupUnusedCategories } = require('../utils/categoryCleanup.js');
const { requireTenantPrisma } = require('../utils/tenantContext.js');
const { buildUserMapByIds } = require('../utils/userLookup.js');

async function getNextCategoryColor(environmentId, tenantPrisma) {
    const usedColors = await tenantPrisma.category.findMany({
        where: { environmentId },
        select: { color: true }
    });
    const usedSet = new Set(usedColors.map((c) => c.color));
    const available = CATEGORY_COLORS.find((c) => !usedSet.has(c));
    return available || '#ffffff';
}

const router = express.Router();
router.use(authenticateToken);
// Advisory only; every save repeats this check under the shared database lock.
router.get('/barcode-availability', authorizeRoles('admin'), availabilityHandler);

const productListSelect = {
    id: true,
    name: true,
    description: true,
    sku: true,
    barcode: true,
    category: true,
    unitPrice: true,
    supplierName: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    quantity: true,
    initialQuantity: true,
    minStockAlert: true,
    location: true,
    expiryDate: true,
    lastRestockDate: true,
    lastRestockById: true,
    costPerUnit: true,
    environmentId: true
};

// GET /api/products - רשימת מוצרים
router.get('/', async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const { search, category, active } = req.query;
        const wantsPagination = req.query.paginated === 'true' || req.query.page !== undefined || req.query.limit !== undefined;
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.max(parseInt(req.query.limit, 10) || 100, 1);

        const where = { environmentId: req.user.environmentId };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (category) where.category = category;
        if (active !== undefined) where.isActive = active === 'true';

        if (wantsPagination) {
            const skip = (page - 1) * limit;
            const [items, total] = await Promise.all([
                tenantPrisma.product.findMany({
                    where,
                    select: productListSelect,
                    orderBy: { name: 'asc' },
                    skip,
                    take: limit
                }),
                tenantPrisma.product.count({ where })
            ]);

            return res.json({
                items,
                meta: {
                    page,
                    limit,
                    total,
                    hasMore: skip + items.length < total
                }
            });
        }

        const products = await tenantPrisma.product.findMany({
            where,
            select: productListSelect,
            orderBy: { name: 'asc' }
        });

        return res.json(products);
    } catch (error) {
        if (sendBarcodeError(error, res)) return;
        return next(error);
    }
});

// GET /api/products/:id - פרטי מוצר
router.get('/:id/image', async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const product = await tenantPrisma.product.findFirst({
            where: { id: req.params.id, environmentId: req.user.environmentId },
            select: { imageUrl: true }
        });

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        return res.json({ imageUrl: product.imageUrl || null });
    } catch (error) {
        if (sendBarcodeError(error, res)) return;
        return next(error);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const product = await tenantPrisma.product.findUnique({
            where: { id: req.params.id }
        });

        if (!product || product.environmentId !== req.user.environmentId) {
            return res.status(404).json({ error: 'Product not found' });
        }

        return res.json(product);
    } catch (error) {
        if (sendBarcodeError(error, res)) return;
        return next(error);
    }
});

// GET /api/products/barcode/:barcode - חיפוש לפי ברקוד
router.get('/barcode/:barcode', async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const product = await tenantPrisma.product.findUnique({
            where: { barcode_environmentId: { barcode: req.params.barcode, environmentId: req.user.environmentId } }
        });

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        if (!product.isActive) {
            return res.status(400).json({ error: 'Product is not active' });
        }

        return res.json(product);
    } catch (error) {
        if (sendBarcodeError(error, res)) return;
        return next(error);
    }
});

// POST /api/products - יצירת מוצר חדש
router.post('/', authorizeRoles('admin'), async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const { name, description, sku, barcode, unitPrice, supplierName, imageUrl, initialStock } = req.body;
        let { category } = req.body;
        const normalizedBarcode = normalizeBarcode(barcode);
        await assertAvailable(tenantPrisma, req.user.environmentId, normalizedBarcode, 'product');

        if (!name || !unitPrice) {
            return res.status(400).json({ error: 'Required fields: name, unitPrice' });
        }
        if (!category) {
            return res.status(400).json({ error: 'חובה לבחור קטגוריה למוצר' });
        }

        const allWallets = await tenantPrisma.wallet.findMany({
            where: { environmentId: req.user.environmentId },
            select: { categoryBalances: true }
        });
        const isCategoryMode = allWallets.length > 0 && allWallets.some((w) => Array.isArray(w.categoryBalances) && w.categoryBalances.length > 0);

        let targetCategory = await tenantPrisma.category.findUnique({
            where: { name_environmentId: { name: category, environmentId: req.user.environmentId } }
        });

        if (isCategoryMode) {
            const trimmedCategory = category.trim();
            const existsInWallets = allWallets.some((w) => (
                Array.isArray(w.categoryBalances) && w.categoryBalances.some((c) => c.categoryName && c.categoryName.trim() === trimmedCategory)
            ));

            if (!existsInWallets) {
                return res.status(400).json({
                    error: 'במצב חלוקה לקטגוריות חובה לבחור קטגוריה קיימת מתוך קטגוריות הארנקים.'
                });
            }

            if (!targetCategory) {
                const color = await getNextCategoryColor(req.user.environmentId, tenantPrisma);
                targetCategory = await tenantPrisma.category.create({
                    data: { name: trimmedCategory, color, environmentId: req.user.environmentId }
                });
            }
            category = trimmedCategory;
        } else if (!targetCategory) {
            const color = await getNextCategoryColor(req.user.environmentId, tenantPrisma);
            targetCategory = await tenantPrisma.category.create({
                data: { name: category, color, environmentId: req.user.environmentId }
            });
        }

        const product = await withBarcodeWrite(tenantPrisma, req.user.environmentId, 'product', normalizedBarcode, undefined, async (tx, code) => tx.product.create({
            data: {
                name,
                description,
                sku: sku || null,
                barcode: code,
                category,
                unitPrice: parseFloat(unitPrice),
                supplierName,
                imageUrl,
                quantity: initialStock !== undefined && initialStock !== null && initialStock !== '' ? parseInt(initialStock, 10) : 0,
                initialQuantity: initialStock !== undefined && initialStock !== null && initialStock !== '' ? parseInt(initialStock, 10) : 0,
                lastRestockDate: initialStock ? new Date() : null,
                lastRestockById: initialStock ? req.user.id : null,
                environmentId: req.user.environmentId
            }
        }));

        getIO().emit('product_added', product);
        return res.status(201).json(product);
    } catch (error) {
        if (sendBarcodeError(error, res)) return;
        if (error.code === 'P2002') {
            const target = error.meta?.target || '';
            if (target.includes('barcode')) {
                return res.status(400).json({ error: 'קיים כבר מוצר עם הברקוד הזה.' });
            }
            if (target.includes('sku')) {
                return res.status(400).json({ error: 'קיים כבר מוצר עם המק"ט הזה.' });
            }
            return res.status(400).json({ error: 'הנתונים כבר קיימים במערכת (הפרת ייחודיות).' });
        }
        return next(error);
    }
});

// PUT /api/products/:id - עדכון מוצר (Admin + Cashier)
router.put('/:id', authorizeRoles('admin', 'cashier'), async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const { name, description, sku, barcode, category, unitPrice, supplierName, imageUrl, isActive } = req.body;
        const stockToUpdate = req.body.quantity !== undefined ? req.body.quantity : undefined;
        const updateData = {};

        if (req.user.role === 'cashier') {
            if (stockToUpdate === undefined) {
                return res.status(403).json({ error: 'לקופאי מותר רק לעדכן מלאי' });
            }

            const currentProduct = await tenantPrisma.product.findUnique({ where: { id: req.params.id } });
            if (!currentProduct || currentProduct.environmentId !== req.user.environmentId) {
                return res.status(404).json({ error: 'Product not found' });
            }

            if (parseInt(stockToUpdate, 10) < currentProduct.quantity) {
                return res.status(403).json({ error: 'לקופאי אסור להוריד כמות במלאי' });
            }

            updateData.quantity = parseInt(stockToUpdate, 10);
            updateData.initialQuantity = parseInt(stockToUpdate, 10);
            updateData.lastRestockDate = new Date();
            updateData.lastRestockById = req.user.id;

            const updatedProduct = await tenantPrisma.product.update({
                where: { id: req.params.id },
                data: updateData
            });
            getIO().emit('product_updated', updatedProduct);
            return res.json(updatedProduct);
        }

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (sku !== undefined) updateData.sku = sku || null;
        if (barcode !== undefined) {
            updateData.barcode = normalizeBarcode(barcode);
            await assertAvailable(tenantPrisma, req.user.environmentId, updateData.barcode, 'product', req.params.id);
        }

        if (category !== undefined) {
            const allWallets = await tenantPrisma.wallet.findMany({
                where: { environmentId: req.user.environmentId },
                select: { categoryBalances: true }
            });
            const isCategoryMode = allWallets.length > 0 && allWallets.some((w) => Array.isArray(w.categoryBalances) && w.categoryBalances.length > 0);

            let targetCategory = await tenantPrisma.category.findUnique({
                where: { name_environmentId: { name: category, environmentId: req.user.environmentId } }
            });

            if (isCategoryMode) {
                const trimmedCategory = category.trim();
                let foundMatch = false;
                for (const w of allWallets) {
                    if (!Array.isArray(w.categoryBalances)) continue;
                    for (const c of w.categoryBalances) {
                        if (c.categoryName && c.categoryName.trim() === trimmedCategory) {
                            foundMatch = true;
                            break;
                        }
                    }
                    if (foundMatch) break;
                }

                if (!foundMatch) {
                    return res.status(400).json({
                        error: 'במצב חלוקה לקטגוריות חובה לבחור קטגוריה קיימת מתוך קטגוריות הארנקים.'
                    });
                }

                if (!targetCategory) {
                    const color = await getNextCategoryColor(req.user.environmentId, tenantPrisma);
                    targetCategory = await tenantPrisma.category.create({
                        data: { name: trimmedCategory, color, environmentId: req.user.environmentId }
                    });
                }
                updateData.category = trimmedCategory;
            } else {
                if (!targetCategory) {
                    const color = await getNextCategoryColor(req.user.environmentId, tenantPrisma);
                    targetCategory = await tenantPrisma.category.create({
                        data: { name: category, color, environmentId: req.user.environmentId }
                    });
                }
                updateData.category = category;
            }
        }

        if (unitPrice !== undefined && unitPrice !== '') updateData.unitPrice = parseFloat(unitPrice);
        if (supplierName !== undefined) updateData.supplierName = supplierName;
        if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
        if (isActive !== undefined) updateData.isActive = isActive;

        if (stockToUpdate !== undefined && stockToUpdate !== '') {
            updateData.quantity = parseInt(stockToUpdate, 10);
            updateData.initialQuantity = parseInt(stockToUpdate, 10);
            updateData.lastRestockDate = new Date();
            updateData.lastRestockById = req.user.id;
        }

        const existingProduct = await tenantPrisma.product.findFirst({
            where: { id: req.params.id, environmentId: req.user.environmentId }
        });
        if (!existingProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const updatedProduct = await withBarcodeWrite(tenantPrisma, req.user.environmentId, 'product', updateData.barcode, req.params.id, async tx => tx.product.update({
            where: { id: req.params.id },
            data: updateData
        }));

        await cleanupUnusedCategories(req.user.environmentId, tenantPrisma);

        getIO().emit('product_updated', updatedProduct);
        return res.json(updatedProduct);
    } catch (error) {
        if (sendBarcodeError(error, res)) return;
        if (error.code === 'P2002') {
            const target = error.meta?.target || '';
            if (target.includes('barcode')) {
                return res.status(400).json({ error: 'קיים כבר מוצר אחר עם הברקוד הזה.' });
            }
            if (target.includes('sku')) {
                return res.status(400).json({ error: 'קיים כבר מוצר אחר עם המק"ט הזה.' });
            }
            return res.status(400).json({ error: 'הנתונים כבר קיימים במערכת (הפרת ייחודיות).' });
        }
        return next(error);
    }
});

// DELETE /api/products/:id - מחיקת מוצר
router.delete('/:id', authorizeRoles('admin'), async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        await tenantPrisma.product.deleteMany({
            where: { id: req.params.id, environmentId: req.user.environmentId }
        });

        await cleanupUnusedCategories(req.user.environmentId, tenantPrisma);

        getIO().emit('product_deleted', req.params.id);
        return res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        if (sendBarcodeError(error, res)) return;
        return next(error);
    }
});

// GET /api/products/:id/history - היסטוריית רכישות מוצר
router.get('/:id/history', authorizeRoles('admin'), async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const transactions = await tenantPrisma.transaction.findMany({
            where: {
                environmentId: req.user.environmentId,
                items: {
                    some: { productId: req.params.id }
                }
            },
            select: {
                id: true,
                transactionNumber: true,
                transactionType: true,
                createdAt: true,
                items: true,
                cashierId: true,
                wallet: {
                    select: {
                        name: true,
                        walletNumber: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        const usersMap = await buildUserMapByIds(usersPrisma, transactions.map((tx) => tx.cashierId));

        const history = transactions.map((tx) => {
            const item = tx.items.find((i) => i.productId === req.params.id);
            return {
                transactionId: tx.id,
                transactionNumber: tx.transactionNumber,
                transactionType: tx.transactionType,
                date: tx.createdAt,
                walletName: tx.wallet ? tx.wallet.name : 'ארנק לא קיים',
                walletNumber: tx.wallet ? tx.wallet.walletNumber : '',
                cashierName: usersMap.get(tx.cashierId)?.fullName || '?? ????',
                quantity: item ? item.quantity : 0,
                unitPrice: item ? item.unitPrice : 0,
                lineTotal: item ? item.lineTotal : 0
            };
        });

        return res.json(history);
    } catch (error) {
        if (sendBarcodeError(error, res)) return;
        return next(error);
    }
});

module.exports = router;
