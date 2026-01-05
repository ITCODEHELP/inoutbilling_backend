const http = require('http');

const BASE_URL = 'http://localhost:5000/api';

// Helper for making HTTP requests
function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: '/api' + path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const json = data ? JSON.parse(data) : {};
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function verify() {
    try {
        let token;
        console.log('1. Authenticating...');
        const phone = "9876543210";
        const otp = "123456";

        // Step A: Send OTP
        await request('POST', '/auth/send-otp', { phone });
        console.log('   OTP Request sent.');

        // Step B: Verify OTP
        const verifyRes = await request('POST', '/auth/verify-otp', { phone, otp });
        token = verifyRes.data.token;

        if (!token) {
            console.error('FAILED: No token received from verify-otp', verifyRes.data);
            throw new Error("Token not received");
        }
        console.log('   Logged in/Registered successfully.');

        // 2. Test GET (initial)
        console.log('2. Testing GET (initial)...');
        const getRes1 = await request('GET', '/shipping-envelope-settings', null, token);
        console.log('   Initial GET:', JSON.stringify(getRes1.data));

        // 3. Test POST (save settings)
        console.log('3. Testing POST (save)...');
        const payload = {
            shipping_options: {
                show_document_details: true,
                show_contact_number: false
            },
            title: "TEST TITLE",
            instruction: "TEST INSTRUCTION"
        };
        const postRes = await request('POST', '/shipping-envelope-settings', payload, token);
        console.log('   POST Response:', postRes.data);

        // 4. Test GET (after save)
        console.log('4. Testing GET (after save)...');
        const getRes2 = await request('GET', '/shipping-envelope-settings', null, token);
        console.log('   GET Result:', JSON.stringify(getRes2.data));

        if (getRes2.data.title === "TEST TITLE" && getRes2.data.shipping_options && getRes2.data.shipping_options.show_document_details === true) {
            console.log('   SUCCESS: Data matched.');
        } else {
            console.log('   FAILURE: Data mismatch.');
        }

        // 5. Test Partial Update (Merge)
        console.log('5. Testing Partial POST (Merge)...');
        const partialPayload = {
            envelope_options: {
                show_from_details: true
            },
            title: "UPDATED TITLE"
        };
        await request('POST', '/shipping-envelope-settings', partialPayload, token);

        const getRes3 = await request('GET', '/shipping-envelope-settings', null, token);
        console.log('   Merged Result:', JSON.stringify(getRes3.data));

        if (getRes3.data.shipping_options.show_document_details === true &&
            getRes3.data.envelope_options.show_from_details === true &&
            getRes3.data.title === "UPDATED TITLE") {
            console.log('   SUCCESS: Merge worked.');
        } else {
            console.log('   FAILURE: Merge failed.');
        }

    } catch (error) {
        console.error('Verification Error:', error);
    }
}

verify();
