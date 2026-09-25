/**
 * MeshPacket — the over-the-wire format that hops phone-to-phone via Bluetooth.
 *
 * This is a plain JavaScript class, NOT a Mongoose model. Packets are never
 * persisted to MongoDB in this implementation (matching the Java original where
 * MeshPacket is also not a JPA entity). They live only in the in-memory mesh
 * simulator (meshService.js).
 *
 * Field contract (same as Java MeshPacket.java):
 *   - packetId   : UUID string — used by intermediates for gossip dedup
 *   - ttl        : integer — hops remaining; intermediates decrement per hop
 *   - createdAt  : epoch milliseconds — when sender created the packet
 *   - ciphertext : base64 string — RSA-encrypted AES key + AES-GCM payload
 *                  Intermediates CANNOT read this — it's encrypted with the server key.
 *
 * Security note (from Java source):
 *   A malicious intermediate could tamper with packetId/createdAt (outer fields).
 *   That's why the SERVER uses SHA-256(ciphertext) as the idempotency key, NOT packetId.
 *   The ciphertext is authenticated by AES-GCM; any tampering causes decryption to fail.
 */
class MeshPacket {
  constructor({ packetId, ttl, createdAt, ciphertext }) {
    if (!packetId) throw new Error('MeshPacket: packetId is required');
    if (typeof ttl !== 'number' || ttl < 0) throw new Error('MeshPacket: ttl must be >= 0');
    if (!createdAt) throw new Error('MeshPacket: createdAt is required');
    if (!ciphertext) throw new Error('MeshPacket: ciphertext is required');

    this.packetId = packetId;
    this.ttl = ttl;
    this.createdAt = createdAt;
    this.ciphertext = ciphertext;
  }

  /**
   * Create a copy with TTL decremented by 1 (used during gossip).
   */
  hopCopy() {
    return new MeshPacket({
      packetId: this.packetId,
      ttl: this.ttl - 1,
      createdAt: this.createdAt,
      ciphertext: this.ciphertext,
    });
  }

  toJSON() {
    return {
      packetId: this.packetId,
      ttl: this.ttl,
      createdAt: this.createdAt,
      ciphertext: this.ciphertext,
    };
  }
}

module.exports = MeshPacket;
