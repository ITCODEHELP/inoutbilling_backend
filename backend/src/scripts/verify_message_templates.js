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
            console.error('FAILED: No token received from verify-otp', verifyRes.data);
            throw new Error("Token not received");
        }
        console.log('   Logged in successfully.');

        // 2. Test GET (initial)
        console.log('2. Testing GET (initial)...');
        const getRes1 = await request('GET', '/message-templates', null, token);
        console.log('   Initial GET:', JSON.stringify(getRes1.data));

        // 3. Test POST (save templates)
        console.log('3. Testing POST (save)...');
        const payload = {
            "Sales Invoice": {
                "email": {
                    "subject": "Invoice {{invoice-no}} from {{company}}",
                    "body": "Dear {{contact-person}}, please find attached."
                },
                "whatsapp": {
                    "subject": "Invoice Alert",
                    "body": "Hi {{contact-person}}, invoice {{invoice-no}} is ready."
                }
            },
            "Purchase Order": {
                "email": { "subject": "PO Created", "body": "Order attached." }
            }
        };
        const postRes = await request('POST', '/message-templates', payload, token);
        console.log('   POST Response:', postRes.data);

        // 4. Test GET (after save)
        console.log('4. Testing GET (after save)...');
        const getRes2 = await request('GET', '/message-templates', null, token);
        console.log('   GET Result:', JSON.stringify(getRes2.data));

        // Check if data matches
        if (getRes2.data["Sales Invoice"].email.subject.includes("{{invoice-no}}")) {
            console.log('   SUCCESS: Template saved correctly.');
        } else {
            console.log('   FAILURE: Template mismatch.');
        }

        // 5. Test Partial Update (Merge)
        console.log('5. Testing Partial POST (Merge)...');
        const partialPayload = {
            "Sales Invoice": {
                "whatsapp": {
                    "body": "Updated WhatsApp Body"
                }
            },
            "Delivery Challan": {
                "email": { "subject": "DC {{invoice-no}}", "body": "Details..." }
            }
        };
        await request('POST', '/message-templates', partialPayload, token);

        const getRes3 = await request('GET', '/message-templates', null, token);
        console.log('   Merged Result:', JSON.stringify(getRes3.data));

        // Validations
        const invoiceEmailSubjectPreserved = getRes3.data["Sales Invoice"].email.subject === "Invoice {{invoice-no}} from {{company}}";
        const invoiceWhatsappBodyUpdated = getRes3.data["Sales Invoice"].whatsapp.body === "Updated WhatsApp Body";
        const dcAdded = getRes3.data["Delivery Challan"].email.subject === "DC {{invoice-no}}";

        if (invoiceEmailSubjectPreserved && invoiceWhatsappBodyUpdated && dcAdded) {
            console.log('   SUCCESS: Merge worked (preserved old, updated new, added new type).');
        } else {
            console.log('   FAILURE: Merge logic failed.');
        }

    } catch (error) {
        console.error('Verification Error:', error);
    }
}

verify();
