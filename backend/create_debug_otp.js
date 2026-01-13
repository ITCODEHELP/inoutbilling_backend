
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const OTP = require('./src/models/Login-Model/OTP');

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        const mobile = '919999999999';
        const otp = 1234;
        
        // Delete existing for clean test
        await OTP.deleteMany({ mobile });
        
        const created = await OTP.create({
            mobile,
            otp,
            type: 'login',
            expiryTime: new Date(Date.now() + 10 * 60 * 1000) // 10 mins from now
        });
        
        console.log('Created Debug OTP:', JSON.stringify(created, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

run();
