const MeshPacket = require('../models/MeshPacket');

/**
 * VirtualDevice — a simulated phone in the Bluetooth mesh.
 *
 * Port of Java VirtualDevice.java.
 *
 * Holds a Map of packets it has seen (keyed by packetId).
 * hold() uses the same "putIfAbsent" semantics as the Java version —
 * a packet we've already seen is silently ignored.
 */
class VirtualDevice {
  constructor(deviceId, hasInternet) {
    this.deviceId = deviceId;
    this.hasInternet = hasInternet;
    this._heldPackets = new Map(); // packetId → MeshPacket
  }

  hold(packet) {
    // putIfAbsent — ignore if we already have this packet
    if (!this._heldPackets.has(packet.packetId)) {
      this._heldPackets.set(packet.packetId, packet);
    }
  }

  holds(packetId) {
    return this._heldPackets.has(packetId);
  }

  getHeldPackets() {
    return Array.from(this._heldPackets.values());
  }

  packetCount() {
    return this._heldPackets.size;
  }

  clear() {
    this._heldPackets.clear();
  }

  toJSON() {
    return {
      deviceId: this.deviceId,
      hasInternet: this.hasInternet,
      packetCount: this.packetCount(),
      packetIds: this.getHeldPackets().map((p) => p.packetId.substring(0, 8)),
    };
  }
}

module.exports = VirtualDevice;
