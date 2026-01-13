const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const testSendOtp = async () => {
    try {
        const url = 'http://localhost:5000/api/auth/send-otp';
        const payload = {
            mobile: '9638038998',
            countryCode: '+91'
        };

        console.log(`Sending request to ${url}...`);
        console.log('Payload:', payload);

        const response = await axios.post(url, payload);

        console.log('Response Status:', response.status);
        console.log('Response Data:', response.data);

    } catch (error) {
        if (error.response) {
            console.error('Error Status:', error.response.status);
            console.error('Error Data:', error.response.data);
        } else {
            console.error('Error Message:', error.message);
        }
    }
};

testSendOtp();
