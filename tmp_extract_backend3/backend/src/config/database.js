const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger.js');

const DEFAULT_ENV_DB_SUFFIX = '-5';
const DEFAULT_TENANT_NAME_FALLBACK = 'environment';
const MAIN_DB_NAME = 'main-marcol-5';
const USERS_DB_NAME = 'users-main-marcol';
const LEGACY_BOOTSTRAP_COLLECTION = '__bootstrap';
const MAIN_DB_COLLECTIONS = [
    'environments',
    'categories',
    'wallets',
    'wallet_users',
    'products',
    'transactions',
    'system_messages',
    'system_settings'
];
const USERS_DB_COLLECTIONS = [
    'environments',
    'users',
    'user_environments'
];
const TENANT_FORBIDDEN_USER_COLLECTIONS = ['users', 'user_environments'];

const baseDatabaseUrl = process.env.DATABASE_URL;
if (!baseDatabaseUrl) {
    throw new Error('DATABASE_URL is required');
}

const tenantClientCache = new Map();
const environmentDbNameCache = new Map();

function createPrismaClient(databaseUrl, label = 'control') {
    const prismaClient = new PrismaClient({
        datasourceUrl: databaseUrl,
        log: [
            { level: 'error', emit: 'stdout' },
            { level: 'warn', emit: 'stdout' }
        ]
    });

    if (process.env.NODE_ENV === 'development') {
        prismaClient.$on('query', (e) => {
            logger.debug(`[${label}] Query: ${e.query}`);
        });
    }

    return prismaClient;
}

