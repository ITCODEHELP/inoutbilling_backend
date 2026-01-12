const http = require('http');

function request(method, path, token, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost', port: 5000, path: '/api' + path, method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        };
        const req = http.request(options, (res) => {
            let data = ''; res.on('data', c => data += c);
            res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch (e) { resolve({ status: res.statusCode, data }); } });
        });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// Multipart upload helper for inward payment + custom fields
function uploadPaymentWithFields(token, customFieldsJSON) {
    return new Promise((resolve) => {
        const boundary = '----BoundaryCF';
        const options = {
            hostname: 'localhost', port: 5000, path: '/api/inward-payments', method: 'POST',
            headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary, 'Authorization': `Bearer ${token}` }
        };
        const req = http.request(options, res => {
            let data = ''; res.on('data', c => data += c);
            res.on('end', () => resolve(JSON.parse(data)));
        });

        const bodyStart = `--${boundary}\r\n`;
        const fields = {
            receiptNo: `CF-REC-${Date.now()}`, companyName: "CF Tech", amount: "500",
            paymentDate: new Date().toISOString(), paymentType: "online",
            customFields: JSON.stringify(customFieldsJSON)
        };
        let payload = '';
        for (const [k, v] of Object.entries(fields)) payload += `${bodyStart}Content-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`;
        payload += `\r\n--${boundary}--\r\n`;
        req.write(payload);
        req.end();
    });
}

async function verify() {
    try {
        console.log('1. Authenticating...');
        // Auth flow (simplified for brevity, assume valid OTP flow works)
        const phone = "9876543210"; const otp = "123456";
        // ... skipping explicit auth code duplication, assume helper works or copy-paste
        // Actually need full code to run standalone
        const authRes = await new Promise((resolve) => {
            const req = http.request({ hostname: 'localhost', port: 5000, path: '/api/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); });
            req.write(JSON.stringify({ phone })); req.end();
        });
        const tokenRes = await new Promise((resolve) => {
            const req = http.request({ hostname: 'localhost', port: 5000, path: '/api/auth/verify-otp', method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); });
            req.write(JSON.stringify({ phone, otp })); req.end();
        });
        const token = tokenRes.token;
        console.log('   Logged in.');

        // 2. Create Custom Field Definition
        console.log('2. Creating Custom Field "Project ID"...');
        const cfRes = await request('POST', '/inward-payments/custom-fields', token, {
            name: "Project ID", type: "TEXT", status: "Active", required: true
        });
        console.log('   Created ID:', cfRes.data.data._id);
        const cfId = cfRes.data.data._id;

        // 3. Create Payment with Custom Field
        console.log('3. Creating Payment with Custom Field Value...');
        const payRes = await uploadPaymentWithFields(token, { [cfId]: "PROJ-Alpha" });
        if (payRes.success) console.log('   SUCCESS: Payment created with CF.');
        else console.log('   FAILURE:', payRes);

        // 4. Search by Custom Field
        console.log('4. Searching by Custom Field "Alpha"...');
        const searchRes = await request('GET', `/inward-payments/search?cf_${cfId}=Alpha`, token);
        console.log(`   Count: ${searchRes.data.count}`);
        if (searchRes.data.count > 0) console.log('   SUCCESS: Search found record.');

    } catch (e) { console.error(e); }
}
verify();


