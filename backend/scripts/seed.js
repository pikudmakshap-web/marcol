const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function seed() {
    try {
        // 1. Create or ensure superadmin exists
        const existingSuperadmin = await prisma.user.findFirst({ where: { role: 'superadmin' } });
        
        if (!existingSuperadmin) {
            const passwordHash = await bcrypt.hash('superadmin123', 10);
            const superadmin = await prisma.user.create({
                data: {
                    username: 'superadmin',
                    passwordHash,
                    fullName: 'מנהל על',
                    role: 'superadmin',
                    isActive: true
                }
            });
            console.log('✅ Superadmin created:', superadmin.username, '/ password: superadmin123');
        } else {
            console.log('ℹ️  Superadmin already exists:', existingSuperadmin.username);
        }

        // 2. Create or ensure default environment exists
        const existingEnv = await prisma.environment.findFirst({ where: { name: 'Main Store' } });
        
        if (!existingEnv) {
            const env = await prisma.environment.create({
                data: { name: 'Main Store', description: 'הסביבה הראשית של המערכת' }
            });

            // Create system settings for this environment
            await prisma.systemSettings.create({
                data: { environmentId: env.id, lowStockPercentage: 10 }
            });

            console.log('✅ Default environment "Main Store" created:', env.id);

            // 3. Create a default admin user for this environment
            const passwordHash = await bcrypt.hash('admin123', 10);
            const admin = await prisma.user.create({
                data: {
                    username: 'admin',
                    passwordHash,
                    fullName: 'מנהל מערכת',
                    role: 'admin',
                    personalNumber: '1000',
                    email: 'admin@system.local',
                    isActive: true,
                    environmentId: env.id
                }
            });
            console.log('✅ Admin user created for Main Store:', admin.username, '/ password: admin123');
        } else {
            console.log('ℹ️  Default environment already exists:', existingEnv.name);
        }

        console.log('\n🎉 Seed complete!');
    } catch (error) {
        console.error('❌ Seed error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

seed();
