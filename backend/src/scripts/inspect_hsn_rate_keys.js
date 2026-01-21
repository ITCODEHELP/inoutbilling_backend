const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

const inspectKeys = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const collection = mongoose.connection.db.collection('HSN_Rate');

        const doc = await collection.findOne({});
        const output = Object.keys(doc).map(k => `Key: '${k}'`).join('\n');
        fs.writeFileSync('hsn_rate_keys.txt', output);

        console.log(output);

        await mongoose.disconnect();
    } catch (error) {
        fs.writeFileSync('hsn_rate_keys.txt', 'Error: ' + error.message);
    }
};

inspectKeys();
