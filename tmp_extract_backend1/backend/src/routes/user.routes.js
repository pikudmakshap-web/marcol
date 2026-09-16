const express = require('express');
const bcrypt = require('bcrypt');
const prisma = require('../config/database.js');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.js');
const { getIO, getOnlineUsers } = require('../socket.js');

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(authorizeRoles('admin'));

// GET /api/users - רשימת משתמשים
router.get('/', async (req, res, next) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                fullName: true,
                personalNumber: true,
                barcode: true,
                role: true,
                email: true,
                isActive: true,
                lastSeen: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        const onlineUserIds = getOnlineUsers();
        const usersWithStatus = users.map(u => ({
            ...u,
            isOnline: onlineUserIds.includes(u.id)
        }));

        res.json(usersWithStatus);
    } catch (error) {
        next(error);
    }
});

// GET /api/users/:id - פרטי משתמש
router.get('/:id', async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
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

        res.json(user);
    } catch (error) {
        next(error);
    }
});

// POST /api/users - יצירת משתמש חדש
router.post('/', async (req, res, next) => {
    try {
        const { username, password, fullName, personalNumber, barcode, role, email } = req.body;

        if (!username || !password || !fullName || !role) {
            return res.status(400).json({
                error: 'Required fields: username, password, fullName, role'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                username,
                passwordHash,
                fullName,
                personalNumber,
                barcode,
                role,
                email
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

        getIO().emit('user_added', user);
        res.status(201).json(user);
    } catch (error) {
        if (error.code === 'P2002') {
            const target = error.meta?.target || 'unknown_field';
            return res.status(400).json({ error: `קיים במערכת כבר משתמש עם נתון זהה (${target})` });
        }
        next(error);
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

        // Hash password if provided
        if (password) {
            updateData.passwordHash = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
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

        getIO().emit('user_updated', user);
        res.json(user);
    } catch (error) {
        if (error.code === 'P2002') {
            const target = error.meta?.target || 'unknown_field';
            return res.status(400).json({ error: `קיים במערכת כבר משתמש עם נתון זהה (${target})` });
        }
        next(error);
    }
});

// DELETE /api/users/:id - מחיקת משתמש
router.delete('/:id', async (req, res, next) => {
    try {
        // Clean up WalletUser references first
        await prisma.walletUser.deleteMany({
            where: { userId: req.params.id }
        });

        await prisma.user.delete({
            where: { id: req.params.id }
        });

        getIO().emit('user_deleted', req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        next(error);
    }
});

// GET /api/users/:id/wallets - ארנקים של משתמש
router.get('/:id/wallets', async (req, res, next) => {
    try {
        const wallets = await prisma.walletUser.findMany({
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

        res.json(wallets.map(wu => wu.wallet));
    } catch (error) {
        next(error);
    }
});

module.exports = router;
