const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const url = process.env.DATABASE_URL;

if (!url) {
    console.error("No DATABASE_URL found in .env file");
    process.exit(1);
}

async function migrateMessageReads() {
    console.log("Starting Message Reads Migration...");
    const client = new MongoClient(url);

    try {
        console.log("Connecting to MongoDB...");
        await client.connect();
        console.log("Connected to MongoDB successfully.");

        const db = client.db();
        const users = db.collection('users');
        const userMessageReads = db.collection('user_message_reads');

        // 1. Update all users to have `has_read_message: true` initially 
        // to avoid spamming everyone if there's an existing message
        console.log("Updating all users to set has_read_message: true...");
        const updateResult = await users.updateMany(
            {},
            { $set: { has_read_message: true } }
        );
        console.log(`Successfully updated ${updateResult.modifiedCount} users.`);

        // 2. Drop the old collection
        console.log("Dropping user_message_reads collection...");
        try {
            await userMessageReads.drop();
            console.log("user_message_reads collection dropped successfully.");
        } catch (error) {
            if (error.codeName === 'NamespaceNotFound') {
                console.log("user_message_reads collection does not exist, skipping drop.");
            } else {
                throw error;
            }
        }

        console.log("Migration complete!");

    } catch (error) {
        console.error("Migration failed with error:", error);
    } finally {
        await client.close();
        process.exit(0);
    }
}

migrateMessageReads();
