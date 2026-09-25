import React, { useState } from 'react';
import { sendPayment, runGossip, flushBridges, resetMesh } from '../services/api';

/**
 * PaymentForm — the 3-step demo flow control panel.
 * Step 1: Compose & inject payment
 * Step 2: Run gossip round
 * Step 3: Flush bridges to backend
 *
 * Mirrors the controls section from dashboard.html.
 */
export default function PaymentForm({ accounts, onRefresh, onLog }) {
  const [senderVpa,   setSenderVpa]   = useState('alice@demo');
  const [receiverVpa, setReceiverVpa] = useState('bob@demo');
  const [amount,      setAmount]      = useState('500');
  const [pin,         setPin]         = useState('1234');
  const [ttl,         setTtl]         = useState(5);

  const [sendLoading,   setSendLoading]   = useState(false);
  const [gossipLoading, setGossipLoading] = useState(false);
  const [flushLoading,  setFlushLoading]  = useState(false);
  const [resetLoading,  setResetLoading]  = useState(false);

  const [sendResult,   setSendResult]   = useState(null);
  const [gossipResult, setGossipResult] = useState(null);
  const [flushResult,  setFlushResult]  = useState(null);

  const vpaOptions = accounts.length > 0
    ? accounts.map((a) => a.vpa)
    : ['alice@demo', 'bob@demo', 'carol@demo', 'dave@demo'];

  async function handleSend() {
    setSendLoading(true);
    setSendResult(null);
    try {
      const res = await sendPayment({
        senderVpa,
        receiverVpa,
        amount: parseFloat(amount),
        pin,
        ttl,
        startDevice: 'phone-alice',
      });
      setSendResult({ type: 'success', data: res });
      onLog(`📤 [SEND] Packet ${res.packetId.substring(0, 8)}… encrypted & injected at ${res.injectedAt} (TTL ${res.ttl})`);
      onLog(`   🔐 Ciphertext: ${res.ciphertextPreview}`);
      onRefresh();
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setSendResult({ type: 'error', data: msg });
      onLog(`❌ [SEND] Error: ${msg}`);
    } finally {
      setSendLoading(false);
    }
  }

  async function handleGossip() {
    setGossipLoading(true);
    setGossipResult(null);
    try {
      const res = await runGossip();
      setGossipResult(res);
      const counts = Object.entries(res.deviceCounts)
        .map(([d, c]) => `${d}:${c}`)
        .join(', ');
      onLog(`🔄 [GOSSIP] ${res.transfers} transfer(s) — ${counts}`);
      onRefresh();
    } catch (err) {
      onLog(`❌ [GOSSIP] Error: ${err.message}`);
    } finally {
      setGossipLoading(false);
    }
  }

  async function handleFlush() {
    setFlushLoading(true);
    setFlushResult(null);
    try {
      const res = await flushBridges();
      setFlushResult(res);
      onLog(`📡 [FLUSH] ${res.uploadsAttempted} upload(s) attempted:`);
      res.results.forEach((r) => {
        const emoji = r.outcome === 'SETTLED' ? '✅' :
                      r.outcome === 'DUPLICATE_DROPPED' ? '⚠️' : '❌';
        onLog(`   ${emoji} ${r.bridgeNode} pkt:${r.packetId} → ${r.outcome}${r.reason ? ` (${r.reason})` : ''}`);
      });
      onRefresh();
    } catch (err) {
      onLog(`❌ [FLUSH] Error: ${err.message}`);
    } finally {
      setFlushLoading(false);
    }
  }

  async function handleReset() {
    setResetLoading(true);
    setSendResult(null);
    setGossipResult(null);
    setFlushResult(null);
    try {
      await resetMesh();
      onLog(`🗑️  [RESET] Mesh cleared — all devices empty, idempotency cache cleared`);
      onRefresh();
    } catch (err) {
      onLog(`❌ [RESET] Error: ${err.message}`);
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-icon">🎬</span>
        <span className="card-title">Demo Flow</span>
        <span className="card-badge status-badge" style={{
          background: 'rgba(6,182,212,0.15)',
          color: 'var(--accent-cyan)',
          border: '1px solid rgba(6,182,212,0.3)',
        }}>
          3-step
        </span>
      </div>

      <div className="step-flow">

        {/* Step 1: Send */}
        <div className="step-item">
          <div className="step-num">1</div>
          <div className="step-content">
            <div className="step-title">Compose Payment (simulates sender phone)</div>
            <div className="form-row" style={{ marginTop: 10 }}>
              <div className="form-group">
                <label className="form-label">From</label>
                <select className="form-select" value={senderVpa} onChange={(e) => setSenderVpa(e.target.value)}>
                  {vpaOptions.map((v) => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">To</label>
                <select className="form-select" value={receiverVpa} onChange={(e) => setReceiverVpa(e.target.value)}>
                  {vpaOptions.map((v) => <option key={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input className="form-input" type="number" value={amount}
                  onChange={(e) => setAmount(e.target.value)} min="1" />
              </div>
              <div className="form-group">
                <label className="form-label">PIN</label>
                <input className="form-input" type="text" value={pin}
                  onChange={(e) => setPin(e.target.value)} maxLength={6} />
              </div>
              <div className="form-group">
                <label className="form-label">TTL (hops)</label>
                <input className="form-input" type="number" value={ttl}
                  onChange={(e) => setTtl(parseInt(e.target.value))} min="1" max="10" />
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleSend} disabled={sendLoading}>
              {sendLoading ? <><span className="spinner" /> Encrypting…</> : '📤 Inject into Mesh'}
            </button>
            {sendResult && (
              <div className={`result-flash result-${sendResult.type}`}>
                {sendResult.type === 'success' ? (
                  <>✓ Packet <strong>{sendResult.data.packetId?.substring(0, 8)}…</strong> injected at <strong>{sendResult.data.injectedAt}</strong></>
                ) : (
                  <>✗ {sendResult.data}</>
                )}
              </div>
            )}
            <div className="step-desc">
              Simulates a sender phone: builds PaymentInstruction, encrypts with RSA-OAEP + AES-256-GCM,
              wraps in a MeshPacket, drops it at phone-alice.
            </div>
          </div>
        </div>

        {/* Step 2: Gossip */}
        <div className="step-item">
          <div className="step-num">2</div>
          <div className="step-content">
            <div className="step-title">Gossip — packets hop device-to-device via Bluetooth</div>
            <button className="btn btn-ghost" onClick={handleGossip} disabled={gossipLoading}>
              {gossipLoading ? <><span className="spinner" /> Running…</> : '🔄 Run Gossip Round'}
            </button>
            {gossipResult && (
              <div className="result-flash result-success" style={{ marginTop: 8 }}>
                ✓ {gossipResult.transfers} transfer(s) — packets propagated across mesh
              </div>
            )}
            <div className="step-desc">
              One gossip round: every device shares its packets with every other device (TTL decremented per hop).
              Real Bluetooth would do this pair-by-pair when phones come into range.
            </div>
          </div>
        </div>

        {/* Step 3: Flush */}
        <div className="step-item">
          <div className="step-num">3</div>
          <div className="step-content">
            <div className="step-title">Bridge uploads to backend — "walks outside, gets 4G"</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-success" onClick={handleFlush} disabled={flushLoading}>
                {flushLoading ? <><span className="spinner" /> Uploading…</> : '📡 Bridges Upload to Backend'}
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleReset} disabled={resetLoading}>
                {resetLoading ? '…' : '🗑 Reset Mesh'}
              </button>
            </div>
            {flushResult && (
              <div className="flush-results">
                {flushResult.results.map((r, i) => {
                  const cls = r.outcome === 'SETTLED' ? 'status-SETTLED' :
                              r.outcome === 'DUPLICATE_DROPPED' ? 'status-DUPLICATE_DROPPED' : 'status-INVALID';
                  return (
                    <div key={i} className="flush-row">
                      <span className="flush-bridge">{r.bridgeNode}</span>
                      <span className="flush-packet">pkt:{r.packetId}</span>
                      <span className={`status-badge ${cls}`}>{r.outcome}</span>
                      {r.reason && <span className="text-muted">{r.reason}</span>}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="step-desc">
              All bridge devices simultaneously upload to /api/bridge/ingest — exercises
              concurrent idempotency protection. Even if 3 bridges hold the same packet,
              it settles exactly once.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
