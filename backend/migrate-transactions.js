const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const url = process.env.DATABASE_URL;

if (!url) {
    console.error("No DATABASE_URL found in .env file");
    process.exit(1);
}

async function migrateTransactions() {
    console.log("Starting Transaction Items Migration...");
    const client = new MongoClient(url);

    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        console.log("Connected to MongoDB successfully.");

        const db = client.db();
        const transactions = db.collection('transactions');
        const transactionItems = db.collection('transaction_items');

        // Fetch all transactions
        const allTransactions = await transactions.find({}).toArray();
        console.log(`Found ${allTransactions.length} transactions to process.`);

        let successCount = 0;
        let failCount = 0;

        for (const tx of allTransactions) {
            try {
                // Find items for this transaction
                const items = await transactionItems.find({ transaction_id: tx._id }).toArray();

                if (items.length > 0) {
                    // Transform items
                    const embeddedItems = items.map(item => ({
                        // Keep ObjectId as ObjectId, string as string
                        product_id: item.product_id,
                        product_name: item.product_name,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        line_total: item.line_total,
                        created_at: item.created_at || new Date()
                    }));

                    await transactions.updateOne(
                        { _id: tx._id },
                        { $set: { items: embeddedItems } }
                    );
                    successCount++;
                    // console.log(`Migrated ${items.length} items to transaction ${tx._id}`);
                } else {
                    await transactions.updateOne(
                        { _id: tx._id },
                        { $set: { items: [] } }
                    );
                }
            } catch (err) {
                failCount++;
                console.error(`Failed to migrate items for transaction ${tx._id}:`, err);
            }
        }

        console.log(`Migration complete. Successfully updated: ${successCount}. Failed: ${failCount}`);

        // Remove the transaction_items collection
        console.log("Dropping transaction_items collection...");
        await transactionItems.drop();
        console.log("transaction_items collection dropped successfully.");

    } catch (error) {
        console.error("Migration failed with error:", error);
    } finally {
        await client.close();
        process.exit(0);
    }
}

migrateTransactions();
