const assert = require('node:assert/strict');
const express = require('express');
const { test } = require('node:test');
const securityDemoRoutes = require('../src/routes/security-demo');

test('AES-GCM demo endpoint requires an authenticated session', async t => {
  const app = express();
  app.use((req, res, next) => {
    req.session = {};
    next();
  });
  app.use('/demo', securityDemoRoutes);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close(err => err ? reject(err) : resolve());
  }));

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/demo/aes-gcm/S001`, {
    method: 'POST',
  });
  const result = await response.json();

  assert.equal(response.status, 401);
  assert.equal(result.error, 'Unauthenticated');
});

test('AES-GCM demo enforces student record ownership', async t => {
  const app = express();
  app.use((req, res, next) => {
    req.session = { userId: 'S001', role: 'student' };
    next();
  });
  app.use('/demo', securityDemoRoutes);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close(err => err ? reject(err) : resolve());
  }));

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/demo/aes-gcm/S002`, {
    method: 'POST',
  });
  const result = await response.json();

  assert.equal(response.status, 403);
  assert.equal(result.message, 'Students may only view their own academic record.');
});