function sanitizeDbNamePart(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[\/\\."$*<>:|?\s]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function buildEnvironmentDbName(environmentName, _environmentId) {
    const safeName = sanitizeDbNamePart(environmentName) || DEFAULT_TENANT_NAME_FALLBACK;
    const withSuffix = safeName.endsWith(DEFAULT_ENV_DB_SUFFIX) ? safeName : `${safeName}${DEFAULT_ENV_DB_SUFFIX}`;

    if (Buffer.byteLength(withSuffix, 'utf8') < 64) {
        return withSuffix;
    }

    const trimmed = withSuffix.slice(0, Math.max(1, withSuffix.length - DEFAULT_ENV_DB_SUFFIX.length - 1));
    return `${trimmed}${DEFAULT_ENV_DB_SUFFIX}`;
}

function buildMongoUrlForDbName(url, dbName) {
    const [urlWithoutQuery, query = ''] = String(url).split('?');
    const protocolIndex = urlWithoutQuery.indexOf('://');
    const firstSlashAfterHost = urlWithoutQuery.indexOf('/', protocolIndex + 3);

    const prefix = firstSlashAfterHost >= 0
        ? urlWithoutQuery.slice(0, firstSlashAfterHost + 1)
        : `${urlWithoutQuery}/`;

    const nextUrl = `${prefix}${dbName}`;
    return query ? `${nextUrl}?${query}` : nextUrl;
}

const controlPrisma = createPrismaClient(baseDatabaseUrl, 'control');
const usersPrisma = getTenantPrismaByDbName(USERS_DB_NAME);

controlPrisma.$connect()
    .then(() => logger.info('Database connected'))
    .catch((err) => logger.error('Database connection failed:', err));

async function resolveEnvironmentRecord(environmentId) {
    if (!environmentId) return null;

    const environment = await controlPrisma.environment.findUnique({
        where: { id: environmentId },
        select: { id: true, name: true, dbName: true, description: true, isActive: true }
    });

    return environment;
}

async function ensureEnvironmentDbName(environmentId) {
    if (!environmentId) return null;

    if (environmentDbNameCache.has(environmentId)) {
        return environmentDbNameCache.get(environmentId);
    }

    const environment = await resolveEnvironmentRecord(environmentId);
    if (!environment) {
        return null;
    }

    let dbName = environment.dbName;
    if (!dbName) {
        dbName = buildEnvironmentDbName(environment.name, environment.id);
        await controlPrisma.environment.update({
            where: { id: environment.id },
            data: { dbName }
        });
    }

    environmentDbNameCache.set(environmentId, dbName);
    return dbName;
}

function setEnvironmentDbNameCache(environmentId, dbName) {
    if (!environmentId || !dbName) return;
    environmentDbNameCache.set(environmentId, dbName);
}

function clearEnvironmentDbNameCache(environmentId) {
    if (!environmentId) return;
    environmentDbNameCache.delete(environmentId);
}

function getTenantPrismaByDbName(dbName) {
    if (!dbName) return null;

    if (tenantClientCache.has(dbName)) {
        return tenantClientCache.get(dbName);
    }

    const tenantUrl = buildMongoUrlForDbName(baseDatabaseUrl, dbName);
    const tenantPrisma = createPrismaClient(tenantUrl, `tenant:${dbName}`);
    tenantClientCache.set(dbName, tenantPrisma);
    return tenantPrisma;
}

async function ensureMainDatabaseExists() {
    const mainPrisma = getTenantPrismaByDbName(MAIN_DB_NAME);
    if (!mainPrisma) {
        throw new Error('Failed to initialize Prisma client for main database');
    }

    await dropCollectionIfExists(mainPrisma, LEGACY_BOOTSTRAP_COLLECTION);
    await dropCollectionsIfExist(mainPrisma, TENANT_FORBIDDEN_USER_COLLECTIONS);
    await ensureCollectionsExist(mainPrisma, MAIN_DB_COLLECTIONS);

    await ensureUsersDatabaseExists();
    const mainEnvironment = await ensureMainEnvironmentInControl();
    await bootstrapUsersEnvironment(mainEnvironment.id);
    await ensureMainDbDefaultUser();

    return {
        dbName: MAIN_DB_NAME
    };
}

async function ensureMainEnvironmentInControl() {
    const existingMain = await controlPrisma.environment.findFirst({
        where: { dbName: MAIN_DB_NAME }
    });

    if (existingMain) {
        return existingMain;
    }

    return controlPrisma.environment.create({
        data: {
            name: 'main',
            description: 'Main environment',
            isActive: true,
            dbName: MAIN_DB_NAME
        }
    });
}

async function ensureUsersDatabaseExists() {
    if (!usersPrisma) {
        throw new Error('Failed to initialize Prisma client for users database');
    }

    await dropCollectionIfExists(usersPrisma, LEGACY_BOOTSTRAP_COLLECTION);
    await ensureCollectionsExist(usersPrisma, USERS_DB_COLLECTIONS);
}

async function ensureCollectionsExist(targetPrisma, collections) {
    for (const collectionName of collections) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await targetPrisma.$runCommandRaw({ create: collectionName });
        } catch (error) {
            const namespaceExists = error?.code === 48 || error?.codeName === 'NamespaceExists';
            if (!namespaceExists) {
                throw error;
            }
        }
    }
}

async function dropCollectionIfExists(targetPrisma, collectionName) {
    try {
        await targetPrisma.$runCommandRaw({ drop: collectionName });
    } catch (error) {
        const namespaceMissing = error?.code === 26 || error?.codeName === 'NamespaceNotFound';
        if (!namespaceMissing) {
            throw error;
        }
    }
}

async function dropCollectionsIfExist(targetPrisma, collectionNames) {
    for (const collectionName of collectionNames) {
        // eslint-disable-next-line no-await-in-loop
        await dropCollectionIfExists(targetPrisma, collectionName);
    }
}

async function bootstrapUsersEnvironment(environmentId) {
    const environment = await resolveEnvironmentRecord(environmentId);
    if (!environment) return null;

    return usersPrisma.environment.upsert({
        where: { id: environment.id },
        update: {
            name: environment.name,
            description: environment.description,
            isActive: environment.isActive,
            dbName: environment.dbName || null
        },
        create: {
            id: environment.id,
            name: environment.name,
            description: environment.description,
            isActive: environment.isActive,
            dbName: environment.dbName || null
        }
    });
}

