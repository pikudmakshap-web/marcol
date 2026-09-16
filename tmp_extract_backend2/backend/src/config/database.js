const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger.js');

const prisma = new PrismaClient({
    log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
    ],
});

// Log queries in development
if (process.env.NODE_ENV === 'development') {
    prisma.$on('query', (e) => {
        logger.debug(`Query: ${e.query}`);
    });
}

// Test connection
prisma.$connect()
    .then(() => logger.info('✅ Database connected'))
    .catch((err) => logger.error('❌ Database connection failed:', err));

module.exports = prisma;
