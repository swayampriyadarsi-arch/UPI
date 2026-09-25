/**
 * api.test.js — Supertest integration tests.
 *
 * Uses mongodb-memory-server: no real MongoDB installation required.
 * MongoMemoryServer downloads a real mongod binary the first time it runs
 * (cached in ~/.cache/mongodb-binaries for subsequent runs).
 *
 * Port of Java IdempotencyConcurrencyTest plus full API coverage.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const request       = require('supertest');
const mongoose      = require('mongoose');
const app           = require('../app');
const connectDB     = require('../config/db');
const demoService   = require('../services/demoService');
const idempotency   = require('../services/idempotencyService');
const meshService   = require('../services/meshService');
const Account       = require('../models/Account');
const Transaction   = require('../models/Transaction');
const cryptoService = require('../services/cryptoService');

let mongod;

// ─── Global Setup ──────────────────────────────────────────────────────────────
// Start the in-memory MongoDB BEFORE connecting, so MONGO_URI is set in time
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri() + 'upi_offline_test';
  await connectDB();
  await Account.deleteMany({});
  await Transaction.deleteMany({});
  await demoService.seedAccounts();
}, 120_000); // First run downloads mongod binary; allow 2 min

beforeEach(() => {
  idempotency.clear();
  meshService.resetMesh();
});

afterAll(async () => {
  await mongoose.connection.close();
  if (mongod) await mongod.stop();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

// 1. Server key
test('GET /api/server-key returns RSA public key info', async () => {
  const res = await request(app).get('/api/server-key');
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('publicKey');
  expect(res.body).toHaveProperty('algorithm');
  expect(res.body.publicKey.length).toBeGreaterThan(100);
});

// 2. Accounts
test('GET /api/accounts returns 4 seeded accounts', async () => {
  const res = await request(app).get('/api/accounts');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body.length).toBe(4);
  const vpas = res.body.map((a) => a.vpa);
  ['alice@demo', 'bob@demo', 'carol@demo', 'dave@demo'].forEach((v) =>
    expect(vpas).toContain(v)
  );
});

// 3. Transactions (empty at start of test run)
test('GET /api/transactions returns array', async () => {
  const res = await request(app).get('/api/transactions');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

// 4. Mesh state
test('GET /api/mesh/state returns 5 devices', async () => {
  const res = await request(app).get('/api/mesh/state');
  expect(res.status).toBe(200);
  expect(res.body.devices).toHaveLength(5);
  const bridgeDevice = res.body.devices.find((d) => d.deviceId === 'phone-bridge');
  expect(bridgeDevice.hasInternet).toBe(true);
});

// 5. Demo send — successful
test('POST /api/demo/send injects packet into mesh', async () => {
  const res = await request(app)
    .post('/api/demo/send')
    .send({ senderVpa: 'alice@demo', receiverVpa: 'bob@demo', amount: 100, pin: '1234' });
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('packetId');
  expect(res.body).toHaveProperty('ciphertextPreview');
  expect(res.body.injectedAt).toBe('phone-alice');
});

// 6. Demo send — missing fields → 400
test('POST /api/demo/send with missing fields returns 400', async () => {
  const res = await request(app)
    .post('/api/demo/send')
    .send({ senderVpa: 'alice@demo' }); // missing receiverVpa, amount, pin
  expect(res.status).toBe(400);
  expect(res.body.success).toBe(false);
});

// 7. Gossip
test('POST /api/mesh/gossip runs a gossip round', async () => {
  await request(app).post('/api/demo/send')
    .send({ senderVpa: 'alice@demo', receiverVpa: 'bob@demo', amount: 50, pin: '1234' });
  const res = await request(app).post('/api/mesh/gossip');
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('transfers');
  expect(res.body.transfers).toBeGreaterThan(0);
  expect(res.body).toHaveProperty('deviceCounts');
});

// 8. Full end-to-end: inject → gossip → flush → SETTLED + balances updated
test('Full flow: send → gossip → flush settles the payment', async () => {
  const aliceBefore = parseFloat((await Account.findById('alice@demo')).balance.toString());
  const bobBefore   = parseFloat((await Account.findById('bob@demo')).balance.toString());

  await request(app).post('/api/demo/send')
    .send({ senderVpa: 'alice@demo', receiverVpa: 'bob@demo', amount: 200, pin: '1234', ttl: 5 });
  await request(app).post('/api/mesh/gossip');

  const flushRes = await request(app).post('/api/mesh/flush');
  expect(flushRes.status).toBe(200);
  expect(flushRes.body.uploadsAttempted).toBeGreaterThan(0);

  const settled = flushRes.body.results.filter((r) => r.outcome === 'SETTLED');
  expect(settled.length).toBe(1);

  const aliceAfter = parseFloat((await Account.findById('alice@demo')).balance.toString());
  const bobAfter   = parseFloat((await Account.findById('bob@demo')).balance.toString());
  expect(aliceAfter).toBeCloseTo(aliceBefore - 200, 1);
  expect(bobAfter).toBeCloseTo(bobBefore + 200, 1);
});

// 9. Idempotency: second flush → DUPLICATE_DROPPED
test('Idempotency: second flush of same packet is dropped', async () => {
  await request(app).post('/api/demo/send')
    .send({ senderVpa: 'carol@demo', receiverVpa: 'alice@demo', amount: 50, pin: '5678' });
  await request(app).post('/api/mesh/gossip');

  const flush1 = await request(app).post('/api/mesh/flush');
  const flush2 = await request(app).post('/api/mesh/flush'); // same bridge packets

  const totalSettled =
    flush1.body.results.filter((r) => r.outcome === 'SETTLED').length +
    flush2.body.results.filter((r) => r.outcome === 'SETTLED').length;
  const dups = flush2.body.results.filter((r) => r.outcome === 'DUPLICATE_DROPPED').length;

  expect(totalSettled).toBe(1);
  expect(dups).toBeGreaterThan(0);
});

// 10. Reset
test('POST /api/mesh/reset clears devices and cache', async () => {
  await request(app).post('/api/demo/send')
    .send({ senderVpa: 'alice@demo', receiverVpa: 'bob@demo', amount: 10, pin: '1234' });
  const resetRes = await request(app).post('/api/mesh/reset');
  expect(resetRes.status).toBe(200);

  const stateRes = await request(app).get('/api/mesh/state');
  expect(stateRes.body.idempotencyCacheSize).toBe(0);
  stateRes.body.devices.forEach((d) => expect(d.packetCount).toBe(0));
});

// 11. Direct bridge ingest — valid packet
test('POST /api/bridge/ingest — valid packet is processed', async () => {
  const packet = demoService.createPacket('alice@demo', 'bob@demo', 75, '1234', 3);
  const res = await request(app)
    .post('/api/bridge/ingest')
    .set('X-Bridge-Node-Id', 'test-bridge')
    .set('X-Hop-Count', '2')
    .send(packet.toJSON());
  expect(res.status).toBe(200);
  expect(['SETTLED', 'REJECTED']).toContain(res.body.outcome);
});

// 12. Direct bridge ingest — duplicate → DUPLICATE_DROPPED
test('POST /api/bridge/ingest — duplicate packet is dropped', async () => {
  const packet = demoService.createPacket('alice@demo', 'bob@demo', 10, '1234', 3);

  const res1 = await request(app)
    .post('/api/bridge/ingest')
    .set('X-Bridge-Node-Id', 'bridge-a')
    .send(packet.toJSON());
  const res2 = await request(app)
    .post('/api/bridge/ingest')
    .set('X-Bridge-Node-Id', 'bridge-b')
    .send(packet.toJSON());

  expect(res1.body.outcome).not.toBe('DUPLICATE_DROPPED'); // first: processed
  expect(res2.body.outcome).toBe('DUPLICATE_DROPPED');      // second: duplicate
});

// 13. Tampered ciphertext → INVALID
test('POST /api/bridge/ingest — tampered ciphertext is rejected', async () => {
  const packet = demoService.createPacket('alice@demo', 'bob@demo', 50, '1234', 5);
  const chars = packet.ciphertext.split('');
  const mid = Math.floor(chars.length / 2);
  chars[mid] = chars[mid] === 'A' ? 'B' : 'A';
  packet.ciphertext = chars.join('');

  const res = await request(app)
    .post('/api/bridge/ingest')
    .set('X-Bridge-Node-Id', 'bridge-evil')
    .send(packet.toJSON());
  expect(res.status).toBe(200);
  expect(res.body.outcome).toBe('INVALID');
});

// 14. Missing ciphertext → 400
test('POST /api/bridge/ingest — missing ciphertext returns 400', async () => {
  const res = await request(app)
    .post('/api/bridge/ingest')
    .send({ packetId: 'xxx', ttl: 5, createdAt: Date.now() });
  expect(res.status).toBe(400);
});

// 15. Insufficient balance → REJECTED transaction recorded
test('POST /api/bridge/ingest — insufficient balance records REJECTED transaction', async () => {
  const packet = demoService.createPacket('dave@demo', 'alice@demo', 10000, '0000', 3);
  const res = await request(app)
    .post('/api/bridge/ingest')
    .set('X-Bridge-Node-Id', 'bridge-z')
    .send(packet.toJSON());

  expect(res.status).toBe(200);
  expect(res.body.outcome).toBe('SETTLED'); // packet was "processed" even if tx rejected

  const packetHash = cryptoService.hashCiphertext(packet.ciphertext);
  const tx = await Transaction.findOne({ packetHash });
  expect(tx).not.toBeNull();
  expect(tx.status).toBe('REJECTED');
});
