const http = require('http');

const data = JSON.stringify({
    reportType: "gstr3",
    fromDate: "2025-01-01",
    toDate: "2026-02-27"
});

const req = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/reports/action/print',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': 'Bearer test' // dummy if needed
    }
}, res => {
    let body = '';
    res.on('data', chunk => { body += chunk; });
    res.on('end', () => { console.log('Response:', `${res.statusCode} ${body}`); });
});

req.on('error', e => { console.error('Error:', e.message); });
req.write(data);
req.end();
