function requireTenantPrisma(req) {
    if (!req?.user?.environmentId || !req?.envPrisma) {
        const error = new Error('Environment context is required. Please select an environment first.');
        error.status = 400;
        throw error;
    }

    return req.envPrisma;
}

module.exports = { requireTenantPrisma };
