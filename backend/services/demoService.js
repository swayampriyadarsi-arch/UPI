const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const Account = require('../models/Account');
const MeshPacket = require('../models/MeshPacket');
const PaymentInstruction = require('../models/PaymentInstruction');
const cryptoService = require('./cryptoService');
const keyService = require('./keyService');

/**
 * DemoService — port of Java DemoService.java.
 *
 * Two responsibilities:
 *   1. Seed demo accounts on startup (alice, bob, carol, dave)
 *   2. Simulate a sender phone creating an encrypted packet
 *      (in production this code runs on the Android device, not the server)
 */

/**
 * Seed 4 demo accounts if the collection is empty.
 * Mirrors Java's @PostConstruct seedAccounts().
 */
async function seedAccounts() {
  const count = await Account.countDocuments();
  if (count === 0) {
    await Account.insertMany([
      { _id: 'alice@demo', holderName: 'Alice',  balance: mongoose.Types.Decimal128.fromString('5000.00') },
      { _id: 'bob@demo',   holderName: 'Bob',    balance: mongoose.Types.Decimal128.fromString('1000.00') },
      { _id: 'carol@demo', holderName: 'Carol',  balance: mongoose.Types.Decimal128.fromString('2500.00') },
      { _id: 'dave@demo',  holderName: 'Dave',   balance: mongoose.Types.Decimal128.fromString('500.00')  },
    ]);
    console.log('[Demo] Seeded 4 demo accounts (alice, bob, carol, dave)');
  }
}

/**
 * Simulate the sender's phone creating an encrypted mesh packet.
 *
 * Steps (identical to Java):
 *   1. Build a PaymentInstruction with a fresh nonce + current timestamp.
 *   2. Encrypt with the server's public key (hybrid RSA+AES-GCM).
 *   3. Wrap in a MeshPacket with the given TTL.
 *
 * @param {string} senderVpa
 * @param {string} receiverVpa
 * @param {number} amount
 * @param {string} pin
 * @param {number} ttl
 * @returns {MeshPacket}
 */
function createPacket(senderVpa, receiverVpa, amount, pin, ttl = 5) {
  const instruction = new PaymentInstruction({
    senderVpa,
    receiverVpa,
    amount,
    pinHash: sha256Hex(pin),
    nonce: uuidv4(),            // guarantees uniqueness even for identical payment params
    signedAt: Date.now(),       // epoch ms — used for freshness check on server
  });

  const ciphertext = cryptoService.encrypt(instruction, keyService.getPublicKey());

  return new MeshPacket({
    packetId: uuidv4(),
    ttl,
    createdAt: Date.now(),
    ciphertext,
  });
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

module.exports = { seedAccounts, createPacket };
