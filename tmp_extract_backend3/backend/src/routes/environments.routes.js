const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.js');
const prisma = require('../config/database.js');
const { usersPrisma } = require('../config/database.js');
const {
    buildEnvironmentDbName,
    setEnvironmentDbNameCache,
    clearEnvironmentDbNameCache,
    bootstrapTenantEnvironment,
    bootstrapUsersEnvironment,
    getTenantPrismaByEnvironmentId
} = require('../config/database.js');
const bcrypt = require('bcrypt');
const { buildUserMapByIds } = require('../utils/userLookup.js');

const router = express.Router();

router.use(authenticateToken);
router.use(authorizeRoles('superadmin'));

// GET /api/environments - list all environments with stats
router.get('/', async (req, res, next) => {
    try {
        const environments = await prisma.environment.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' }
        });

        const withStats = await Promise.all(environments.map(async (env) => {
            const tenantPrisma = await getTenantPrismaByEnvironmentId(env.id);
            if (!tenantPrisma) return null;

            const listResult = await tenantPrisma.$runCommandRaw({
                listCollections: 1,
                filter: { name: 'environments' },
                nameOnly: true
            });
            const hasCoreEnvironmentCollection = (listResult?.cursor?.firstBatch || [])
                .some((collection) => collection.name === 'environments');
            if (!hasCoreEnvironmentCollection) return null;

            const [usersCount, productsCount, transactionsCount, revenueAgg] = await Promise.all([
                usersPrisma.userEnvironment.count({
                    where: {
                        environmentId: env.id,
                        user: { role: { not: 'superadmin' } }
                    }
                }),
                tenantPrisma.product.count({ where: { environmentId: env.id } }),
                tenantPrisma.transaction.count({ where: { environmentId: env.id } }),
                tenantPrisma.transaction.aggregate({
                    where: { environmentId: env.id, status: 'completed' },
                    _sum: { totalAmount: true }
                })
            ]);

            return {
                ...env,
                _count: {
                    users: usersCount,
                    products: productsCount,
                    transactions: transactionsCount
                },
                revenue: revenueAgg?._sum?.totalAmount || 0
            };
        }));

        return res.json(withStats.filter(Boolean));
    } catch (error) {
        return next(error);
    }
});

