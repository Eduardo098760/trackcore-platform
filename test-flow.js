#!/usr/bin/env node
/**
 * Teste completo do fluxo:
 * 1. POST /api/traccar/session (login)
 * 2. GET /api/traccar-debug/reports/events (com autenticação)
 * 3. GET /api/traccar-debug/positions (com autenticação)
 */

const http = require('http');
const { URL } = require('url');

const BASE_URL = 'http://localhost:3000';
let cookies = '';

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const allHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headers,
    };
    
    // Add cookies to request
    if (cookies) {
      allHeaders['Cookie'] = cookies;
    }

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: allHeaders,
    };

    console.log(`\n[${method}] ${url.href}`);
    if (cookies) console.log('  Cookies:', cookies.substring(0, 50) + '...');

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Extract and store cookies from response
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          if (Array.isArray(setCookie)) {
            cookies = setCookie.map(c => c.split(';')[0]).join('; ');
          } else {
            cookies = setCookie.split(';')[0];
          }
          console.log('  → Set-Cookie received:', cookies.substring(0, 50) + '...');
        }

        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });

    req.on('error', reject);
    if (body) {
      // Send as-is if it's a string (form-encoded), otherwise JSON stringify
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runFullFlow() {
  try {
    console.log('='.repeat(60));
    console.log('TESTE COMPLETO: Login + Eventos');
    console.log('='.repeat(60));

    // Step 1: Login
    console.log('\n[STEP 1] Fazer login com admin@example.com / admin');
    const loginData = new URLSearchParams({
      email: 'admin@example.com',
      password: 'admin',
    }).toString();
    
    const login = await makeRequest('POST', '/api/traccar/session', null, {
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    
    console.log('Status:', login.status);
    if (login.status === 200 || login.status === 400) {
      console.log('Body (first 200 chars):', login.body.substring(0, 200));
    }

    if (!cookies) {
      console.error('❌ Nenhum cookie recebido após login!');
      console.log('Response headers:', login.headers);
    } else {
      console.log('✅ Cookies obtidos com sucesso');
    }

    // Step 2: Test with debug endpoint
    console.log('\n[STEP 2] Testar /api/traccar-debug/reports/events');
    const events = await makeRequest('GET', '/api/traccar-debug/reports/events');
    console.log('Status:', events.status);
    
    try {
      const eventsJson = JSON.parse(events.body);
      if (eventsJson.tried) {
        console.log('Tentativas:');
        eventsJson.tried.forEach((t, i) => {
          console.log(`  ${i + 1}. ${t.url}`);
          console.log(`     Status: ${t.status} ${t.statusText}`);
          if (t.body && t.body.length > 0) {
            console.log(`     Body: ${t.body.substring(0, 100)}...`);
          }
        });
      }
    } catch (e) {
      console.log('Body:', events.body.substring(0, 300));
    }

    // Step 3: Test positions
    console.log('\n[STEP 3] Testar /api/traccar-debug/positions');
    const positions = await makeRequest('GET', '/api/traccar-debug/positions');
    console.log('Status:', positions.status);
    try {
      const posJson = JSON.parse(positions.body);
      if (posJson.tried) {
        console.log('Tentativas:');
        posJson.tried.forEach((t, i) => {
          console.log(`  ${i + 1}. ${t.url}`);
          console.log(`     Status: ${t.status} ${t.statusText}`);
        });
      }
    } catch (e) {
      console.log('Body:', positions.body.substring(0, 300));
    }

    console.log('\n' + '='.repeat(60));
    console.log('FIM DO TESTE');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

runFullFlow();
