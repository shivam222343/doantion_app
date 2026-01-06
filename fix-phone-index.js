// Run this once to drop the problematic index
require('dotenv').config();
const mongoose = require('mongoose');

async function dropPhoneIndex() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('users');

        // Drop the phoneNumber index if it exists
        try {
            await collection.dropIndex('phoneNumber_1');
            console.log('✅ Successfully dropped phoneNumber_1 index');
        } catch (err) {
            if (err.code === 27) {
                console.log('Index phoneNumber_1 does not exist (already dropped)');
            } else {
                throw err;
            }
        }

        // Also drop phone_1 if it exists
        try {
            await collection.dropIndex('phone_1');
            console.log('✅ Successfully dropped phone_1 index');
        } catch (err) {
            if (err.code === 27) {
                console.log('Index phone_1 does not exist');
            }
        }

        console.log('\n✅ Database cleanup complete!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

dropPhoneIndex();
