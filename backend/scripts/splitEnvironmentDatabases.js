require('dotenv').config();

const prisma = require('../src/config/database.js');
const {
    buildEnvironmentDbName,
    setEnvironmentDbNameCache,
    bootstrapTenantEnvironment,
    getTenantPrismaByEnvironmentId
} = require('../src/config/database.js');

async function upsertManyById(items, upsertFn) {
    for (const item of items) {
        // eslint-disable-next-line no-await-in-loop
        await upsertFn(item);
    }
}

async function copyEnvironmentToTenant(environment) {
    let dbName = environment.dbName;
    if (!dbName) {
        dbName = buildEnvironmentDbName(environment.name, environment.id);
        await prisma.environment.update({
            where: { id: environment.id },
            data: { dbName }
        });
    }
    setEnvironmentDbNameCache(environment.id, dbName);

    const tenantPrisma = await bootstrapTenantEnvironment(environment.id);

    const [
        settings,
        categories,
        wallets,
        products,
        transactions,
        messages,
        userEnvs
    ] = await Promise.all([
        prisma.systemSettings.findFirst({ where: { environmentId: environment.id } }),
        prisma.category.findMany({ where: { environmentId: environment.id } }),
        prisma.wallet.findMany({ where: { environmentId: environment.id } }),
        prisma.product.findMany({ where: { environmentId: environment.id } }),
        prisma.transaction.findMany({ where: { environmentId: environment.id } }),
        prisma.systemMessage.findMany({ where: { environmentId: environment.id } }),
        prisma.userEnvironment.findMany({ where: { environmentId: environment.id } })
    ]);

    const walletIds = wallets.map((w) => w.id);
    const walletUsers = walletIds.length > 0
        ? await prisma.walletUser.findMany({ where: { walletId: { in: walletIds } } })
        : [];

    const userIds = [...new Set(userEnvs.map((ue) => ue.userId))];
    const users = userIds.length > 0
        ? await prisma.user.findMany({ where: { id: { in: userIds } } })
        : [];

    // Reset tenant env data before copy
    await tenantPrisma.transaction.deleteMany({ where: { environmentId: environment.id } });
    await tenantPrisma.walletUser.deleteMany({});
    await tenantPrisma.wallet.deleteMany({ where: { environmentId: environment.id } });
    await tenantPrisma.product.deleteMany({ where: { environmentId: environment.id } });
    await tenantPrisma.category.deleteMany({ where: { environmentId: environment.id } });
    await tenantPrisma.systemMessage.deleteMany({ where: { environmentId: environment.id } });
    await tenantPrisma.systemSettings.deleteMany({ where: { environmentId: environment.id } });
    await tenantPrisma.userEnvironment.deleteMany({ where: { environmentId: environment.id } });
    await tenantPrisma.user.deleteMany({});

    // Recreate base environment/system settings
    await bootstrapTenantEnvironment(environment.id);

    if (settings) {
        await tenantPrisma.systemSettings.upsert({
            where: { environmentId: environment.id },
            update: { lowStockPercentage: settings.lowStockPercentage },
            create: {
                environmentId: environment.id,
                lowStockPercentage: settings.lowStockPercentage
            }
        });
    }

    await upsertManyById(users, async (user) => {
        await tenantPrisma.user.upsert({
            where: { id: user.id },
            update: {
                username: user.username,
                passwordHash: user.passwordHash,
                fullName: user.fullName,
                personalNumber: user.personalNumber,
                barcode: user.barcode,
                role: user.role,
                email: user.email,
                isActive: user.isActive,
                lastSeen: user.lastSeen,
                hasReadMessage: user.hasReadMessage,
                environmentId: environment.id
            },
            create: {
                id: user.id,
                username: user.username,
                passwordHash: user.passwordHash,
                fullName: user.fullName,
                personalNumber: user.personalNumber,
                barcode: user.barcode,
                role: user.role,
                email: user.email,
                isActive: user.isActive,
                lastSeen: user.lastSeen,
                hasReadMessage: user.hasReadMessage,
                environmentId: environment.id
            }
        });
    });

    await upsertManyById(userEnvs, async (assignment) => {
        await tenantPrisma.userEnvironment.upsert({
            where: {
                userId_environmentId: {
                    userId: assignment.userId,
                    environmentId: assignment.environmentId
                }
            },
            update: { role: assignment.role, joinedAt: assignment.joinedAt },
            create: {
                id: assignment.id,
                userId: assignment.userId,
                environmentId: assignment.environmentId,
                role: assignment.role,
                joinedAt: assignment.joinedAt
            }
        });
    });

    await upsertManyById(categories, async (category) => {
        await tenantPrisma.category.upsert({
            where: { id: category.id },
            update: {
                name: category.name,
                color: category.color,
                createdAt: category.createdAt,
                environmentId: category.environmentId
            },
            create: {
                id: category.id,
                name: category.name,
                color: category.color,
                createdAt: category.createdAt,
                environmentId: category.environmentId
            }
        });
    });

    await upsertManyById(wallets, async (wallet) => {
        await tenantPrisma.wallet.upsert({
            where: { id: wallet.id },
            update: {
                walletNumber: wallet.walletNumber,
                name: wallet.name,
                description: wallet.description,
                currentBalance: wallet.currentBalance,
                categoryBalances: wallet.categoryBalances || [],
                renewalDate: wallet.renewalDate,
                renewalPeriod: wallet.renewalPeriod,
                isActive: wallet.isActive,
                createdAt: wallet.createdAt,
                updatedAt: wallet.updatedAt,
                environmentId: wallet.environmentId
            },
            create: {
                id: wallet.id,
                walletNumber: wallet.walletNumber,
                name: wallet.name,
                description: wallet.description,
                currentBalance: wallet.currentBalance,
                categoryBalances: wallet.categoryBalances || [],
                renewalDate: wallet.renewalDate,
                renewalPeriod: wallet.renewalPeriod,
                isActive: wallet.isActive,
                createdAt: wallet.createdAt,
                updatedAt: wallet.updatedAt,
                environmentId: wallet.environmentId
            }
        });
    });

    await upsertManyById(products, async (product) => {
        await tenantPrisma.product.upsert({
            where: { id: product.id },
            update: {
                name: product.name,
                description: product.description,
                sku: product.sku,
                barcode: product.barcode,
                category: product.category,
                unitPrice: product.unitPrice,
                supplierName: product.supplierName,
                imageUrl: product.imageUrl,
                isActive: product.isActive,
                createdAt: product.createdAt,
                updatedAt: product.updatedAt,
                quantity: product.quantity,
                initialQuantity: product.initialQuantity,
                minStockAlert: product.minStockAlert,
                location: product.location,
                expiryDate: product.expiryDate,
                lastRestockDate: product.lastRestockDate,
                lastRestockById: product.lastRestockById,
                costPerUnit: product.costPerUnit,
                environmentId: product.environmentId
            },
            create: {
                id: product.id,
                name: product.name,
                description: product.description,
                sku: product.sku,
                barcode: product.barcode,
                category: product.category,
                unitPrice: product.unitPrice,
                supplierName: product.supplierName,
                imageUrl: product.imageUrl,
                isActive: product.isActive,
                createdAt: product.createdAt,
                updatedAt: product.updatedAt,
                quantity: product.quantity,
                initialQuantity: product.initialQuantity,
                minStockAlert: product.minStockAlert,
                location: product.location,
                expiryDate: product.expiryDate,
                lastRestockDate: product.lastRestockDate,
                lastRestockById: product.lastRestockById,
                costPerUnit: product.costPerUnit,
                environmentId: product.environmentId
            }
        });
    });

    await upsertManyById(transactions, async (transaction) => {
        await tenantPrisma.transaction.upsert({
            where: { id: transaction.id },
            update: {
                transactionNumber: transaction.transactionNumber,
                officerId: transaction.officerId,
                cashierId: transaction.cashierId,
                walletId: transaction.walletId,
                totalAmount: transaction.totalAmount,
                transactionType: transaction.transactionType,
                status: transaction.status,
                notes: transaction.notes,
                createdAt: transaction.createdAt,
                environmentId: transaction.environmentId,
                items: transaction.items || []
            },
            create: {
                id: transaction.id,
                transactionNumber: transaction.transactionNumber,
                officerId: transaction.officerId,
                cashierId: transaction.cashierId,
                walletId: transaction.walletId,
                totalAmount: transaction.totalAmount,
                transactionType: transaction.transactionType,
                status: transaction.status,
                notes: transaction.notes,
                createdAt: transaction.createdAt,
                environmentId: transaction.environmentId,
                items: transaction.items || []
            }
        });
    });

    await upsertManyById(messages, async (message) => {
        await tenantPrisma.systemMessage.upsert({
            where: { id: message.id },
            update: {
                title: message.title,
                content: message.content,
                isActive: message.isActive,
                createdAt: message.createdAt,
                environmentId: message.environmentId
            },
            create: {
                id: message.id,
                title: message.title,
                content: message.content,
                isActive: message.isActive,
                createdAt: message.createdAt,
                environmentId: message.environmentId
            }
        });
    });

    await upsertManyById(walletUsers, async (walletUser) => {
        await tenantPrisma.walletUser.upsert({
            where: {
                walletId_userId: {
                    walletId: walletUser.walletId,
                    userId: walletUser.userId
                }
            },
            update: { assignedAt: walletUser.assignedAt },
            create: {
                id: walletUser.id,
                walletId: walletUser.walletId,
                userId: walletUser.userId,
                assignedAt: walletUser.assignedAt
            }
        });
    });

    return {
        environmentId: environment.id,
        dbName,
        copied: {
            users: users.length,
            userEnvironments: userEnvs.length,
            categories: categories.length,
            wallets: wallets.length,
            walletUsers: walletUsers.length,
            products: products.length,
            transactions: transactions.length,
            messages: messages.length
        }
    };
}

async function main() {
    const environments = await prisma.environment.findMany({
        orderBy: { createdAt: 'asc' }
    });

    if (environments.length === 0) {
        console.log('No environments found.');
        return;
    }

    console.log(`Splitting ${environments.length} environments into dedicated DBs...`);

    const report = [];
    for (const env of environments) {
        // eslint-disable-next-line no-await-in-loop
        const result = await copyEnvironmentToTenant(env);
        report.push(result);
        console.log(`Done: ${env.name} -> ${result.dbName}`);
    }

    console.log('Finished split:');
    console.log(JSON.stringify(report, null, 2));
}

main()
    .catch((error) => {
        console.error('splitEnvironmentDatabases failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await prisma.$disconnect();
        } catch (e) {
            // ignore disconnect errors
        }
    });
