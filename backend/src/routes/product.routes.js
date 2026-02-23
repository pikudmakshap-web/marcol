import express from 'express';
import prisma from '../config/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

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
            include: {
                inventory: {
                    select: {
                        quantity: true,
                        minStockAlert: true
                    }
                }
            },
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
            where: { id: req.params.id },
            include: {
                inventory: true
            }
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
            where: { barcode: req.params.barcode },
            include: {
                inventory: {
                    select: {
                        quantity: true
                    }
                }
            }
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

        // 2. Create Product (Step 1 - Core Data)
        // Note: We intentionally avoid nested 'inventory: { create: ... }' to support standalone MongoDB
        const product = await prisma.product.create({
            data: {
                name,
                description,
                sku,
                barcode,
                category,
                unitPrice: parseFloat(unitPrice),
                supplierName,
                imageUrl
            }
        });

        // 3. Create Inventory (Step 2 - Optional Stock)
        if (initialStock !== undefined && initialStock !== null && initialStock !== '') {
            await prisma.inventory.create({
                data: {
                    productId: product.id,
                    quantity: parseInt(initialStock),
                    lastRestockDate: new Date(),
                    lastRestockBy: req.user.id
                }
            });
        }

        // 4. Return Complete Data
        const completeProduct = await prisma.product.findUnique({
            where: { id: product.id },
            include: { inventory: true }
        });

        res.status(201).json(completeProduct);

    } catch (error) {
        next(error);
    }
});

// PUT /api/products/:id - עדכון מוצר
router.put('/:id', async (req, res, next) => {
    try {
        const { name, description, sku, barcode, category, unitPrice, supplierName, imageUrl, isActive } = req.body;

        // Update product fields
        const product = await prisma.product.update({
            where: { id: req.params.id },
            data: {
                name,
                description,
                sku,
                barcode,
                category,
                unitPrice: unitPrice ? parseFloat(unitPrice) : undefined,
                supplierName,
                imageUrl,
                isActive
            }
        });

        // Update inventory if provided
        const stockToUpdate = req.body.quantity !== undefined ? req.body.quantity : initialStock;

        if (stockToUpdate !== undefined && stockToUpdate !== '') {
            await prisma.inventory.upsert({
                where: { productId: product.id },
                create: {
                    productId: product.id,
                    quantity: parseInt(stockToUpdate),
                    lastRestockDate: new Date(),
                    lastRestockBy: req.user.id
                },
                update: {
                    quantity: parseInt(stockToUpdate),
                    lastRestockDate: new Date(),
                    lastRestockBy: req.user.id
                }
            });
        }

        // Fetch complete result
        const updatedProduct = await prisma.product.findUnique({
            where: { id: req.params.id },
            include: { inventory: true }
        });

        res.json(updatedProduct);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/products/:id - מחיקת מוצר
router.delete('/:id', async (req, res, next) => {
    try {
        await prisma.product.delete({
            where: { id: req.params.id }
        });

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;
