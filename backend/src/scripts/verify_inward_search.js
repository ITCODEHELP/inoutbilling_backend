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

        // 2. Test Search by Company (Partial)
        console.log('2. Search by Company "Test"...');
        const companyRes = await request('GET', '/inward-payments/search?companyName=Test', token);
        console.log(`   Count: ${companyRes.data.count}`);
        if (companyRes.data.success && companyRes.data.count >= 0) {
            console.log('   SUCCESS: Company search returned results (or empty if none match).');
        }

        // 3. Test Search by Payment Type (Exact)
        console.log('3. Search by Type "cash"...');
        const typeRes = await request('GET', '/inward-payments/search?paymentType=cash', token);
        console.log(`   Count: ${typeRes.data.count}`);

        // 4. Test Search by Amount Range
        console.log('4. Search Amount > 500...');
        const amountRes = await request('GET', '/inward-payments/search?minAmount=500', token);
        console.log(`   Count: ${amountRes.data.count}`);

        // 5. Test Search by Date (if any data matches today)
        // Using simple date from earlier test
        console.log('5. Search by Date (Today)...');
        const today = new Date().toISOString().split('T')[0];
        const dateRes = await request('GET', `/inward-payments/search?fromDate=${today}`, token);
        console.log(`   Count: ${dateRes.data.count}`);

    } catch (error) {
        console.error('Verification Error:', error);
    }
}

verify();


