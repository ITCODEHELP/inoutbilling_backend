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
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = data ? JSON.parse(data) : {};
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', (e) => reject(e));

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function verify() {
    try {
        console.log('1. Authenticating...');
        const phone = "9876543210";
        const otp = "123456";
        await request('POST', '/auth/send-otp', { phone });
        const verifyRes = await request('POST', '/auth/verify-otp', { phone, otp });
        const token = verifyRes.data.token;
        console.log('   Logged in.');

        // 2. Fetch Header Shapes
        console.log('2. Fetching Header Shapes...');
        const shapesRes = await request('GET', '/header-shapes', null, token);
        console.log('   Shapes Count:', shapesRes.data.count);

        if (shapesRes.data.success && shapesRes.data.data.length > 0) {
            console.log('   SUCCESS: Shapes fetched.');
            console.log('   Sample Shape:', shapesRes.data.data[0]);
        } else {
            console.log('   FAILURE: Could not fetch shapes.');
        }

        // 3. Save Design with Shapes Layer (mimic usage)
        console.log('3. Saving Design with Shape Layer...');
        const payload = {
            document_type: "Sales Invoice",
            layers: [
                {
                    layer_id: "L_SHAPE_1",
                    type: "shape",
                    source: shapesRes.data.data[0].shape_id, // Using fetched ID
                    position: { x: 50, y: 50 },
                    rotation: 45 // Verify rotation preservation
                }
            ]
        };

        await request('POST', '/custom-header-design', payload, token);

        // 4. Verify Persistence
        console.log('4. Verifying Design Persistence...');
        const getRes = await request('GET', '/custom-header-design', null, token);
        const savedConfig = getRes.data.configurations["Sales Invoice"];
        const savedLayer = savedConfig.layers[0];

        if (savedLayer.source === shapesRes.data.data[0].shape_id && savedLayer.rotation === 45) {
            console.log('   SUCCESS: Shape layer and properties (rotation) saved.');
        } else {
            console.log('   FAILURE: Layer properties verification failed.');
        }

    } catch (error) {
        console.error('Verification Error:', error);
    }
}

verify();
