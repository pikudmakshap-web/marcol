const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createSecondEnv() {
    try {
        const env = await prisma.environment.create({
            data: {
                name: 'סניף תל אביב',
                description: 'סניף נוסף לבדיקת מערכת המולטי-סביבה'
            }
        });
        console.log('✅ Second environment created:', env.id);

        await prisma.systemSettings.create({
            data: {
                environmentId: env.id,
                lowStockPercentage: 15
            }
        });
        console.log('✅ System settings created for the new environment');

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

createSecondEnv();
