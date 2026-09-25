const meshService = require('../services/meshService');
const bridgeService = require('../services/bridgeService');
const idempotencyService = require('../services/idempotencyService');
const MeshPacket = require('../models/MeshPacket');

/**
 * GET /api/mesh/state
 * Returns the current state of all virtual devices.
 * Mirrors Java ApiController.meshState().
 */
function meshState(req, res, next) {
  try {
    const deviceData = meshService.getDevices().map((d) => d.toJSON());
    res.json({
      devices: deviceData,
      idempotencyCacheSize: idempotencyService.size(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/mesh/gossip
 * Runs one gossip round. Mirrors Java ApiController.meshGossip().
 */
function meshGossip(req, res, next) {
  try {
    const result = meshService.gossipOnce();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/mesh/flush
 * "All bridge nodes walk outside and get 4G."
 * Collects all packets from bridge devices and ingests them.
 * Runs ingestion concurrently (via Promise.all) to exercise the idempotency gate.
 * Mirrors Java ApiController.meshFlush() with parallelStream().
 */
async function meshFlush(req, res, next) {
  try {
    const uploads = meshService.collectBridgeUploads();

    // Run all ingestions concurrently — this is the "three bridges deliver simultaneously" test
    const results = await Promise.all(
      uploads.map(async (up) => {
        const hopCount = Math.max(0, 5 - up.packet.ttl);
        const r = await bridgeService.ingest(up.packet, up.bridgeNodeId, hopCount);
        return {
          bridgeNode: up.bridgeNodeId,
          packetId: up.packet.packetId.substring(0, 8),
          outcome: r.outcome,
          reason: r.reason || '',
          transactionId: r.transactionId || null,
          status: r.status || null,
        };
      })
    );

    res.json({
      uploadsAttempted: uploads.length,
      results,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/mesh/reset
 * Clears all device packet state and the idempotency cache.
 * Mirrors Java ApiController.meshReset().
 */
function meshReset(req, res, next) {
  try {
    meshService.resetMesh();
    idempotencyService.clear();
    res.json({ status: 'mesh and idempotency cache cleared' });
  } catch (err) {
    next(err);
  }
}

module.exports = { meshState, meshGossip, meshFlush, meshReset };
