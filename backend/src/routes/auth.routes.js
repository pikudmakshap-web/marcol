const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database.js');
const {
    usersPrisma,
    bootstrapTenantEnvironment,
    getTenantPrismaByDbName
} = require('../config/database.js');
const { authenticateToken } = require('../middleware/auth.js');

const router = express.Router();
async function isEnvironmentUsable(environment) {
    if (!environment?.dbName) return false;

    try {
        const tenantPrisma = getTenantPrismaByDbName(environment.dbName);
        if (!tenantPrisma) return false;

        const envInTenantDb = await tenantPrisma.environment.findFirst({
            where: { id: environment.id },
            select: { id: true }
        });
        return Boolean(envInTenantDb);
    } catch (_error) {
        return false;
    }
}

async function getAvailableControlEnvironments() {
    const activeControlEnvironments = await prisma.environment.findMany({
        where: { isActive: true },
        select: { id: true, name: true, description: true, symbolImageUrls: true, dbName: true }
    });

    const checks = await Promise.all(activeControlEnvironments.map(async (environment) => ({
        environment,
        usable: await isEnvironmentUsable(environment)
    })));

    return checks.filter((item) => item.usable).map((item) => item.environment);
}

async function getAuthorizedEnvironmentsForUser(user) {
    const availableControlEnvironments = await getAvailableControlEnvironments();

    if (user.role === 'superadmin') {
        return availableControlEnvironments.map((env) => ({
            id: env.id,
            name: env.name,
            description: env.description || null,
            symbolImageUrls: env.symbolImageUrls || [],
            role: 'superadmin',
            dbName: env.dbName || null
        }));
    }

    const assignments = await usersPrisma.userEnvironment.findMany({
        where: { userId: user.id },
        select: { environmentId: true, role: true }
    });

    const roleByEnvironmentId = new Map(assignments.map((assignment) => [assignment.environmentId, assignment.role]));

    return availableControlEnvironments
        .filter((env) => roleByEnvironmentId.has(env.id))
        .map((env) => ({
            id: env.id,
            name: env.name,
            description: env.description || null,
            symbolImageUrls: env.symbolImageUrls || [],
            role: roleByEnvironmentId.get(env.id),
            dbName: env.dbName || null
        }));
}

router.post('/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const user = await usersPrisma.user.findFirst({
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
                personalNumber: true,
                environmentId: true
            }
        });

        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        const authorizedEnvironments = await getAuthorizedEnvironmentsForUser(user);

        const { passwordHash, ...userData } = user;
        userData.authorizedEnvironments = authorizedEnvironments;

        return res.json({
            token,
            user: userData
        });
    } catch (error) {
        return next(error);
    }
});

router.get('/me', authenticateToken, async (req, res, next) => {
    try {
        const user = await usersPrisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                username: true,
                fullName: true,
                role: true,
                email: true,
                personalNumber: true,
                barcode: true,
                isActive: true,
                environmentId: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const authorizedEnvironments = await getAuthorizedEnvironmentsForUser(user);
        user.authorizedEnvironments = authorizedEnvironments;

        if (user.environmentId && user.role !== 'superadmin') {
            const activeEnv = authorizedEnvironments.find((environment) => environment.id === user.environmentId);
            if (activeEnv) {
                if (user.role !== 'admin') {
                    user.role = activeEnv.role;
                }
            } else {
                await usersPrisma.user.update({
                    where: { id: user.id },
                    data: { environmentId: null }
                });
                user.environmentId = null;
            }
        }

        return res.json(user);
    } catch (error) {
        return next(error);
    }
});

router.post('/logout', authenticateToken, (_req, res) => {
    return res.json({ message: 'Logged out successfully' });
});

router.get('/dev-users', async (_req, res, next) => {
    try {
        const users = await usersPrisma.user.findMany({
            where: { isActive: true },
            select: { id: true, username: true, fullName: true, role: true }
        });
        return res.json(users);
    } catch (error) {
        return next(error);
    }
});

router.post('/dev-switch', async (req, res, next) => {
    try {
        const { userId } = req.body;
        const user = await usersPrisma.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, fullName: true, role: true, isActive: true }
        });

        if (!user || !user.isActive) {
            return res.status(404).json({ error: 'User not found or inactive' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        return res.json({ token, user });
    } catch (error) {
        return next(error);
    }
});

router.get('/environments', async (_req, res, next) => {
    try {
        const environments = await getAvailableControlEnvironments();
        return res.json(environments.map((environment) => ({
            id: environment.id,
            name: environment.name,
            description: environment.description || null,
            symbolImageUrls: environment.symbolImageUrls || []
        })));
    } catch (error) {
        return next(error);
    }
});

router.post('/switch-environment', authenticateToken, async (req, res, next) => {
    try {
        const { environmentId } = req.body;

        if (!environmentId) {
            return res.status(400).json({ error: 'Environment ID is required' });
        }

        const currentUser = await usersPrisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                username: true,
                fullName: true,
                role: true,
                email: true,
                personalNumber: true,
                barcode: true,
                isActive: true,
                environmentId: true
            }
        });

        if (!currentUser || !currentUser.isActive) {
            return res.status(404).json({ error: 'User not found or inactive' });
        }

        const authorizedEnvironments = await getAuthorizedEnvironmentsForUser(currentUser);
        const selectedEnvironment = authorizedEnvironments.find((environment) => environment.id === environmentId);

        if (!selectedEnvironment) {
            return res.status(404).json({ error: 'Environment not found or unavailable' });
        }

        const updatedUser = await usersPrisma.user.update({
            where: { id: currentUser.id },
            data: { environmentId },
            select: {
                id: true,
                username: true,
                fullName: true,
                role: true,
                email: true,
                personalNumber: true,
                barcode: true,
                isActive: true,
                environmentId: true
            }
        });

        if (updatedUser.role !== 'admin') {
            updatedUser.role = selectedEnvironment.role;
        }
        updatedUser.authorizedEnvironments = authorizedEnvironments;

        await bootstrapTenantEnvironment(environmentId);

        const token = jwt.sign(
            {
                id: updatedUser.id,
                username: updatedUser.username,
                role: updatedUser.role,
                environmentId: updatedUser.environmentId
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        return res.json({ message: 'Environment switched successfully', user: updatedUser, token });
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