async function bootstrapAllEnvironmentsInUsersDb() {
    const environments = await controlPrisma.environment.findMany({
        select: { id: true }
    });

    for (const env of environments) {
        // eslint-disable-next-line no-await-in-loop
        await bootstrapUsersEnvironment(env.id);
    }
}

async function ensureMainDbDefaultUser() {
    const existingSuperAdmin = await usersPrisma.user.findFirst({
        where: { role: 'superadmin' },
        select: { id: true }
    });

    if (existingSuperAdmin) {
        return existingSuperAdmin;
    }

    const defaultUsername = process.env.MAIN_DB_DEFAULT_USERNAME || 'marcol';
    const defaultPassword = process.env.MAIN_DB_DEFAULT_PASSWORD || 'admin123';
    const defaultFullName = process.env.MAIN_DB_DEFAULT_FULLNAME || 'maecol';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const createdUser = await usersPrisma.user.create({
        data: {
            username: defaultUsername,
            passwordHash,
            fullName: defaultFullName,
            role: 'superadmin',
            isActive: true
        },
        select: { id: true, username: true }
    });

    logger.warn(`Default main DB user created: ${createdUser.username}`);
    return createdUser;
}

async function getTenantPrismaByEnvironmentId(environmentId) {
    const dbName = await ensureEnvironmentDbName(environmentId);
    return getTenantPrismaByDbName(dbName);
}

async function bootstrapTenantEnvironment(environmentId) {
    const environment = await resolveEnvironmentRecord(environmentId);
    if (!environment) return null;

    const dbName = await ensureEnvironmentDbName(environmentId);
    const tenantPrisma = getTenantPrismaByDbName(dbName);
    if (!tenantPrisma) return null;
    await dropCollectionsIfExist(tenantPrisma, TENANT_FORBIDDEN_USER_COLLECTIONS);

    await tenantPrisma.environment.upsert({
        where: { id: environment.id },
        update: {
            name: environment.name,
            description: environment.description,
            isActive: environment.isActive,
            dbName
        },
        create: {
            id: environment.id,
            name: environment.name,
            description: environment.description,
            isActive: environment.isActive,
            dbName
        }
    });

    await tenantPrisma.systemSettings.upsert({
        where: { environmentId: environment.id },
        update: {},
        create: {
            environmentId: environment.id,
            lowStockPercentage: 10
        }
    });

    return tenantPrisma;
}

module.exports = controlPrisma;
module.exports.controlPrisma = controlPrisma;
module.exports.usersPrisma = usersPrisma;
module.exports.buildEnvironmentDbName = buildEnvironmentDbName;
module.exports.buildMongoUrlForDbName = buildMongoUrlForDbName;
module.exports.ensureEnvironmentDbName = ensureEnvironmentDbName;
module.exports.setEnvironmentDbNameCache = setEnvironmentDbNameCache;
module.exports.clearEnvironmentDbNameCache = clearEnvironmentDbNameCache;
module.exports.getTenantPrismaByDbName = getTenantPrismaByDbName;
module.exports.ensureMainDatabaseExists = ensureMainDatabaseExists;
module.exports.ensureUsersDatabaseExists = ensureUsersDatabaseExists;
module.exports.bootstrapUsersEnvironment = bootstrapUsersEnvironment;
module.exports.bootstrapAllEnvironmentsInUsersDb = bootstrapAllEnvironmentsInUsersDb;
module.exports.ensureMainEnvironmentInControl = ensureMainEnvironmentInControl;
module.exports.ensureMainDbDefaultUser = ensureMainDbDefaultUser;
module.exports.getTenantPrismaByEnvironmentId = getTenantPrismaByEnvironmentId;
module.exports.bootstrapTenantEnvironment = bootstrapTenantEnvironment;
module.exports.MAIN_DB_NAME = MAIN_DB_NAME;
