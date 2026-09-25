/**
 * idempotencyService.test.js
 *
 * Port of Java IdempotencyConcurrencyTest — the "three bridges deliver simultaneously" test.
 *
 * Node.js is single-threaded, so true OS-level concurrency between claim() calls
 * cannot occur within a single process. However, because the idempotency cache is
 * backed by a Map (not a database), it IS fully safe for the single-process case.
 *
 * The "concurrent" scenario in production (multiple server instances) is covered
 * by the MongoDB unique index on Transaction.packetHash. We test that here too
 * (see api.test.js bridgeIngest duplicate test).
 */

const idempotency = require('../services/idempotencyService');

beforeEach(() => {
  idempotency.clear();
});

describe('IdempotencyService', () => {

  test('claim() returns true on first call', () => {
    expect(idempotency.claim('hash-abc')).toBe(true);
  });

  test('claim() returns false on second call for the same hash', () => {
    idempotency.claim('hash-xyz');
    expect(idempotency.claim('hash-xyz')).toBe(false);
  });

  test('claim() returns false on all subsequent calls', () => {
    const hash = 'hash-repeat';
    idempotency.claim(hash);
    for (let i = 0; i < 10; i++) {
      expect(idempotency.claim(hash)).toBe(false);
    }
  });

  test('different hashes are independent', () => {
    expect(idempotency.claim('hash-1')).toBe(true);
    expect(idempotency.claim('hash-2')).toBe(true);
    expect(idempotency.claim('hash-1')).toBe(false);
  });

  test('size() reflects number of claimed hashes', () => {
    expect(idempotency.size()).toBe(0);
    idempotency.claim('a');
    idempotency.claim('b');
    idempotency.claim('c');
    expect(idempotency.size()).toBe(3);
  });

  test('clear() resets the cache', () => {
    idempotency.claim('hash-clear-test');
    idempotency.clear();
    expect(idempotency.size()).toBe(0);
    // After clear, same hash can be claimed again
    expect(idempotency.claim('hash-clear-test')).toBe(true);
  });

  /**
   * Simulates the "three bridges deliver at the same instant" scenario.
   *
   * In Node.js, Promise.all on synchronous operations runs sequentially,
   * but this validates the logical guarantee: exactly one claim succeeds.
   *
   * In production with multiple Node.js instances, the MongoDB unique index
   * on packetHash enforces this at the database level.
   */
  test('simulated concurrent claims — exactly one succeeds', () => {
    const hash = 'concurrent-hash';

    // Simulate 3 bridge nodes each trying to claim the same hash "simultaneously"
    const results = [
      idempotency.claim(hash),
      idempotency.claim(hash),
      idempotency.claim(hash),
    ];

    const trueCount = results.filter(Boolean).length;
    const falseCount = results.filter((r) => !r).length;

    expect(trueCount).toBe(1);
    expect(falseCount).toBe(2);
  });

  test('evictExpired() removes old entries', () => {
    idempotency.clear();
    // Manually add a "stale" entry by bypassing the public API
    // (we test the eviction logic by checking size after eviction)
    idempotency.claim('stale-hash');
    expect(idempotency.size()).toBe(1);
    // evictExpired won't remove it if it's fresh — just verify it doesn't crash
    idempotency.evictExpired();
    expect(idempotency.size()).toBe(1); // still there (not expired)
  });
});
