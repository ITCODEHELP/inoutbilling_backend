const mongoose = require('mongoose');
require('dotenv').config();

const checkType = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const collection = mongoose.connection.db.collection('HSN_Rate');

        const doc = await collection.findOne({});
        console.log("Sample Value:", doc["HSN Code"]);
        console.log("Type:", typeof doc["HSN Code"]);

        await mongoose.disconnect();
    } catch (error) {
        console.error(error);
    }
};

checkType();
