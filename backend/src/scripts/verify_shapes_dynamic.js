const http = require('http');

// Helper for making HTTP requests
function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: '/api' + path, // path acts as full path if needed or just path
            method: method,
            headers: { 'Content-Type': 'application/json' }
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
        if (body) req.write(JSON.stringify(body));
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

        // 2. Fetch All (Triggers Seed)
        console.log('2. Fetching All Shapes (Seeding check)...');
        const allRes = await request('GET', '/header-shapes', null, token);
        console.log(`   Count: ${allRes.data.count}`);
        if (allRes.data.count >= 4) console.log('   SUCCESS: Static data seeded/returned.');
        else console.log('   FAILURE: Data missing.');

        // 3. Filter by Category "Basic"
        console.log('3. Filtering by Category "Basic"...');
        const basicRes = await request('GET', '/header-shapes?category=Basic', null, token);
        const basicCount = basicRes.data.count;
        console.log(`   Basic Count: ${basicCount}`);

        const isBasicOnly = basicRes.data.data.every(s => s.category === 'Basic');
        if (basicCount > 0 && isBasicOnly) console.log('   SUCCESS: Category filtering works.');
        else console.log('   FAILURE: Category filtering failed.');

        // 4. Search "Phone"
        console.log('4. Searching "Phone"...');
        const searchRes = await request('GET', '/header-shapes?search=Phone', null, token);
        console.log(`   Search Count: ${searchRes.data.count}`);
        if (searchRes.data.count === 1 && searchRes.data.data[0].name.includes('Phone')) {
            console.log('   SUCCESS: Search works.');
        } else {
            console.log('   FAILURE: Search failed.');
        }

        // 5. Pagination
        console.log('5. Testing Pagination (limit=1)...');
        const pageRes = await request('GET', '/header-shapes?limit=1', null, token);
        if (pageRes.data.data.length === 1) {
            console.log('   SUCCESS: Limit works.');
        } else {
            console.log('   FAILURE: Pagination limit failed.');
        }

    } catch (error) {
        console.error('Verification Error:', error);
    }
}

verify();
