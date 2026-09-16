const prisma = require('../config/database.js');
const logger = require('../utils/logger.js');

const authenticateToken = async (req, res, next) => {
    console.log("RECEIVED HEADERS:", req.headers);
    // 1. Get User ID from header (sent by frontend)
    console.log(req.headers['x-user-id'], "ddddddddd");

    const userId = req.headers['x-user-id'];

    if (!userId) {
        logger.warn('Auth Error: No x-user-id header provided');
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        // 2. Fetch user from Database
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            logger.warn(`Auth Error: User not found for ID ${userId}`);
            return res.status(401).json({ error: 'User not found' });
        }
        console.log(user);

        if (!user.isActive) {
            logger.warn(`Auth Error: User ${user.username} is inactive`);
            return res.status(403).json({ error: 'User account is inactive' });
        }

        // 3. Attach user to request object
        req.user = user;
        console.log("in sucsesfulyyyyyyyyyyyyyyyy");

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

        if (!allowedRoles.includes(req.user.role)) {
            logger.warn(`Access Denied: User ${req.user.username} (${req.user.role}) tried to access ${req.originalUrl}. Required: ${allowedRoles.join(', ')}`);
            return res.status(403).json({
                error: 'Access denied. Insufficient permissions.'
            });
        }

        next();
    };
};

module.exports = { authenticateToken, authorizeRoles };
