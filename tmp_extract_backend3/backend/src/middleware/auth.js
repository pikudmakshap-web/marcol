const prisma = require('../config/database.js');
const { usersPrisma } = require('../config/database.js');
const {
    getTenantPrismaByEnvironmentId,
    ensureEnvironmentDbName,
    bootstrapTenantEnvironment
} = require('../config/database.js');
const logger = require('../utils/logger.js');

const authenticateToken = async (req, res, next) => {
    // 1. Get User ID from header (sent by frontend)
    const userId = req.headers['x-user-id'];

    if (!userId) {
        logger.warn('Auth Error: No x-user-id header provided');
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        // 2. Fetch user from Database
        const user = await usersPrisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            logger.warn(`Auth Error: User not found for ID ${userId}`);
            return res.status(401).json({ error: 'User not found' });
        }
        if (!user.isActive) {
            logger.warn(`Auth Error: User ${user.username} is inactive`);
            return res.status(403).json({ error: 'User account is inactive' });
        }

        // For non-superadmin users, ensure they have an assigned environment and fetch their role
        if (user.role !== 'superadmin') {
            if (!user.environmentId) {
                logger.warn(`Auth Error: User ${user.username} is not assigned to an environment`);
                return res.status(403).json({ error: 'User is not assigned to an environment' });
            }

            // Fetch the role for the specific environment
            const userEnv = await usersPrisma.userEnvironment.findUnique({
                where: {
                    userId_environmentId: {
                        userId: user.id,
                        environmentId: user.environmentId
                    }
                },
                select: {
                    role: true
                }
            });

            if (!userEnv) {
                logger.warn(`Auth Error: User ${user.username} has no role in environment ${user.environmentId}`);
                return res.status(403).json({ error: 'Access denied for this environment' });
            }

            // Keep global admins at admin level even if a specific assignment is lower.
            // Other roles remain environment-contextual.
            if (user.role !== 'admin') {
                user.role = userEnv.role;
            }
        }

        // 3. Attach user to request object
        req.user = user;
        req.controlPrisma = prisma;
        req.usersPrisma = usersPrisma;

        if (user.environmentId) {
            await bootstrapTenantEnvironment(user.environmentId);
            req.environmentDbName = await ensureEnvironmentDbName(user.environmentId);
            req.envPrisma = await getTenantPrismaByEnvironmentId(user.environmentId);
        } else {
            req.environmentDbName = null;
            req.envPrisma = null;
        }

        next();

    } catch (error) {
        logger.error(`Auth Middleware DB Error: ${error.message}`);
        return res.status(500).json({ error: 'Internal authentication error' });
    }
};

const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        // req.user is guaranteed to exist if authenticateToken passed
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        if (req.user.role === 'superadmin' && allowedRoles.length > 0 && !allowedRoles.includes('superadmin') && !req.user.environmentId) {
            return res.status(400).json({ error: 'Please select an environment first' });
        }

        if (req.user.role !== 'superadmin' && !allowedRoles.includes(req.user.role)) {
            logger.warn(`Access Denied: User ${req.user.username} (${req.user.role}) tried to access ${req.originalUrl}. Required: ${allowedRoles.join(', ')}`);
            return res.status(403).json({
                error: 'Access denied. Insufficient permissions.'
            });
        }

        next();
    };
};

module.exports = { authenticateToken, authorizeRoles };
