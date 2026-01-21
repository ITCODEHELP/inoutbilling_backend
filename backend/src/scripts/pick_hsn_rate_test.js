const mongoose = require('mongoose');
require('dotenv').config();

const pickTest = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const collection = mongoose.connection.db.collection('HSN_Rate');

        const doc = await collection.findOne({});
        console.log("Test Code:", doc.HSN_Code);
        console.log("Test Rate:", doc.Rate);

        await mongoose.disconnect();
    } catch (error) {
        console.error(error);
    }
};

pickTest();
