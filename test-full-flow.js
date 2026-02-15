#!/usr/bin/env node
/**
 * Testa o fluxo completo:
 * 1. Login no Traccar
 * 2. Obter eventos com a sessão autenticada
 */

const http = require('http');
const { URL } = require('url');

const BASE_URL = 'http://localhost:3000';

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    console.log(`[${method}] ${url.href}`);

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function runTests() {
  try {
    // Test 1: GET /api/traccar-debug/events (without auth)
    console.log('\n=== Test 1: GET /api/traccar-debug/events (no auth) ===');
    const test1 = await makeRequest('GET', '/api/traccar-debug/events');
    console.log('Status:', test1.status);
    try {
      const json = JSON.parse(test1.body);
      console.log('Tried:', json.tried?.map(t => `${t.status} ${t.url}`).join('\n  '));
    } catch (e) {
      console.log('Body:', test1.body.substring(0, 200));
    }

    // Test 2: Try login
    console.log('\n=== Test 2: POST /api/traccar/login ===');
    const test2 = await makeRequest('POST', '/api/traccar/login', {
      email: 'admin@example.com',
      password: 'admin',
    });
    console.log('Status:', test2.status);
    console.log('Body:', test2.body.substring(0, 200));
    console.log('Set-Cookie:', test2.headers['set-cookie']);

    // Test 3: Test with auth
    console.log('\n=== Test 3: GET /api/traccar-debug/positions (after login) ===');
    const test3 = await makeRequest('GET', '/api/traccar-debug/positions');
    console.log('Status:', test3.status);
    try {
      const json = JSON.parse(test3.body);
      console.log('Tried:', json.tried?.map(t => `${t.status} ${t.url}`).join('\n  '));
    } catch (e) {
      console.log('Body:', test3.body.substring(0, 200));
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

runTests();
