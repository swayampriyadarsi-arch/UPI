const cryptoService = require('./cryptoService');
const idempotencyService = require('./idempotencyService');
const settlementService = require('./settlementService');

/**
 * BridgeIngestionService — port of Java BridgeIngestionService.java.
 *
 * Orchestrates the full server-side pipeline for one inbound packet from a bridge node:
 *
 *   1. SHA-256 hash of the ciphertext (this is the idempotency key)
 *   2. Idempotency gate — claim(hash). If already claimed: duplicate, drop it.
 *   3. Decrypt with the server's RSA private key.
 *      If decryption fails: tampered or garbage. Reject.
 *   4. Freshness check — reject if signedAt is too old (replay protection).
 *      Also reject packets dated >5 minutes in the future (clock skew tolerance).
 *   5. Hand off to SettlementService for the atomic debit+credit.
 */

const maxAgeSeconds    = parseInt(process.env.PACKET_MAX_AGE_SECONDS   || '86400', 10);
const clockSkewSeconds = 300; // 5 minutes tolerance for future-dated packets

/**
 * @param {import('../models/MeshPacket')} packet
 * @param {string} bridgeNodeId
 * @param {number} hopCount
 * @returns {Promise<IngestResult>}
 */
async function ingest(packet, bridgeNodeId, hopCount) {
  let packetHash = '?';
  try {
    packetHash = cryptoService.hashCiphertext(packet.ciphertext);

    // ---- Idempotency gate ----
    if (!idempotencyService.claim(packetHash)) {
      console.log(
        `[Bridge] DUPLICATE packet ${packetHash.substring(0, 12)}... from ${bridgeNodeId} — dropped`
      );
      return { outcome: 'DUPLICATE_DROPPED', packetHash, reason: null, transactionId: null };
    }

    // ---- Decrypt ----
    let instruction;
    try {
      instruction = cryptoService.decrypt(packet.ciphertext);
    } catch (e) {
      console.warn(`[Bridge] Decryption failed for ${packetHash.substring(0, 12)}...: ${e.message}`);
      return { outcome: 'INVALID', packetHash, reason: 'decryption_failed', transactionId: null };
    }

    // ---- Freshness check ----
    const nowMs   = Date.now();
    const ageMs   = nowMs - instruction.signedAt;
    const ageSec  = ageMs / 1000;

    if (ageSec > maxAgeSeconds) {
      console.warn(`[Bridge] Packet ${packetHash.substring(0, 12)}... too old (${ageSec.toFixed(0)}s)`);
      return { outcome: 'INVALID', packetHash, reason: 'stale_packet', transactionId: null };
    }
    if (ageSec < -clockSkewSeconds) {
      console.warn(`[Bridge] Packet ${packetHash.substring(0, 12)}... future-dated`);
      return { outcome: 'INVALID', packetHash, reason: 'future_dated', transactionId: null };
    }

    // ---- Settle ----
    const tx = await settlementService.settle(instruction, packetHash, bridgeNodeId, hopCount);
    return {
      outcome: 'SETTLED',
      packetHash,
      reason: null,
      transactionId: tx._id ? tx._id.toString() : null,
      status: tx.status,
    };

  } catch (e) {
    console.error(`[Bridge] Ingestion error: ${e.message}`, e);
    return {
      outcome: 'INVALID',
      packetHash,
      reason: `internal_error: ${e.message}`,
      transactionId: null,
    };
  }
}

module.exports = { ingest };
