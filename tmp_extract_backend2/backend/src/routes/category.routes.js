const express = require('express');
const prisma = require('../config/database.js');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.js');
const { getIO } = require('../socket.js');
const { CATEGORY_COLORS, hexToRgba } = require('../utils/colors.js');

const router = express.Router();
router.use(authenticateToken);

const normalizeColor = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

async function getUsedCategoryColorSet() {
    const usedColors = await prisma.category.findMany({ select: { color: true } });
    return new Set(usedColors.map((item) => normalizeColor(item.color)).filter(Boolean));
}

function getNextCategoryColor(usedSet) {
    const nextColor = CATEGORY_COLORS.find((color) => !usedSet.has(color.toLowerCase()));
    if (!nextColor) return hexToRgba('#d1d5db', 0.15);

    usedSet.add(nextColor.toLowerCase());
    return nextColor;
}

async function backfillMissingCategoryColors(categories) {
    const usedSet = new Set(
        categories
            .map((cat) => normalizeColor(cat.color))
            .filter((color) => color && color !== '#ffffff' && color !== '#fff')
    );

    const updates = [];

    for (const category of categories) {
        const normalizedColor = normalizeColor(category.color);
        if (normalizedColor && normalizedColor !== '#ffffff' && normalizedColor !== '#fff') {
            continue;
        }

        const newColor = category.name === 'ללא קטגוריה' ? hexToRgba('#f5f5f5', 0.15) : getNextCategoryColor(usedSet);
        category.color = newColor;

        updates.push(
            prisma.category.update({
                where: { id: category.id },
                data: { color: newColor }
            })
        );
    }

    if (updates.length > 0) {
        await Promise.all(updates);
    }
}

// GET /api/categories - get all categories
router.get('/', async (req, res, next) => {
    try {
        const categories = await prisma.category.findMany({
            orderBy: { name: 'asc' }
        });

        await backfillMissingCategoryColors(categories);
        res.json(categories);
    } catch (error) {
        next(error);
    }
});

router.use(authorizeRoles('admin'));

// POST /api/categories - create a new category
router.post('/', async (req, res, next) => {
    try {
        const rawName = req.body?.name;
        const name = typeof rawName === 'string' ? rawName.trim() : '';

        if (!name) {
            return res.status(400).json({ error: 'Category name is required' });
        }

        const existing = await prisma.category.findFirst({
            where: {
                name: {
                    equals: name,
                    mode: 'insensitive'
                }
            }
        });

        if (existing) {
            return res.status(400).json({ error: 'Category already exists' });
        }

        const usedSet = await getUsedCategoryColorSet();
        const color = name === 'ללא קטגוריה' ? hexToRgba('#f5f5f5', 0.15) : getNextCategoryColor(usedSet);

        const category = await prisma.category.create({
            data: { name, color }
        });

        getIO().emit('category_update');
        res.status(201).json(category);
    } catch (error) {
        // If there's a unique constraint violation that Prisma throws
        if (error.code === 'P2002') {
             return res.status(400).json({ error: 'Category already exists (unique constraint).' });
        }
        next(error);
    }
});

// DELETE /api/categories/:id - delete a category
router.delete('/:id', async (req, res, next) => {
    try {
        await prisma.category.delete({
            where: { id: req.params.id }
        });
        getIO().emit('category_update');
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
