const http = require('http');

// Test login with demo credentials
function testLogin() {
  const postData = new URLSearchParams({
    email: 'admin@example.com',
    password: 'admin',
  }).toString();

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/traccar/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log('Headers:', res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log('Response:', data);
      
      // Now test if we can access /api/traccar-debug/events with the session
      setTimeout(() => {
        testEvents();
      }, 1000);
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.write(JSON.stringify({ email: 'admin@example.com', password: 'admin' }));
  req.end();
}

function testEvents() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/traccar-debug/events',
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  };

  const req = http.request(options, (res) => {
    console.log(`\nEvents Status: ${res.statusCode}`);
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log('Events Response (pretty):', JSON.stringify(json, null, 2).substring(0, 1000));
      } catch (e) {
        console.log('Events Response (raw):', data.substring(0, 500));
      }
      process.exit(0);
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
    process.exit(1);
  });

  req.end();
}

testLogin();
