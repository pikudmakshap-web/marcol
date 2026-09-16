require('dotenv').config();
const { MongoClient } = require('mongodb');

async function migrate() {
    console.log('Starting data migration...');
    const uri = process.env.DATABASE_URL;
    if (!uri) {
        console.error('DATABASE_URL is not set in .env');
        process.exit(1);
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db();

        const inventoryColl = db.collection('inventory');
        const settingsColl = db.collection('system_settings');
        const productsColl = db.collection('products');

        // Get system settings lowStockThreshold
        const settings = await settingsColl.findOne({});
        const defaultMinStockAlert = settings?.low_stock_threshold || 10;
        console.log(`Default min stock alert: ${defaultMinStockAlert}`);

        // Get all inventory items
        const inventories = await inventoryColl.find({}).toArray();
        console.log(`Found ${inventories.length} inventory records to merge.`);

        // For each inventory, update corresponding product
        let migratedCount = 0;
        for (const inv of inventories) {
            // Check if product exists
            const productId = inv.product_id;
            const updateFields = {
                quantity: inv.quantity !== undefined ? inv.quantity : 0,
                min_stock_alert: inv.min_stock_alert !== undefined ? inv.min_stock_alert : defaultMinStockAlert,
                location: inv.location || null,
                expiry_date: inv.expiry_date || null,
                last_restock_date: inv.last_restock_date || null,
                last_restock_by: inv.last_restock_by || null,
                cost_per_unit: inv.cost_per_unit || null
            };

            const result = await productsColl.updateOne(
                { _id: productId },
                { $set: updateFields }
            );

            if (result.matchedCount > 0) {
                migratedCount++;
            } else {
                console.warn(`Warning: Product ${productId} not found for inventory ${inv._id}`);
            }
        }

        console.log(`Successfully migrated ${migratedCount} products.`);
        console.log('Migration completed successfully.');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await client.close();
    }
}

migrate();