// GET /api/environments/:id/stats - detailed stats for environment
router.get('/:id/stats', async (req, res) => {
    try {
        const { id } = req.params;

        const environment = await prisma.environment.findUnique({
            where: { id },
            select: { id: true, name: true, description: true, isActive: true, dbName: true }
        });
        if (!environment || !environment.isActive) {
            return res.status(404).json({ error: 'Environment not found' });
        }

        const tenantPrisma = await getTenantPrismaByEnvironmentId(id);
        if (!tenantPrisma) {
            return res.status(404).json({ error: 'Environment database not found' });
        }

        const listResult = await tenantPrisma.$runCommandRaw({
            listCollections: 1,
            filter: { name: 'environments' },
            nameOnly: true
        });
        const hasCoreEnvironmentCollection = (listResult?.cursor?.firstBatch || [])
            .some((collection) => collection.name === 'environments');
        if (!hasCoreEnvironmentCollection) {
            return res.status(404).json({ error: 'Environment database is not initialized' });
        }

        const [walletStats, products, transactions, wallets, userEnvs] = await Promise.all([
            tenantPrisma.wallet.aggregate({
                where: { environmentId: id },
                _sum: { currentBalance: true },
                _count: { id: true }
            }),
            tenantPrisma.product.findMany({
                orderBy: { createdAt: 'desc' },
                select: { id: true, name: true, unitPrice: true, quantity: true, isActive: true }
            }),
            tenantPrisma.transaction.findMany({
                take: 20,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    officerId: true,
                    cashierId: true,
                    totalAmount: true,
                    transactionType: true,
                    status: true,
                    createdAt: true
                }
            }),
            tenantPrisma.wallet.findMany({
                orderBy: { currentBalance: 'desc' },
                include: {
                    walletUsers: {
                        select: { userId: true },
                        take: 1
                    }
                }
            }),
            usersPrisma.userEnvironment.findMany({
                where: { environmentId: id },
                select: {
                    role: true,
                    userId: true,
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            username: true,
                            email: true,
                            isActive: true
                        }
                    }
                },
                orderBy: { joinedAt: 'desc' }
            })
        ]);
        const transactionUserIds = transactions.flatMap((t) => [t.officerId, t.cashierId]);
        const walletOwnerIds = wallets.map((w) => w.walletUsers?.[0]?.userId).filter(Boolean);
        const userMap = await buildUserMapByIds(
            usersPrisma,
            [...transactionUserIds, ...walletOwnerIds, ...userEnvs.map((ue) => ue.userId)]
        );

        const usersList = userEnvs
            .filter((ue) => ue.role !== 'superadmin')
            .map((ue) => ({
                id: ue.user?.id || ue.userId,
                name: ue.user?.fullName,
                username: ue.user?.username,
                email: ue.user?.email,
                role: ue.role,
                status: ue.user?.isActive ? 'ôòéì' : 'ìà ôòéì'
            }));

        return res.json({
            environment,
            walletBalance: walletStats?._sum?.currentBalance || 0,
            walletCount: walletStats?._count?.id || 0,
            recentTransactions: transactions.map((t) => ({
                id: t.id,
                user: userMap.get(t.officerId)?.fullName || userMap.get(t.cashierId)?.fullName || '\u05DE\u05E2\u05E8\u05DB\u05EA',
                amount: t.totalAmount,
                type: t.transactionType,
                status: t.status,
                time: new Date(t.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
                date: new Date(t.createdAt).toLocaleDateString('he-IL')
            })),
            usersList,
            productsList: products.map((p) => ({
                id: p.id,
                name: p.name,
                price: p.unitPrice,
                stock: p.quantity,
                status: p.isActive ? '\u05E4\u05E2\u05D9\u05DC' : '\u05DC\u05D0 \u05E4\u05E2\u05D9\u05DC'
            })),
            walletsList: wallets.map((w) => ({
                id: w.id,
                user: userMap.get(w.walletUsers?.[0]?.userId)?.fullName || '\u05DC\u05DC\u05D0 \u05D1\u05E2\u05DC\u05D9\u05DD',
                balance: w.currentBalance,
                name: w.name,
                status: w.isActive ? '????' : '?? ????'
            }))
        });
    } catch (error) {
        console.error('[ENV STATS ERROR]:', error);
        return res.status(500).json({ error: 'Internal server error fetching stats', details: error.message });
    }
});

// POST /api/environments - create environment
router.post('/', async (req, res, next) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const created = await prisma.environment.create({
            data: { name, description }
        });

        const dbName = buildEnvironmentDbName(name, created.id);
        const environment = await prisma.environment.update({
            where: { id: created.id },
            data: { dbName }
        });
        setEnvironmentDbNameCache(environment.id, dbName);

        const tenantPrisma = await bootstrapTenantEnvironment(environment.id);
        await bootstrapUsersEnvironment(environment.id);

        await tenantPrisma.systemSettings.upsert({
            where: { environmentId: environment.id },
            update: {},
            create: { environmentId: environment.id, lowStockPercentage: 10 }
        });

        await tenantPrisma.category.upsert({
            where: {
                name_environmentId: {
                    name: '\u05DC\u05DC\u05D0 \u05E7\u05D8\u05D2\u05D5\u05E8\u05D9\u05D4',
                    environmentId: environment.id
                }
            },
            update: {},
            create: {
                name: '\u05DC\u05DC\u05D0 \u05E7\u05D8\u05D2\u05D5\u05E8\u05D9\u05D4',
                color: 'rgba(245, 245, 245, 0.15)',
                environmentId: environment.id
            }
        });

        return res.status(201).json(environment);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Environment name already exists' });
        }
        return next(error);
    }
});

