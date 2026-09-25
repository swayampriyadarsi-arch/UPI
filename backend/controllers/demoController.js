const demoService = require('../services/demoService');
const meshService = require('../services/meshService');
const keyService = require('../services/keyService');

/**
 * GET /api/server-key
 * Returns the server's RSA public key so simulated sender devices can encrypt.
 * Mirrors Java ApiController.getServerPublicKey().
 */
function getServerPublicKey(req, res, next) {
  try {
    res.json({
      publicKey: keyService.getPublicKeyBase64(),
      algorithm: 'RSA-2048 / OAEP-SHA256',
      hybridScheme: 'RSA-OAEP encrypts an AES-256-GCM session key',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/demo/send
 *
 * Demo helper: simulates a sender phone creating an encrypted packet
 * and injecting it into the mesh at the specified device.
 *
 * Body: { senderVpa, receiverVpa, amount, pin, ttl?, startDevice? }
 *
 * Mirrors Java ApiController.demoSend().
 */
function demoSend(req, res, next) {
  try {
    const { senderVpa, receiverVpa, amount, pin, ttl, startDevice } = req.body;

    if (!senderVpa || !receiverVpa || !amount || !pin) {
      return res.status(400).json({
        success: false,
        message: 'senderVpa, receiverVpa, amount, and pin are required',
      });
    }

    const resolvedTtl = typeof ttl === 'number' ? ttl : 5;
    const resolvedDevice = startDevice || 'phone-alice';

    const packet = demoService.createPacket(
      senderVpa,
      receiverVpa,
      parseFloat(amount),
      pin,
      resolvedTtl
    );

    meshService.inject(resolvedDevice, packet);

    res.json({
      packetId: packet.packetId,
      ciphertextPreview: packet.ciphertext.substring(0, 64) + '...',
      ttl: packet.ttl,
      injectedAt: resolvedDevice,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getServerPublicKey, demoSend };
