/**
 * Debug script to test API endpoints manually
 */

const http = require('http');

const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDQiLCJlbWFpbCI6ImNsaWVudDFAdGVzdC5jb20iLCJyb2xlIjoiQ0xJRU5UIiwiaWF0IjoxNzcwNjQ1MjcwLCJleHAiOjE3NzA2NDg4NzB9.SXlRnypK4kd4AG3yNfTOxtnWLxUMcfBy619MVp83hTM';

const requestData = JSON.stringify({
  title: 'Test Service Request',
  description: 'Testing API endpoint directly',
  serviceType: 'TAX_FILING',
  budget: 15000,
  deadline: '2026-04-30'
});

const options = {
  hostname: 'localhost',
  port: 8081,
  path: '/api/service-requests',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestData),
    'Authorization': `Bearer ${JWT_TOKEN}`
  }
};

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\nResponse Body:');
    try {
      console.log(JSON.stringify(JSON.parse(data), null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(requestData);
req.end();
