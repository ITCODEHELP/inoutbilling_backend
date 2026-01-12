const http = require('http');
const fs = require('fs');
const path = require('path');

// Helper for making HTTP requests
function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: path.startsWith('http') ? new URL(path).pathname : '/api' + path,
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
                    // If content-type is json
                    if (res.headers['content-type'] && res.headers['content-type'].includes('application/json')) {
                        const json = data ? JSON.parse(data) : {};
                        resolve({ status: res.statusCode, data: json });
                    } else {
                        resolve({ status: res.statusCode, data: data, headers: res.headers });
                    }
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

function uploadImage(token) {
    return new Promise((resolve, reject) => {
        const dummyPath = path.join(__dirname, 'test_preview.png');
        fs.writeFileSync(dummyPath, 'fakeimagecontent_preview');
        const boundary = '----WebKitFormBoundaryPreview';

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
                fs.unlinkSync(dummyPath);
                resolve(JSON.parse(data));
            });
        });

        req.write(`--${boundary}\r\n`);
        req.write(`Content-Disposition: form-data; name="image"; filename="test_preview.png"\r\n`);
        req.write(`Content-Type: image/png\r\n\r\n`);
        req.write(fs.readFileSync(dummyPath));
        req.write(`\r\n--${boundary}--\r\n`);
        req.end();
    });
}

// Function to check if URL is accessible
function checkUrl(url) {
    return new Promise((resolve) => {
        const req = http.get(url, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
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

        // 2. Upload Image
        console.log('2. Uploading Image for Preview...');
        const uploadRes = await uploadImage(token);
        console.log('   Upload Response:', uploadRes);

        if (uploadRes.success && uploadRes.image_url) {
            console.log(`   Got Image URL: ${uploadRes.image_url}`);

            // 3. Verify access
            console.log('3. Verifying Public Access...');
            const isAccessible = await checkUrl(uploadRes.image_url);
            if (isAccessible) {
                console.log('   SUCCESS: Image is publicly accessible.');
            } else {
                console.log('   FAILURE: Image URL is not accessible.');
            }

            // 4. Verify ID
            if (uploadRes.image_id) {
                console.log(`   Got Image ID: ${uploadRes.image_id}`);
            } else {
                console.log('   FAILURE: Image ID missing.');
            }

        } else {
            console.log('   FAILURE: Upload failed or no URL returned.');
        }

    } catch (error) {
        console.error('Verification Error:', error);
    }
}

verify();


