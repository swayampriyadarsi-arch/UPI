const crypto = require('crypto');
const PaymentInstruction = require('../models/PaymentInstruction');
const keyService = require('./keyService');

/**
 * HybridCryptoService — port of Java HybridCryptoService.java.
 *
 * Hybrid encryption: RSA-OAEP encrypts a one-time AES-256-GCM session key.
 * AES-GCM encrypts the actual payload (PaymentInstruction JSON).
 *
 * Wire format (after base64 encoding):
 *   [ 256 bytes RSA-encrypted AES key ][ 12 bytes GCM IV ][ AES-GCM ciphertext + 16-byte tag ]
 *
 * This is IDENTICAL to the Java implementation. A packet created by this Node.js
 * service can be decrypted by the Java version and vice-versa, provided they share
 * the same RSA keypair.
 *
 * Crypto note:
 *   Node.js crypto.publicEncrypt with oaepHash:'sha256' uses RSA-OAEP with SHA-256
 *   for both the hash and MGF1 mask generation function — identical to Java's
 *   OAEPParameterSpec("SHA-256","MGF1",MGF1ParameterSpec.SHA256,...).
 */

const RSA_ENCRYPTED_KEY_BYTES = 256;   // 2048-bit RSA → 256-byte output
const AES_KEY_BITS             = 256;
const GCM_IV_BYTES             = 12;
const GCM_TAG_BYTES            = 16;   // 128-bit tag
const GCM_TAG_BITS             = 128;

/**
 * Encrypt a PaymentInstruction with a given RSA public key (PEM string).
 * Returns a base64-encoded ciphertext string.
 *
 * Flow:
 *   1. JSON-serialize the instruction
 *   2. Generate a random 256-bit AES key
 *   3. AES-256-GCM encrypt the JSON (random 12-byte IV)
 *   4. RSA-OAEP-SHA256 encrypt the AES key with the server's public key
 *   5. Concatenate [enc-AES-key][IV][GCM-ciphertext+tag] → base64
 */
function encrypt(instruction, publicKeyPem) {
  const plaintext = Buffer.from(JSON.stringify(instruction), 'utf8');

  // Step 2: random AES-256 key
  const aesKey = crypto.randomBytes(AES_KEY_BITS / 8);

  // Step 3: AES-256-GCM encrypt
  const iv = crypto.randomBytes(GCM_IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();                // 16 bytes
  const aesCiphertext = Buffer.concat([encrypted, tag]);

  // Step 4: RSA-OAEP-SHA256 encrypt the AES key
  const encryptedAesKey = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    aesKey
  );

  if (encryptedAesKey.length !== RSA_ENCRYPTED_KEY_BYTES) {
    throw new Error(`Unexpected RSA output length: ${encryptedAesKey.length}`);
  }

  // Step 5: pack and base64-encode
  const packed = Buffer.concat([encryptedAesKey, iv, aesCiphertext]);
  return packed.toString('base64');
}

/**
 * Decrypt a base64 ciphertext using the server's RSA private key.
 * Returns a PaymentInstruction object.
 *
 * Throws if:
 *   - Input is too short
 *   - RSA decryption fails (wrong key, corrupted)
 *   - AES-GCM tag verification fails (any bit-flip in the ciphertext)
 *   - JSON parsing fails
 */
function decrypt(base64Ciphertext) {
  const all = Buffer.from(base64Ciphertext, 'base64');

  const minLength = RSA_ENCRYPTED_KEY_BYTES + GCM_IV_BYTES + GCM_TAG_BYTES;
  if (all.length < minLength) {
    throw new Error(`Ciphertext too short: ${all.length} < ${minLength}`);
  }

  // Unpack
  const encryptedAesKey = all.slice(0, RSA_ENCRYPTED_KEY_BYTES);
  const iv              = all.slice(RSA_ENCRYPTED_KEY_BYTES, RSA_ENCRYPTED_KEY_BYTES + GCM_IV_BYTES);
  const aesCiphertext   = all.slice(RSA_ENCRYPTED_KEY_BYTES + GCM_IV_BYTES);

  // Extract GCM tag from end of aesCiphertext
  const tag             = aesCiphertext.slice(aesCiphertext.length - GCM_TAG_BYTES);
  const ciphertextOnly  = aesCiphertext.slice(0, aesCiphertext.length - GCM_TAG_BYTES);

  // Step 1: RSA-OAEP-SHA256 decrypt the AES key
  const aesKey = crypto.privateDecrypt(
    {
      key: keyService.getPrivateKey(),
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    encryptedAesKey
  );

  // Step 2: AES-256-GCM decrypt + tag verification
  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
  decipher.setAuthTag(tag);
  decipher.setAutoPadding(false);

  let plaintext;
  try {
    plaintext = Buffer.concat([decipher.update(ciphertextOnly), decipher.final()]);
  } catch (err) {
    throw new Error(`AES-GCM authentication failed: ${err.message}`);
  }

  const obj = JSON.parse(plaintext.toString('utf8'));
  return new PaymentInstruction(obj);
}

/**
 * SHA-256 of the ciphertext string. THIS is the idempotency key.
 *
 * Why ciphertext and not packetId?
 * Intermediates can rewrite packetId (it's an outer unprotected field).
 * The ciphertext is RSA+AES-GCM authenticated — any tampering causes
 * decryption to fail. Two copies of the same original packet have identical
 * ciphertexts, hence identical SHA-256 hashes.
 */
function hashCiphertext(base64Ciphertext) {
  return crypto
    .createHash('sha256')
    .update(base64Ciphertext, 'utf8')
    .digest('hex');
}

module.exports = { encrypt, decrypt, hashCiphertext };
