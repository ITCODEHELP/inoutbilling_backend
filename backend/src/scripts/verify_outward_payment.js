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

function uploadOutward(token, customFieldsJSON) {
    return new Promise((resolve) => {
        const boundary = '----BoundaryOutward';
        const options = {
            hostname: 'localhost', port: 5000, path: '/api/outward-payments', method: 'POST',
            headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary, 'Authorization': `Bearer ${token}` }
        };
        const req = http.request(options, res => {
            let data = ''; res.on('data', c => data += c);
            res.on('end', () => resolve(JSON.parse(data)));
        });

        const bodyStart = `--${boundary}\r\n`;
        const fields = {
            paymentNo: `OUT-${Date.now()}`, companyName: "Vendor Inc", amount: "1200",
            paymentDate: new Date().toISOString(), paymentType: "cheque",
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
        const phone = "9876543210"; const otp = "123456";
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

        // 2. Create Custom Field
        console.log('2. Creating Outward Custom Field "Expense Code"...');
        const cfRes = await request('POST', '/outward-payments/custom-fields', token, {
            name: "Expense Code", type: "TEXT", status: "Active", required: true
        });
        const cfId = cfRes.data.data._id;
        console.log('   CF Created:', cfId);

        // 3. Create Outward Payment
        console.log('3. Creating Outward Payment...');
        const payRes = await uploadOutward(token, { [cfId]: "EXP-999" });
        if (payRes.success) console.log('   SUCCESS: Created payment.');
        else console.log('   FAILURE:', payRes);

        // 4. Summary
        console.log('4. Fetching Summary...');
        const sumRes = await request('GET', '/outward-payments/summary', token);
        console.log('   Summary:', sumRes.data.data);

        // 5. Search
        console.log('5. Search by Custom Field...');
        const searchRes = await request('GET', `/outward-payments/search?cf_${cfId}=EXP-999`, token);
        console.log(`   Search Count: ${searchRes.data.count}`);
        if (searchRes.data.count > 0) console.log('   SUCCESS: Search worked.');

    } catch (e) { console.error(e); }
}
verify();
