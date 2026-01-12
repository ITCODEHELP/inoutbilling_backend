const http = require('http');

// Helper for HTTP requests
function request(method, path, token = null) {
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
        if (token) options.headers['Authorization'] = `Bearer ${token}`;

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, data: data }); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function verify() {
    try {
        console.log('1. Authenticating...');
        const authRes = await new Promise((resolve) => {
            const req = http.request({
                hostname: 'localhost', port: 5000, path: '/api/auth/send-otp', method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); });
            req.write(JSON.stringify({ phone: "9876543210" })); req.end();
        });

        const tokenRes = await new Promise((resolve) => {
            const req = http.request({
                hostname: 'localhost', port: 5000, path: '/api/auth/verify-otp', method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); });
            req.write(JSON.stringify({ phone: "9876543210", otp: "123456" })); req.end();
        });
        const token = tokenRes.token;
        console.log('   Logged in.');

        // 2. Fetch Summary
        console.log('2. Fetching Payment Summary...');
        const summaryRes = await request('GET', '/inward-payments/summary', token);
        console.log('   Summary:', summaryRes.data);

        if (summaryRes.data.success && summaryRes.data.data) {
            const { totalTransactions, totalAmount } = summaryRes.data.data;
            if (typeof totalTransactions === 'number' && typeof totalAmount === 'number') {
                console.log('   SUCCESS: Summary fetched with correct format.');
            } else {
                console.log('   FAILURE: Summary format incorrect.');
            }
        } else {
            console.log('   FAILURE: API returned error.');
        }

    } catch (error) {
        console.error('Verification Error:', error);
    }
}

verify();


