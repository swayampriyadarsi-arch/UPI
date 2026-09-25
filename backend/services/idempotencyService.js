/**
 * IdempotencyService — port of Java IdempotencyService.java.
 *
 * In-memory idempotency gate. In production this would be Redis SETNX + TTL
 * (exact same semantics, but distributed across multiple server instances).
 *
 * Contract:
 *   - claim(hash) returns true on the FIRST call for a given hash
 *   - claim(hash) returns false on every subsequent call (within TTL)
 *   - This operation is effectively atomic in Node.js because the event loop
 *     is single-threaded. Map.has() + Map.set() cannot be interleaved by
 *     another request — unlike Java where ConcurrentHashMap.putIfAbsent() was
 *     needed for thread-safety.
 *
 * Defense-in-depth: MongoDB's unique index on Transaction.packetHash catches
 * any duplicate that somehow gets past this cache (e.g. after a restart).
 */

const ttlSeconds = parseInt(process.env.IDEMPOTENCY_TTL_SECONDS || '86400', 10);

// Map<hash, timestamp-ms>
const seen = new Map();

/**
 * Try to claim a hash. Returns true if this is the first time we've seen it
 * (caller should proceed with processing). Returns false if it's a duplicate.
 */
function claim(packetHash) {
  if (seen.has(packetHash)) {
    return false;
  }
  seen.set(packetHash, Date.now());
  return true;
}

function size() {
  return seen.size;
}

/** Remove entries older than TTL. Run periodically so the map doesn't grow forever. */
function evictExpired() {
  const cutoff = Date.now() - ttlSeconds * 1000;
  for (const [hash, ts] of seen.entries()) {
    if (ts < cutoff) seen.delete(hash);
  }
}

/** Test/demo helper — clears the entire cache. */
function clear() {
  seen.clear();
}

// Evict every 60 seconds (matching Java's @Scheduled(fixedDelay = 60_000))
setInterval(evictExpired, 60_000).unref(); // .unref() so it doesn't block process exit in tests

module.exports = { claim, size, clear, evictExpired };
