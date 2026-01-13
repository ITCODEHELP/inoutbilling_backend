
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const OTP = require('./src/models/Login-Model/OTP');

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        const otps = await OTP.find({}).sort({createdAt: -1}).limit(5);
        console.log('Recent OTPs:', JSON.stringify(otps, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

run();
