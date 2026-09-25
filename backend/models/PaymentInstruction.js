/**
 * PaymentInstruction — the decrypted payload inside a MeshPacket.
 *
 * This is a plain JavaScript class (NOT persisted). It is the result of
 * decrypting MeshPacket.ciphertext with the server's private RSA key.
 *
 * Mirrors Java PaymentInstruction.java exactly.
 *
 * Security-critical fields:
 *   - nonce    : UUID unique to this payment. Even if alice sends bob ₹100 twice,
 *                the nonces differ → different ciphertexts → different SHA-256 hashes.
 *   - signedAt : epoch ms. Lets the server reject stale packets (replay protection).
 *                Without this, a captured ciphertext could be replayed weeks later.
 *   - pinHash  : SHA-256 of the user's UPI PIN (not verified here, recorded for realism).
 */
class PaymentInstruction {
  constructor({ senderVpa, receiverVpa, amount, pinHash, nonce, signedAt }) {
    this.senderVpa = senderVpa;
    this.receiverVpa = receiverVpa;
    this.amount = amount;         // Number (will be converted to Decimal128 in settlement)
    this.pinHash = pinHash;       // SHA-256 hex of PIN
    this.nonce = nonce;           // UUID
    this.signedAt = signedAt;     // epoch milliseconds
  }
}

module.exports = PaymentInstruction;
