const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log("Connecting to database and finding wallets without a walletNumber...");

    // Since walletNumber is defined as a non-nullable String in the schema,
    // Prisma will throw an error if we try to `findMany` and it parses a null.
    // We need to bypass the Prisma Client's strict typing to update them.
    // Let's use raw MongoDB access if possible, or update many.

    // prisma.wallet.updateMany with where: { walletNumber: null } might not work due to typing.
    // Wait, in Prisma we can use `{ isSet: false }` for MongoDB.

    const wallets = await prisma.wallet.findRaw({
        filter: { walletNumber: { $exists: false } }
    });

    console.log(`Found ${wallets.length} wallets without a walletNumber.`);

    for (const wallet of wallets) {
        const id = wallet._id.$oid;
        const randomNum = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`Updating wallet ${id} with walletNumber ${randomNum}`);

        // We can use updateRaw to bypass schema constraints if they are still null
        await prisma.wallet.updateRaw({
            filter: { _id: { $oid: id } },
            update: { $set: { wallet_number: randomNum } }
        });
    }

    // Also check for wallets where walletNumber is explicitly null
    const nullWallets = await prisma.wallet.findRaw({
        filter: { wallet_number: null }
    });

    console.log(`Found ${nullWallets.length} wallets with explicit null wallet_number.`);
    for (const wallet of nullWallets) {
        const id = wallet._id.$oid;
        const randomNum = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`Updating wallet ${id} with walletNumber ${randomNum}`);

        await prisma.wallet.updateRaw({
            filter: { _id: { $oid: id } },
            update: { $set: { wallet_number: randomNum } }
        });
    }

    console.log("Migration complete.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
