import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixEmptySkus() {
    try {
        console.log("Finding products with empty SKU strings...");
        const result = await prisma.product.updateMany({
            where: {
                sku: ""
            },
            data: {
                sku: null
            }
        });
        console.log(`Fixed ${result.count} products with empty SKU.`);

        const resultBarcode = await prisma.product.updateMany({
            where: {
                barcode: ""
            },
            data: {
                barcode: null
            }
        });
        console.log(`Fixed ${resultBarcode.count} products with empty barcode.`);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

fixEmptySkus();
