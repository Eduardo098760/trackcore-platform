const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/traccar-debug/events',
  method: 'GET',
  timeout: 10000,
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Request timeout');
  req.destroy();
  process.exit(1);
});

req.end();
