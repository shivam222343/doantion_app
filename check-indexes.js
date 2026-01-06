// Check all indexes on users collection
require('dotenv').config();
const mongoose = require('mongoose');

async function checkIndexes() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB\n');

        const db = mongoose.connection.db;
        const collection = db.collection('users');

        const indexes = await collection.indexes();
        console.log('Current indexes on users collection:');
        console.log(JSON.stringify(indexes, null, 2));

        // Drop ALL indexes except _id
        for (const index of indexes) {
            if (index.name !== '_id_') {
                try {
                    await collection.dropIndex(index.name);
                    console.log(`\n✅ Dropped index: ${index.name}`);
                } catch (err) {
                    console.log(`\n❌ Could not drop ${index.name}:`, err.message);
                }
            }
        }

        console.log('\n✅ Cleanup complete!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkIndexes();
