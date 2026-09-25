import React from 'react';

/**
 * MeshNetwork — visualizes virtual devices and packet propagation.
 * Mirrors the "Mesh Devices" section from dashboard.html with enhanced visuals.
 */
export default function MeshNetwork({ meshState, loading }) {
  const devices = Array.isArray(meshState?.devices) ? meshState.devices : [];
  const cacheSize = meshState?.idempotencyCacheSize ?? 0;

  function deviceIcon(device) {
    if (device.hasInternet) return '🌐';
    if (device.packetCount > 0) return '📡';
    return '📱';
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-icon">🕸️</span>
        <span className="card-title">Mesh Network</span>
        <span className="card-badge status-badge" style={{
          background: 'rgba(139,92,246,0.15)',
          color: 'var(--accent-purple)',
          border: '1px solid rgba(139,92,246,0.3)',
        }}>
          {devices.length} devices
        </span>
      </div>

      {/* Topology flow diagram */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: '10px 0 16px',
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        flexWrap: 'wrap',
      }}>
        <span>📱 Sender</span>
        <span style={{ color: 'var(--border)' }}>──BLE──</span>
        <span>📱 Hop</span>
        <span style={{ color: 'var(--border)' }}>──BLE──</span>
        <span style={{ color: 'var(--accent-green)' }}>🌐 Bridge</span>
        <span style={{ color: 'var(--border)' }}>──4G──</span>
        <span style={{ color: 'var(--accent-blue)' }}>☁️ Backend</span>
        <span style={{ color: 'var(--border)' }}>──DB──</span>
        <span>💰 Settlement</span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton" style={{ height: 56 }} />
          ))}
        </div>
      ) : (
        <div className="device-grid">
          {devices.map((device) => (
            <div
              key={device.deviceId}
              className={`device-card ${device.hasInternet ? 'bridge' : ''}`}
            >
              <div className="device-header">
                <span className="device-icon">{deviceIcon(device)}</span>
                <span className="device-name">{device.deviceId}</span>
                <span className={`status-badge ${device.hasInternet ? 'status-online' : 'status-offline'}`}>
                  {device.hasInternet ? '4G' : 'OFFLINE'}
                </span>
                <span className="packet-count">{device.packetCount} pkt(s)</span>
              </div>
              {Array.isArray(device.packetIds) && device.packetIds.length > 0 && (
                <div className="device-packets">
                  {device.packetIds.map((id, i) => (
                    <span key={i} className="packet-chip">{id}…</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{
        marginTop: 12,
        padding: '8px 12px',
        background: 'var(--bg-deep)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        fontSize: '0.78rem',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span>🔒</span>
        <span>Idempotency cache: <strong style={{ color: 'var(--accent-blue)' }}>{cacheSize}</strong> hashes</span>
      </div>
    </div>
  );
}
