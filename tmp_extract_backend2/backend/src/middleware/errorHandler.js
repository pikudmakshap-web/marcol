const logger = require('../utils/logger.js');

const errorHandler = (err, req, res, next) => {
    logger.error(`Error: ${err.message}`, { stack: err.stack });

    // Prisma errors
    if (err.code === 'P2002') {
        return res.status(409).json({
            error: 'Duplicate entry. Record already exists.'
        });
    }

    if (err.code === 'P2025') {
        return res.status(404).json({
            error: 'Record not found.'
        });
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation failed',
            details: err.details
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
    }

    // Default error
    const status = err.status || 500;
    const message = err.message || 'Internal server error';

    res.status(status).json({ error: message });
};

module.exports = { errorHandler };
