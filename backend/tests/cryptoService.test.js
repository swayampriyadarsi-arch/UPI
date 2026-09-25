/**
 * cryptoService.test.js
 *
 * Port of Java:
 *   - IdempotencyConcurrencyTest.encryptDecryptRoundTrip
 *   - IdempotencyConcurrencyTest.tamperedCiphertextIsRejected
 */

const cryptoService = require('../services/cryptoService');
const keyService = require('../services/keyService');
const PaymentInstruction = require('../models/PaymentInstruction');

describe('CryptoService — Hybrid RSA-OAEP + AES-256-GCM', () => {

  const testInstruction = new PaymentInstruction({
    senderVpa: 'alice@demo',
    receiverVpa: 'bob@demo',
    amount: 123.45,
    pinHash: 'abcdef1234567890',
    nonce: 'test-nonce-1',
    signedAt: Date.now(),
  });

  test('encrypt → decrypt round-trip preserves all fields', () => {
    const publicKey = keyService.getPublicKey();
    const ciphertext = cryptoService.encrypt(testInstruction, publicKey);

    expect(typeof ciphertext).toBe('string');
    expect(ciphertext.length).toBeGreaterThan(300); // at least RSA(256) + IV(12) + tag(16) + payload

    const decrypted = cryptoService.decrypt(ciphertext);

    expect(decrypted.senderVpa).toBe(testInstruction.senderVpa);
    expect(decrypted.receiverVpa).toBe(testInstruction.receiverVpa);
    expect(parseFloat(decrypted.amount)).toBeCloseTo(testInstruction.amount, 2);
    expect(decrypted.nonce).toBe(testInstruction.nonce);
    expect(decrypted.pinHash).toBe(testInstruction.pinHash);
  });

  test('each encryption of the same plaintext produces a different ciphertext (random IV + AES key)', () => {
    const pk = keyService.getPublicKey();
    const ct1 = cryptoService.encrypt(testInstruction, pk);
    const ct2 = cryptoService.encrypt(testInstruction, pk);
    expect(ct1).not.toBe(ct2);
  });

  test('tampered ciphertext is rejected (AES-GCM auth tag fails)', () => {
    const pk = keyService.getPublicKey();
    const ct = cryptoService.encrypt(testInstruction, pk);

    // Flip a byte in the middle of the base64 string
    const chars = ct.split('');
    const mid = Math.floor(chars.length / 2);
    chars[mid] = chars[mid] === 'A' ? 'B' : 'A';
    const tampered = chars.join('');

    expect(() => cryptoService.decrypt(tampered)).toThrow();
  });

  test('ciphertext too short is rejected', () => {
    expect(() => cryptoService.decrypt(Buffer.alloc(10).toString('base64'))).toThrow(/too short/i);
  });

  test('hashCiphertext returns 64-character hex (SHA-256)', () => {
    const pk = keyService.getPublicKey();
    const ct = cryptoService.encrypt(testInstruction, pk);
    const hash = cryptoService.hashCiphertext(ct);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  test('same ciphertext always produces the same hash (deterministic)', () => {
    const pk = keyService.getPublicKey();
    const ct = cryptoService.encrypt(testInstruction, pk);
    expect(cryptoService.hashCiphertext(ct)).toBe(cryptoService.hashCiphertext(ct));
  });

  test('different ciphertexts produce different hashes', () => {
    const pk = keyService.getPublicKey();
    const ct1 = cryptoService.encrypt(testInstruction, pk);
    const ct2 = cryptoService.encrypt(testInstruction, pk);
    expect(cryptoService.hashCiphertext(ct1)).not.toBe(cryptoService.hashCiphertext(ct2));
  });
});
