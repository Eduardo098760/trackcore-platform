#!/usr/bin/env node
/**
 * Teste simples: verificar qual endpoint funciona sem autenticação
 */

const http = require('http');

const endpoints = [
  '/api/traccar/api/events',
  '/api/traccar/events',
  '/api/traccar/api/reports/events',
  '/api/traccar/reports/events',
  '/api/traccar/api/server',
];

let tested = 0;

endpoints.forEach(endpoint => {
  http.get(`http://localhost:3000${endpoint}`, (res) => {
    console.log(`[${res.statusCode}] ${endpoint}`);
    tested++;
    if (tested === endpoints.length) process.exit(0);
  }).on('error', (e) => {
    console.log(`[ERROR] ${endpoint}: ${e.message}`);
    tested++;
    if (tested === endpoints.length) process.exit(0);
  });
});

setTimeout(() => {
  console.log('Timeout reached');
  process.exit(1);
}, 5000);
