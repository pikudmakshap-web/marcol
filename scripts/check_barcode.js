const prisma = require('./backend/src/config/database');

async function checkBarcode() {
    const barcode = '7290002331490';
    console.log(`Checking barcode: ${barcode}`);

    const product = await prisma.product.findFirst({
        where: { barcode: barcode },
        include: { environment: true }
    });

    if (product) {
        console.log('Found PRODUCT:');
        console.log(JSON.stringify(product, null, 2));
    } else {
        console.log('Product not found.');
    }

    const user = await prisma.user.findFirst({
        where: { barcode: barcode },
        include: { userEnvironments: { include: { environment: true } } }
    });

    if (user) {
        console.log('Found USER:');
        console.log(JSON.stringify(user, null, 2));
    } else {
        console.log('User not found.');
    }

    await prisma.$disconnect();
}

checkBarcode().catch(console.error);
