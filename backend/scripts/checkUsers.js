const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, username: true, role: true, environmentId: true, isActive: true }
        });
        console.log('--- Users ---');
        console.log(JSON.stringify(users, null, 2));

        const environments = await prisma.environment.findMany();
        console.log('--- Environments ---');
        console.log(JSON.stringify(environments, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
