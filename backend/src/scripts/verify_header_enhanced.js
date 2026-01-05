const http = require('http');
const fs = require('fs');
const path = require('path');

// Helper for making HTTP requests (basic JSON)
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

// Minimal multipart uploader helper
function uploadImage(token) {
    return new Promise((resolve, reject) => {
        // Create a dummy file
        const dummyPath = path.join(__dirname, 'test_image.png');
        fs.writeFileSync(dummyPath, 'fakeimagecontent');

        const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

        const options = {
            hostname: 'localhost',
            port: 5000,
            path: '/api/custom-header-design/upload-image',
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
                fs.unlinkSync(dummyPath); // clean up
                resolve(JSON.parse(data));
            });
        });

        req.write(`--${boundary}\r\n`);
        req.write(`Content-Disposition: form-data; name="image"; filename="test_image.png"\r\n`);
        req.write(`Content-Type: image/png\r\n\r\n`);
        req.write(fs.readFileSync(dummyPath));
        req.write(`\r\n--${boundary}--\r\n`);
        req.end();
    });
}

async function verify() {
    try {
        console.log('1. Authenticating...');
        const phone = "9876543210";
        const otp = "123456";
        // Auth flow
        await request('POST', '/auth/send-otp', { phone });
        const verifyRes = await request('POST', '/auth/verify-otp', { phone, otp });
        const token = verifyRes.data.token;
        console.log('   Logged in.');

        // 2. Test Image Upload
        console.log('2. Testing Image Upload...');
        // Note: Since we are using a fake text file as png, multer might reject if it checks magic numbers, 
        // but our filter only checks extension and mimetype provided by client usually, verifying logic:
        // Actually multer checks mimetype from headers. Our filter checks file.mimetype which comes from headers.
        // So it should pass check but might correspond to corrupt image. That's fine for API test.

        // However, to be safe, creating a very small valid PNG signature? 
        // Or just trusting the extension check if that's what we implemented. Be careful.
        // Our implementation checks: path.extname AND file.mimetype.
        // The request helper sends "Content-Type: image/png".

        const uploadRes = await uploadImage(token);
        console.log('   Upload Result:', uploadRes);

        if (uploadRes.success) {
            console.log('   SUCCESS: Image uploaded.');
        } else {
            console.log('   FAILURE: Upload failed.');
        }

        const imagePath = uploadRes.filePath || "/uploads/fallback.png";

        // 3. Test Save with document_type (Scoped)
        console.log('3. Testing Save for "Sales Invoice"...');
        const invoicePayload = {
            document_type: "Sales Invoice",
            layout_type: "Professional",
            layers: [
                { type: "image", content: imagePath, position: { x: 0, y: 0 } }
            ]
        };
        await request('POST', '/custom-header-design', invoicePayload, token);

        // 4. Test Save with DIFFERENT document_type
        console.log('4. Testing Save for "Purchase Order"...');
        const poPayload = {
            document_type: "Purchase Order",
            layout_type: "Minimal", // Different layout
            layers: []
        };
        await request('POST', '/custom-header-design', poPayload, token);

        // 5. Test GET and verify separation
        console.log('5. Testing GET verification...');
        const getRes = await request('GET', '/custom-header-design', null, token);
        const configs = getRes.data.configurations;

        const invoiceConfig = configs["Sales Invoice"];
        const poConfig = configs["Purchase Order"];

        console.log(`   Invoice Layout: ${invoiceConfig ? invoiceConfig.layout_type : 'MISSING'}`);
        console.log(`   PO Layout: ${poConfig ? poConfig.layout_type : 'MISSING'}`);

        if (invoiceConfig && invoiceConfig.layout_type === "Professional" &&
            poConfig && poConfig.layout_type === "Minimal") {
            console.log('   SUCCESS: Configurations verified as separate.');
        } else {
            console.log('   FAILURE: Separation check failed.');
        }

    } catch (error) {
        console.error('Verification Error:', error);
    }
}

verify();
