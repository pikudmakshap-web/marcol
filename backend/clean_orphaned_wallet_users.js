const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const users = await prisma.user.findMany({ select: { id: true } });
        const userIds = users.map(u => u.id);
        const res1 = await prisma.walletUser.deleteMany({
            where: { userId: { notIn: userIds } }
        });
        console.log(`Deleted ${res1.count} orphaned WalletUser records missing a valid user.`);

        const wallets = await prisma.wallet.findMany({ select: { id: true } });
        const walletIds = wallets.map(w => w.id);
        const res2 = await prisma.walletUser.deleteMany({
            where: { walletId: { notIn: walletIds } }
        });
        console.log(`Deleted ${res2.count} orphaned WalletUser records missing a valid wallet.`);
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}
run().then(() => process.exit(0));
