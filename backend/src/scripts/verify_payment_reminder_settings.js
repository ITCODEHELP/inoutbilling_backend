const http = require('http');

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
        // Step B: Verify OTP
        const verifyRes = await request('POST', '/auth/verify-otp', { phone, otp });
        token = verifyRes.data.token;

        if (!token) {
            console.error('FAILED: No token received', verifyRes.data);
            throw new Error("Token not received");
        }
        console.log('   Logged in successfully.');

        // 2. Test GET (initial - should be false/false default)
        console.log('2. Testing GET (initial)...');
        const getRes1 = await request('GET', '/payment-reminder-settings', null, token);
        console.log('   Initial GET:', JSON.stringify(getRes1.data));

        // 3. Test POST (enable email)
        console.log('3. Testing POST (Enable Email)...');
        const postRes = await request('POST', '/payment-reminder-settings', { email_reminder_enabled: true }, token);
        console.log('   POST Response:', postRes.data);

        // 4. Test GET (verify email enabled, whatsapp still false)
        console.log('4. Testing GET (after save)...');
        const getRes2 = await request('GET', '/payment-reminder-settings', null, token);
        console.log('   GET Result:', JSON.stringify(getRes2.data));

        if (getRes2.data.email_reminder_enabled === true && getRes2.data.whatsapp_reminder_enabled === false) {
            console.log('   SUCCESS: Partial update worked (Email True, WhatsApp False).');
        } else {
            console.log('   FAILURE: mismatch.', getRes2.data);
        }

        // 5. Test POST (Enable WhatsApp)
        console.log('5. Testing POST (Enable WhatsApp)...');
        await request('POST', '/payment-reminder-settings', { whatsapp_reminder_enabled: true }, token);

        const getRes3 = await request('GET', '/payment-reminder-settings', null, token);
        console.log('   Final Result:', JSON.stringify(getRes3.data));

        if (getRes3.data.email_reminder_enabled === true && getRes3.data.whatsapp_reminder_enabled === true) {
            console.log('   SUCCESS: Both enabled.');
        } else {
            console.log('   FAILURE: Final check failed.');
        }

    } catch (error) {
        console.error('Verification Error:', error);
    }
}

verify();


