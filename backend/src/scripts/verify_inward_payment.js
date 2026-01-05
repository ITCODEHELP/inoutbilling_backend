const http = require('http');
const fs = require('fs');
const path = require('path');

// Helper for HTTP requests
function request(method, path, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: '/api' + path,
            method: method,
            headers: headers
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, data: data }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

// Helper for multipart upload
function uploadPayment(token) {
    return new Promise((resolve, reject) => {
        const boundary = '----WebKitFormBoundaryInwardTest';
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: '/api/inward-payments',
            method: 'POST',
            headers: {
                'Content-Type': 'multipart/form-data; boundary=' + boundary,
                'Authorization': `Bearer ${token}`
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                resolve(JSON.parse(data));
            });
        });

        const bodyStart = `--${boundary}\r\n`;
        // Text fields
        let payload = '';
        const fields = {
            receiptNo: `REC-${Date.now()}`,
            companyName: "Test Company",
            amount: "1000",
            paymentDate: new Date().toISOString(),
            paymentType: "cash",
            totalOutstanding: "2000"
        };

        for (const [key, val] of Object.entries(fields)) {
            payload += `${bodyStart}Content-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`;
        }

        // File
        const dummyPath = path.join(__dirname, 'test_receipt.txt');
        fs.writeFileSync(dummyPath, 'receipt content');

        payload += `${bodyStart}Content-Disposition: form-data; name="attachment"; filename="test_receipt.txt"\r\n`;
        payload += `Content-Type: text/plain\r\n\r\n`;

        req.write(payload);
        req.write(fs.readFileSync(dummyPath));
        req.write(`\r\n--${boundary}--\r\n`);

        req.end();

        // cleanup
        setTimeout(() => { if (fs.existsSync(dummyPath)) fs.unlinkSync(dummyPath); }, 1000);
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

        // 2. Create Payment
        console.log('2. Creating Inward Payment...');
        const createRes = await uploadPayment(token);
        console.log('   Create Result:', createRes);

        if (createRes.success) {
            console.log('   SUCCESS: Payment created.');
        } else {
            console.log('   FAILURE: Payment creation failed.');
        }

        // 3. Get Payments
        console.log('3. Fetching Payments...');
        const getRes = await request('GET', '/inward-payments', { 'Authorization': `Bearer ${token}` });
        console.log(`   Count: ${getRes.data.count}`);

        if (getRes.data.success && getRes.data.count > 0) {
            console.log('   SUCCESS: Payments fetched.');
        } else {
            console.log('   FAILURE: Fetch failed.');
        }

    } catch (error) {
        console.error('Verification Error:', error);
    }
}

verify();
