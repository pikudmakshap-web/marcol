const prisma = require('../config/database.js');
const { getIO } = require('../socket.js');

/**
 * Identifies and removes category records that are no longer referenced 
 * by any Wallet or Product.
 */
async function cleanupUnusedCategories() {
    try {
        // 1. Get all current category records
        const allCategories = await prisma.category.findMany({
            select: { id: true, name: true }
        });

        // 2. Collect used category names from Wallets
        const wallets = await prisma.wallet.findMany({
            select: { categoryBalances: true }
        });
        const usedInWallets = new Set();
        wallets.forEach(w => {
            if (Array.isArray(w.categoryBalances)) {
                w.categoryBalances.forEach(cb => {
                    if (cb.categoryName) usedInWallets.add(cb.categoryName.trim());
                });
            }
        });

        // 3. Collect used category names from Products
        const products = await prisma.product.findMany({
            select: { category: true }
        });
        const usedInProducts = new Set();
        products.forEach(p => {
            if (p.category) usedInProducts.add(p.category.trim());
        });

        // 4. Find orphans
        const orphans = allCategories.filter(cat => {
            const name = cat.name.trim();
            if (name === 'ללא קטגוריה') return false;
            return !usedInWallets.has(name) && !usedInProducts.has(name);
        });

        if (orphans.length > 0) {
            console.log(`[CategoryCleanup] Removing ${orphans.length} unused categories:`, orphans.map(o => o.name));
            
            await prisma.category.deleteMany({
                where: {
                    id: { in: orphans.map(o => o.id) }
                }
            });

            // Notify clients that category list has changed
            if (getIO()) {
                getIO().emit('data_update', { type: 'category' });
            }
            return true;
        }
    } catch (error) {
        console.error('[CategoryCleanup] Error:', error);
    }
    return false;
}

module.exports = { cleanupUnusedCategories };
