const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
    try {
        console.log('🚀 Starting data migration...');
        
        // 1. Get all users who have an environmentId and role
        const users = await prisma.user.findMany({
            where: {
                environmentId: { not: null },
                role: { not: 'superadmin' } // Superadmins are global
            }
        });

        console.log(`Found ${users.length} users to migrate.`);

        for (const user of users) {
            console.log(`Migrating user: ${user.username}...`);
            
            // Create the UserEnvironment record
            await prisma.userEnvironment.upsert({
                where: {
                    userId_environmentId: {
                        userId: user.id,
                        environmentId: user.environmentId
                    }
                },
                update: {
                    role: user.role
                },
                create: {
                    userId: user.id,
                    environmentId: user.environmentId,
                    role: user.role
                }
            });
        }

        console.log('✅ Migration completed successfully.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

migrate();
