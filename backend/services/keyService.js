const crypto = require('crypto');

/**
 * ServerKeyHolder — holds the server's RSA-2048 keypair.
 *
 * Port of Java ServerKeyHolder.java.
 *
 * A fresh keypair is generated once when this module is first required.
 * In production, the private key would live in an HSM or KMS (AWS KMS,
 * HashiCorp Vault). NEVER commit a real private key to source.
 *
 * The public key is exposed via GET /api/server-key so that simulated
 * sender devices can use it to encrypt payloads before they go offline.
 */

let _keyPair = null;

function _ensureKey() {
  if (!_keyPair) {
    console.log('[KeyService] Generating RSA-2048 keypair...');
    _keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding:  { type: 'spki',  format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const preview = getPublicKeyBase64().substring(0, 32);
    console.log(`[KeyService] RSA keypair ready. Public key fingerprint: ${preview}...`);
  }
}

function getPublicKey() {
  _ensureKey();
  return _keyPair.publicKey;    // PEM string
}

function getPrivateKey() {
  _ensureKey();
  return _keyPair.privateKey;   // PEM string
}

/**
 * Returns the DER-encoded public key as base64 (SubjectPublicKeyInfo / SPKI format).
 * Compatible with Java's Base64.encode(keyPair.getPublic().getEncoded()) which also
 * encodes the X.509/SPKI form.
 */
function getPublicKeyBase64() {
  _ensureKey();
  // Strip PEM headers and whitespace to get raw base64 DER
  return _keyPair.publicKey
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s/g, '');
}

// Initialise immediately so the key is ready before the first request
_ensureKey();

module.exports = { getPublicKey, getPrivateKey, getPublicKeyBase64 };
