import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixEmptySKUs() {
    try {
        const res = await prisma.product.updateMany({
            where: { sku: "" },
            data: { sku: null }
        });
        console.log(`Updated ${res.count} products with empty skus to null.`);

        const res2 = await prisma.product.updateMany({
            where: { barcode: "" },
            data: { barcode: null }
        });
        console.log(`Updated ${res2.count} products with empty barcodes to null.`);
    } catch (error) {
        console.error("Error fixing SKUs:", error);
    } finally {
        await prisma.$disconnect();
    }
}

fixEmptySKUs();