// GET /api/environments/:id/users - users in specific environment
router.get('/:id/users', async (req, res, next) => {
    try {
        const { id } = req.params;
        const userEnvs = await usersPrisma.userEnvironment.findMany({
            where: { environmentId: id },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        fullName: true,
                        isActive: true,
                        personalNumber: true,
                        createdAt: true,
                        lastSeen: true
                    }
                }
            }
        });

        const users = userEnvs.map((ue) => ({
            ...ue.user,
            role: ue.role
        }));

        return res.json(users);
    } catch (error) {
        return next(error);
    }
});

// GET /api/environments/users/unassigned - users without assignments
router.get('/users/unassigned', async (req, res, next) => {
    try {
        const users = await usersPrisma.user.findMany({
            where: {
                role: { not: 'superadmin' },
                userEnvironments: { none: {} }
            },
            select: {
                id: true,
                username: true,
                fullName: true,
                isActive: true,
                personalNumber: true,
                createdAt: true,
                lastSeen: true
            }
        });
        return res.json(users);
    } catch (error) {
        return next(error);
    }
});

// GET /api/environments/users/all - all non-superadmin users + assignments
router.get('/users/all', async (req, res, next) => {
    try {
        const users = await usersPrisma.user.findMany({
            where: { role: { not: 'superadmin' } },
            select: {
                id: true,
                username: true,
                fullName: true,
                isActive: true,
                personalNumber: true,
                createdAt: true,
                lastSeen: true,
                userEnvironments: {
                    include: {
                        environment: { select: { id: true, name: true } }
                    }
                }
            },
            orderBy: { fullName: 'asc' }
        });

        const mapped = users.map((u) => ({
            ...u,
            environments: u.userEnvironments.map((ue) => ({
                id: ue.environment.id,
                name: ue.environment.name,
                role: ue.role
            }))
        }));

        return res.json(mapped);
    } catch (error) {
        return next(error);
    }
});

// GET /api/environments/superadmins
router.get('/superadmins', async (req, res, next) => {
    try {
        const admins = await usersPrisma.user.findMany({
            where: { role: 'superadmin' },
            select: { id: true, username: true, fullName: true, isActive: true, createdAt: true },
            orderBy: { fullName: 'asc' }
        });
        return res.json(admins);
    } catch (error) {
        return next(error);
    }
});

// POST /api/environments/superadmins
router.post('/superadmins', async (req, res, next) => {
    try {
        const { username, password, fullName, personalNumber } = req.body;
        if (!username || !password || !fullName) {
            return res.status(400).json({ error: 'username, password, fullName are required' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await usersPrisma.user.create({
            data: { username, passwordHash, fullName, personalNumber, role: 'superadmin', isActive: true }
        });
        const { passwordHash: _ignored, ...safeUser } = user;
        return res.status(201).json(safeUser);
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: 'Username already exists' });
        return next(error);
    }
});

// DELETE /api/environments/superadmins/:id
router.delete('/superadmins/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        if (id === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }

        await usersPrisma.user.deleteMany({ where: { id, role: 'superadmin' } });
        return res.json({ message: 'Superadmin deleted' });
    } catch (error) {
        return next(error);
    }
});

