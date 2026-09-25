const MeshPacket = require('../models/MeshPacket');
const VirtualDevice = require('./virtualDevice');

/**
 * MeshSimulatorService — port of Java MeshSimulatorService.java.
 *
 * Simulates the Bluetooth mesh. Each VirtualDevice is a phone.
 *
 * Default scenario: 4 offline phones in a basement, 1 with internet (bridge).
 *
 * Gossip protocol:
 *   Each round, every device that has packets with TTL > 0 shares them
 *   with every other device (if they don't already hold that packet).
 *   TTL is decremented per hop. This is equivalent to "fast-forward N rounds
 *   of pairwise BLE gossip" as noted in the Java source.
 *
 * When a bridge device (hasInternet=true) holds packets, the /api/mesh/flush
 * endpoint causes those packets to be submitted to /api/bridge/ingest —
 * simulating a phone walking outside and getting 4G.
 */

// Singleton state (in-memory, resets on process restart — intentional)
const devices = new Map();

function seedDefaultDevices() {
  devices.clear();
  devices.set('phone-alice',    new VirtualDevice('phone-alice',    false));
  devices.set('phone-stranger1', new VirtualDevice('phone-stranger1', false));
  devices.set('phone-stranger2', new VirtualDevice('phone-stranger2', false));
  devices.set('phone-stranger3', new VirtualDevice('phone-stranger3', false));
  devices.set('phone-bridge',   new VirtualDevice('phone-bridge',   true));
}

// Seed on module load
seedDefaultDevices();

function getDevices() {
  return Array.from(devices.values());
}

function getDevice(id) {
  return devices.get(id) || null;
}

/**
 * Inject a packet at a specific device (sender drops it into the mesh).
 */
function inject(senderDeviceId, packet) {
  const sender = devices.get(senderDeviceId);
  if (!sender) throw new Error(`Unknown device: ${senderDeviceId}`);
  sender.hold(packet);
  console.log(
    `[Mesh] Packet ${packet.packetId.substring(0, 8)} injected at ${senderDeviceId} (TTL=${packet.ttl})`
  );
}

/**
 * One round of gossip. All devices share all their packets with all other
 * devices (if the recipient doesn't already have the packet and TTL > 0).
 *
 * Returns { transfers: number, deviceCounts: { deviceId: packetCount } }
 */
function gossipOnce() {
  let transfers = 0;
  const deviceList = Array.from(devices.values());

  // Snapshot what each device holds at the start of this round so we don't
  // gossip the same packet through all 5 devices in a single step.
  const snapshot = new Map();
  for (const d of deviceList) {
    snapshot.set(d.deviceId, [...d.getHeldPackets()]);
  }

  for (const src of deviceList) {
    for (const pkt of snapshot.get(src.deviceId)) {
      if (pkt.ttl <= 0) continue;
      for (const dst of deviceList) {
        if (dst === src) continue;
        if (dst.holds(pkt.packetId)) continue;
        // Create a hop copy with TTL - 1
        dst.hold(new MeshPacket({
          packetId: pkt.packetId,
          ttl: pkt.ttl - 1,
          createdAt: pkt.createdAt,
          ciphertext: pkt.ciphertext,
        }));
        transfers++;
      }
    }
  }

  console.log(`[Mesh] Gossip round complete: ${transfers} packet transfer(s)`);
  return { transfers, deviceCounts: snapshotMap() };
}

/**
 * Returns a { deviceId: packetCount } map for the dashboard.
 */
function snapshotMap() {
  const m = {};
  for (const d of devices.values()) {
    m[d.deviceId] = d.packetCount();
  }
  return m;
}

/**
 * Returns all packets held by internet-connected (bridge) devices.
 * These are what would be uploaded to the backend when the phone gets 4G.
 */
function collectBridgeUploads() {
  const out = [];
  for (const d of devices.values()) {
    if (!d.hasInternet) continue;
    for (const pkt of d.getHeldPackets()) {
      out.push({ bridgeNodeId: d.deviceId, packet: pkt });
    }
  }
  return out;
}

/**
 * Clear all packet state from every device (used by /api/mesh/reset).
 */
function resetMesh() {
  for (const d of devices.values()) {
    d.clear();
  }
}

module.exports = {
  getDevices,
  getDevice,
  inject,
  gossipOnce,
  snapshotMap,
  collectBridgeUploads,
  resetMesh,
  seedDefaultDevices,
};
