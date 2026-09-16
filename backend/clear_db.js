const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Clearing all data...');
    await prisma.transaction.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.walletUser.deleteMany({});
    await prisma.wallet.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.systemMessage.deleteMany({});
    await prisma.systemSettings.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.environment.deleteMany({});
    console.log('Done clearing data!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
