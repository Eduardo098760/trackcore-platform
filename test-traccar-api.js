const http = require('http');

const endpoints = [
  'http://sv01.rastrear.app.br/api/',
  'http://sv01.rastrear.app.br/',
  'http://sv01.rastrear.app.br/api/reports/events',
  'http://sv01.rastrear.app.br/api/server',
  'http://sv01.rastrear.app.br/api/positions',
];

let tested = 0;

endpoints.forEach(url => {
  http.get(url, (res) => {
    console.log(`\n[${res.statusCode}] ${url}`);
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Body:', data.substring(0, 300));
      tested++;
      if (tested === endpoints.length) process.exit(0);
    });
  }).on('error', (e) => {
    console.log(`[ERROR] ${url}: ${e.message}`);
    tested++;
    if (tested === endpoints.length) process.exit(0);
  });
});
