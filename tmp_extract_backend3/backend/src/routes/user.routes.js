const express = require('express');
const bcrypt = require('bcrypt');
const { usersPrisma } = require('../config/database.js');
const { getTenantPrismaByEnvironmentId } = require('../config/database.js');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.js');
const { getIO, getOnlineUsers } = require('../socket.js');

const router = express.Router();
router.use(authenticateToken);
router.use(authorizeRoles('admin'));

// GET /api/users - רשימת משתמשים של הסביבה
router.get('/', async (req, res, next) => {
    try {
        const userEnvs = await usersPrisma.userEnvironment.findMany({
            where: {
                environmentId: req.user.environmentId,
                user: { role: { not: 'superadmin' } }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        fullName: true,
                        personalNumber: true,
                        barcode: true,
                        email: true,
                        isActive: true,
                        lastSeen: true,
                        createdAt: true
                    }
                }
            },
            orderBy: { user: { createdAt: 'desc' } }
        });

        const users = userEnvs.map((ue) => ({
            ...ue.user,
            role: ue.role
        }));

        const onlineUserIds = getOnlineUsers();
        const usersWithStatus = users.map((u) => ({
            ...u,
            isOnline: onlineUserIds.includes(u.id)
        }));

        return res.json(usersWithStatus);
    } catch (error) {
        return next(error);
    }
});

// GET /api/users/:id - פרטי משתמש
router.get('/:id', async (req, res, next) => {
    try {
        const assignment = await usersPrisma.userEnvironment.findUnique({
            where: {
                userId_environmentId: {
                    userId: req.params.id,
                    environmentId: req.user.environmentId
                }
            }
        });
        if (!assignment) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = await usersPrisma.user.findUnique({
            where: { id: req.params.id },
            select: {
                id: true,
                username: true,
                fullName: true,
                personalNumber: true,
                barcode: true,
                role: true,
                email: true,
                isActive: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.role = assignment.role;
        return res.json(user);
    } catch (error) {
        return next(error);
    }
});

// POST /api/users - יצירת משתמש חדש
router.post('/', async (req, res, next) => {
    try {
        const { username, password, fullName, personalNumber, barcode, role, email } = req.body;

        if (!username || !password || !fullName || !role) {
            return res.status(400).json({ error: 'Required fields: username, password, fullName, role' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await usersPrisma.user.create({
            data: {
                username,
                passwordHash,
                fullName,
                personalNumber,
                barcode,
                role,
                email,
                environmentId: req.user.environmentId
            },
            select: {
                id: true,
                username: true,
                fullName: true,
                personalNumber: true,
                barcode: true,
                role: true,
                email: true,
                isActive: true,
                createdAt: true
            }
        });

        await usersPrisma.userEnvironment.create({
            data: {
                userId: user.id,
                environmentId: req.user.environmentId,
                role
            }
        });

        user.role = role;
        getIO().emit('user_added', user);
        return res.status(201).json(user);
    } catch (error) {
        if (error.code === 'P2002') {
            const target = error.meta?.target || 'unknown_field';
            return res.status(400).json({ error: `קיים במערכת כבר משתמש עם נתון זהה (${target})` });
        }
        return next(error);
    }
});

// PUT /api/users/:id - עדכון משתמש
router.put('/:id', async (req, res, next) => {
    try {
        const { username, password, fullName, personalNumber, barcode, role, email, isActive } = req.body;

        const updateData = {
            username,
            fullName,
            personalNumber,
            barcode,
            role,
            email,
            isActive
        };

        if (password) {
            updateData.passwordHash = await bcrypt.hash(password, 10);
        }

        const user = await usersPrisma.user.update({
            where: { id: req.params.id },
            data: updateData,
            select: {
                id: true,
                username: true,
                fullName: true,
                personalNumber: true,
                barcode: true,
                role: true,
                email: true,
                isActive: true,
                updatedAt: true
            }
        });

        if (role) {
            await usersPrisma.userEnvironment.update({
                where: {
                    userId_environmentId: {
                        userId: req.params.id,
                        environmentId: req.user.environmentId
                    }
                },
                data: { role }
            });
            user.role = role;
        }

        getIO().emit('user_updated', user);
        return res.json(user);
    } catch (error) {
        if (error.code === 'P2002') {
            const target = error.meta?.target || 'unknown_field';
            return res.status(400).json({ error: `קיים במערכת כבר משתמש עם נתון זהה (${target})` });
        }
        return next(error);
    }
});

// DELETE /api/users/:id - מחיקת משתמש
router.delete('/:id', async (req, res, next) => {
    try {
        const assignments = await usersPrisma.userEnvironment.findMany({
            where: { userId: req.params.id },
            select: { environmentId: true }
        });

        for (const assignment of assignments) {
            // eslint-disable-next-line no-await-in-loop
            const tenantPrisma = await getTenantPrismaByEnvironmentId(assignment.environmentId);
            if (!tenantPrisma) continue;
            // eslint-disable-next-line no-await-in-loop
            await tenantPrisma.walletUser.deleteMany({
                where: { userId: req.params.id }
            });
        }

        await usersPrisma.userEnvironment.deleteMany({
            where: { userId: req.params.id }
        });

        await usersPrisma.user.delete({
            where: { id: req.params.id }
        });

        getIO().emit('user_deleted', req.params.id);
        return res.json({ message: 'User deleted successfully' });
    } catch (error) {
        return next(error);
    }
});

// GET /api/users/:id/wallets - ארנקים של משתמש בסביבה הנוכחית
router.get('/:id/wallets', async (req, res, next) => {
    try {
        const tenantPrisma = requireTenantPrisma(req);
        const wallets = await tenantPrisma.walletUser.findMany({
            where: { userId: req.params.id },
            include: {
                wallet: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        currentBalance: true,
                        isActive: true
                    }
                }
            }
        });

        return res.json(wallets.map((wu) => wu.wallet).filter(Boolean));
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
