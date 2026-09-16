const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding initial Environment and SuperAdmin...');

    const env = await prisma.environment.create({
        data: {
            name: 'Main Store',
            description: 'The default system environment'
        }
    });

    console.log(`Created Environment: ${env.name} (ID: ${env.id})`);

    const passwordHash = await bcrypt.hash('admin123', 10);

    const superAdmin = await prisma.user.create({
        data: {
            username: 'superadmin',
            passwordHash,
            fullName: 'System Super Admin',
            role: 'superadmin',
            isActive: true,
            personalNumber: 'SUPERADMIN_01'
        }
    });

    console.log(`Created SuperAdmin: ${superAdmin.username}`);

    const regularAdmin = await prisma.user.create({
        data: {
            username: 'admin',
            passwordHash,
            fullName: 'Store Admin',
            role: 'admin',
            isActive: true,
            environmentId: env.id,
            personalNumber: 'ADMIN_01'
        }
    });

    console.log(`Created Admin: ${regularAdmin.username} for Environment: ${env.name}`);

}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
