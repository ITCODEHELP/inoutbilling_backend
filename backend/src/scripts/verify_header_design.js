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

        // 2. Test GET (initial)
        console.log('2. Testing GET (initial)...');
        const getRes1 = await request('GET', '/custom-header-design', null, token);
        console.log('   Initial GET:', JSON.stringify(getRes1.data));

        // 3. Test POST (Save Enhanced Design)
        console.log('3. Testing POST (Save Enhanced Design)...');
        const payload = {
            layout_type: "modern",
            design_variant: "shapes",
            header_height: 150,
            options: {
                show_pan: true,
                show_invoice_title: true
            },
            layers: [
                {
                    layer_id: "L1",
                    type: "text",
                    content: "Enhanced Shop",
                    position: { x: 10, y: 10 }
                }
            ]
        };
        const postRes = await request('POST', '/custom-header-design', payload, token);
        console.log('   POST Response:', postRes.data);

        // 4. Test GET (Verify)
        console.log('4. Testing GET (after save)...');
        const getRes2 = await request('GET', '/custom-header-design', null, token);
        console.log('   GET Result Height:', getRes2.data.header_height);
        console.log('   GET Result Options:', JSON.stringify(getRes2.data.options));

        if (getRes2.data.header_height === 150 && getRes2.data.options.show_pan === true) {
            console.log('   SUCCESS: Enhanced design saved correctly.');
        } else {
            console.log('   FAILURE: Mismatch.');
        }

        // 5. Test Partial Update (Change Options Only)
        console.log('5. Testing Partial POST (Change Options)...');
        const partialPayload = {
            options: {
                show_pan: false, // Change this
                copy_label: "ORIGINAL" // Add this
            }
        };
        await request('POST', '/custom-header-design', partialPayload, token);

        const getRes3 = await request('GET', '/custom-header-design', null, token);
        console.log('   Final Result Options:', JSON.stringify(getRes3.data.options));

        if (getRes3.data.options.show_pan === false && getRes3.data.options.show_invoice_title === true && getRes3.data.options.copy_label === "ORIGINAL") {
            console.log('   SUCCESS: Options merged correctly (false, preserved true, added new).');
        } else {
            console.log('   FAILURE: Options merge failed.');
        }

    } catch (error) {
        console.error('Verification Error:', error);
    }
}

verify();