// POST /api/environments/:id/users - assign/create user for environment
router.post('/:id/users', async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            userId,
            username,
            password,
            fullName,
            personalNumber,
            email,
            role,
            assignmentMode
        } = req.body;

        await bootstrapTenantEnvironment(id);

        if (userId) {
            const userEnv = await usersPrisma.userEnvironment.upsert({
                where: {
                    userId_environmentId: {
                        userId,
                        environmentId: id
                    }
                },
                update: {
                    role: role || 'cashier'
                },
                create: {
                    userId,
                    environmentId: id,
                    role: role || 'cashier'
                }
            });

            const user = await usersPrisma.user.findUnique({ where: { id: userId } });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (assignmentMode === 'move') {
                const previousAssignments = await usersPrisma.userEnvironment.findMany({
                    where: {
                        userId,
                        environmentId: { not: id }
                    },
                    select: { environmentId: true }
                });

                await usersPrisma.userEnvironment.deleteMany({
                    where: {
                        userId,
                        environmentId: { not: id }
                    }
                });

                for (const assignment of previousAssignments) {
                    // eslint-disable-next-line no-await-in-loop
                    const previousTenantPrisma = await getTenantPrismaByEnvironmentId(assignment.environmentId);
                    if (!previousTenantPrisma) continue;
                    // eslint-disable-next-line no-await-in-loop
                    await previousTenantPrisma.walletUser.deleteMany({
                        where: { userId }
                    });
                }

                await usersPrisma.user.update({
                    where: { id: userId },
                    data: { environmentId: id }
                });
            } else if (!user.environmentId) {
                await usersPrisma.user.update({
                    where: { id: userId },
                    data: { environmentId: id }
                });
            }

            return res.json(userEnv);
        }

        if (!username || !password || !fullName || !role) {
            return res.status(400).json({ error: 'Missing required fields for new user' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await usersPrisma.user.create({
            data: {
                username,
                passwordHash,
                fullName,
                personalNumber,
                email: email || (personalNumber ? `${personalNumber}@idf.com` : undefined),
                role,
                environmentId: id,
                isActive: true
            }
        });

        await usersPrisma.userEnvironment.create({
            data: {
                userId: user.id,
                environmentId: id,
                role
            }
        });

        return res.status(201).json(user);
    } catch (error) {
        return next(error);
    }
});

// DELETE /api/environments/:id/users/:userId - remove user assignment from specific environment
router.delete('/:id/users/:userId', async (req, res, next) => {
    try {
        const { id, userId } = req.params;

        const existingAssignment = await usersPrisma.userEnvironment.findUnique({
            where: {
                userId_environmentId: {
                    userId,
                    environmentId: id
                }
            }
        });

        if (!existingAssignment) {
            return res.status(404).json({ error: 'User assignment not found in this environment' });
        }

        const tenantPrisma = await getTenantPrismaByEnvironmentId(id);
        if (tenantPrisma) {
            await tenantPrisma.walletUser.deleteMany({
                where: { userId }
            });
        }

        await usersPrisma.userEnvironment.delete({
            where: {
                userId_environmentId: {
                    userId,
                    environmentId: id
                }
            }
        });

        const user = await usersPrisma.user.findUnique({
            where: { id: userId },
            select: { id: true, environmentId: true }
        });

        if (user?.environmentId === id) {
            const remainingAssignments = await usersPrisma.userEnvironment.findMany({
                where: { userId },
                orderBy: { joinedAt: 'desc' },
                select: { environmentId: true }
            });

            await usersPrisma.user.update({
                where: { id: userId },
                data: { environmentId: remainingAssignments[0]?.environmentId || null }
            });
        }

        return res.json({ message: 'User assignment removed successfully' });
    } catch (error) {
        return next(error);
    }
});

// PUT /api/environments/:id - update environment details
router.put('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, isActive } = req.body;

        const current = await prisma.environment.findUnique({ where: { id } });
        if (!current) {
            return res.status(404).json({ error: 'Environment not found' });
        }

        const data = { name, description, isActive };
        const environment = await prisma.environment.update({
            where: { id },
            data
        });

        if (name && name !== current.name && !current.dbName) {
            const dbName = buildEnvironmentDbName(name, id);
            await prisma.environment.update({ where: { id }, data: { dbName } });
            setEnvironmentDbNameCache(id, dbName);
        } else {
            clearEnvironmentDbNameCache(id);
        }

        const tenantPrisma = await getTenantPrismaByEnvironmentId(id);
        if (tenantPrisma) {
            await tenantPrisma.environment.upsert({
                where: { id },
                update: {
                    name: environment.name,
                    description: environment.description,
                    isActive: environment.isActive,
                    dbName: environment.dbName || current.dbName || null
                },
                create: {
                    id,
                    name: environment.name,
                    description: environment.description,
                    isActive: environment.isActive,
                    dbName: environment.dbName || current.dbName || null
                }
            });
        }
        await bootstrapUsersEnvironment(id);

        return res.json(environment);
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
