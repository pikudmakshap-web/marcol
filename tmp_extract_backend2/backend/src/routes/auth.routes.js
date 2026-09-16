const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database.js');
const { authenticateToken } = require('../middleware/auth.js');

const router = express.Router();

// POST /api/auth/login - התחברות
router.post('/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        console.log(username, password, "dddd");

        // Find user by username or personalNumber
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { username },
                    { personalNumber: username }
                ]
            },
            select: {
                id: true,
                username: true,
                fullName: true,
                role: true,
                passwordHash: true,
                isActive: true,
                personalNumber: true
            }
        });

        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        // Return user data (exclude password)
        const { passwordHash, ...userData } = user;

        res.json({
            token,
            user: userData
        });

    } catch (error) {
        next(error);
    }
});

// GET /api/auth/me - פרטי משתמש מחובר
router.get('/me', authenticateToken, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                username: true,
                fullName: true,
                role: true,
                email: true,
                personalNumber: true,
                barcode: true,
                isActive: true
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

// POST /api/auth/logout - התנתקות (client-side, just for logging)
router.post('/logout', authenticateToken, (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/dev-users - רשימת משתמשים לפיתוח (TEMPORARY DEV ONLY)
router.get('/dev-users', async (req, res, next) => {
    try {
        const users = await prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, username: true, fullName: true, role: true }
        });
        res.json(users);
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/dev-switch - החלפת משתמש ללא סיסמה (TEMPORARY DEV ONLY)
router.post('/dev-switch', async (req, res, next) => {
    try {
        const { userId } = req.body;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, fullName: true, role: true, isActive: true }
        });

        if (!user || !user.isActive) return res.status(404).json({ error: 'User not found or inactive' });

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        res.json({ token, user });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
