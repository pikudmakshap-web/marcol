const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.js');
const { getIO } = require('../socket.js');
const { CATEGORY_COLORS, hexToRgba } = require('../utils/colors.js');
const { requireTenantPrisma } = require('../utils/tenantContext.js');

const router = express.Router();
router.use(authenticateToken);

const DEFAULT_CATEGORY_NAME = 'ללא קטגוריה';
const normalizeColor = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

async function getUsedCategoryColorSet(environmentId, tenantPrisma) {
    const usedColors = await tenantPrisma.category.findMany({
        where: { environmentId },
        select: { color: true }
    });
    return new Set(usedColors.map((item) => normalizeColor(item.color)).filter(Boolean));
}

function getNextCategoryColor(usedSet) {
    const nextColor = CATEGORY_COLORS.find((color) => !usedSet.has(color.toLowerCase()));
    if (!nextColor) return hexToRgba('#d1d5db', 0.15);

    usedSet.add(nextColor.toLowerCase());
    return nextColor;
}

async function backfillMissingCategoryColors(categories, tenantPrisma) {
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

        const newColor = category.name === DEFAULT_CATEGORY_NAME ? hexToRgba('#f5f5f5', 0.15) : getNextCategoryColor(usedSet);
        category.color = newColor;

        updates.push(
            tenantPrisma.category.update({
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
        const tenantPrisma = requireTenantPrisma(req);
        const categories = await tenantPrisma.category.findMany({
            where: { environmentId: req.user.environmentId },
            orderBy: { name: 'asc' }
        });

        await backfillMissingCategoryColors(categories, tenantPrisma);
        res.json(categories);
    } catch (error) {
        next(error);
    }
});

router.use(authorizeRoles('admin'));

// POST /api/categories - create a new category
router.post('/', async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const rawName = req.body?.name;
        const name = typeof rawName === 'string' ? rawName.trim() : '';

        if (!name) {
            return res.status(400).json({ error: 'Category name is required' });
        }

        const existing = await tenantPrisma.category.findFirst({
            where: {
                name: {
                    equals: name,
                    mode: 'insensitive'
                },
                environmentId: req.user.environmentId
            }
        });

        if (existing) {
            return res.status(400).json({ error: 'Category already exists' });
        }

        const usedSet = await getUsedCategoryColorSet(req.user.environmentId, tenantPrisma);
        const color = name === DEFAULT_CATEGORY_NAME ? hexToRgba('#f5f5f5', 0.15) : getNextCategoryColor(usedSet);

        const category = await tenantPrisma.category.create({
            data: { name, color, environmentId: req.user.environmentId }
        });

        getIO().emit('category_update');
        res.status(201).json(category);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Category already exists (unique constraint).' });
        }
        next(error);
    }
});

// DELETE /api/categories/:id - delete a category
router.delete('/:id', async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        await tenantPrisma.category.deleteMany({
            where: { id: req.params.id, environmentId: req.user.environmentId }
        });
        getIO().emit('category_update');
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
