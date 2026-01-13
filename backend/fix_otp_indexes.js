const mongoose = require('mongoose');
require('dotenv').config();

const fixIndexes = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const collections = await mongoose.connection.db.listCollections().toArray();
        const otpCollection = collections.find(c => c.name === 'otps');

        if (otpCollection) {
            console.log('Found otps collection. Listing indexes...');
            const indexes = await mongoose.connection.db.collection('otps').indexes();
            console.log('Current Indexes:', indexes);

            // Drop all indexes except _id (requires re-creation of necessary ones later, or just drop specific)
            // safer to drop specific unique ones if known, or just drop all non-id and let app recreate.
            // attempting to drop 'phone_1' and 'mobile_1' if they exist.

            for (const idx of indexes) {
                if (idx.name !== '_id_') {
                    console.log(`Dropping index: ${idx.name}`);
                    try {
                        await mongoose.connection.db.collection('otps').dropIndex(idx.name);
                        console.log(`Dropped ${idx.name}`);
                    } catch (e) {
                        console.log(`Failed to drop ${idx.name}: ${e.message}`);
                    }
                }
            }
        } else {
            console.log('otps collection not found.');
        }

        console.log('Done.');
        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

fixIndexes();
