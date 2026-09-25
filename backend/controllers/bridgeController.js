const bridgeService = require('../services/bridgeService');
const MeshPacket = require('../models/MeshPacket');

/**
 * POST /api/bridge/ingest
 *
 * THE PRODUCTION ENDPOINT.
 * In a real deployment, the Android app's bridge logic POSTs here whenever
 * the device has internet and is holding mesh packets.
 *
 * Headers:
 *   X-Bridge-Node-Id  — identifier of the bridge device (default: "unknown")
 *   X-Hop-Count       — number of hops the packet travelled (default: 0)
 *
 * Body: { packetId, ttl, createdAt, ciphertext }
 *
 * Mirrors Java ApiController.ingest().
 */
async function ingest(req, res, next) {
  try {
    const { packetId, ttl, createdAt, ciphertext } = req.body;

    let packet;
    try {
      packet = new MeshPacket({
        packetId: packetId || 'unknown',
        ttl: typeof ttl === 'number' ? ttl : 0,
        createdAt: createdAt || Date.now(),
        ciphertext,
      });
    } catch (validationErr) {
      return res.status(400).json({
        success: false,
        message: validationErr.message,
      });
    }

    const bridgeNodeId = req.headers['x-bridge-node-id'] || 'unknown';
    const hopCount = parseInt(req.headers['x-hop-count'] || '0', 10);

    const result = await bridgeService.ingest(packet, bridgeNodeId, hopCount);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { ingest };
