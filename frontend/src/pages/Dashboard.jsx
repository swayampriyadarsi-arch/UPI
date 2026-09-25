import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getAccounts, getTransactions, getMeshState } from '../services/api';
import DashboardStats from '../components/DashboardStats';
import AccountList from '../components/AccountList';
import TransactionList from '../components/TransactionList';
import MeshNetwork from '../components/MeshNetwork';
import PaymentForm from '../components/PaymentForm';

/**
 * Dashboard page — composes all components.
 * Auto-refreshes every 3 seconds (matching the Java dashboard setInterval(refresh, 3000)).
 */
export default function Dashboard() {
  const [accounts,     setAccounts]     = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [meshState,    setMeshState]    = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [logs,         setLogs]         = useState([]);
  const logRef = useRef(null);

  const addLog = useCallback((msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev].slice(0, 100));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [accs, txs, mesh] = await Promise.all([
        getAccounts(),
        getTransactions(),
        getMeshState(),
      ]);
      setAccounts(Array.isArray(accs) ? accs : []);
      setTransactions(Array.isArray(txs) ? txs : []);
      setMeshState(mesh && typeof mesh === 'object' ? mesh : null);
    } catch (err) {
      console.error('Refresh error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + 3s auto-refresh
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <>
      {/* Hero Header */}
      <header className="hero">
        <div className="hero-inner">
          <span className="hero-icon">📡</span>
          <div>
            <div className="hero-title">UPI Offline Mesh</div>
            <div className="hero-subtitle">
              Send money in a basement with zero internet — encrypted packets gossip phone-to-phone via Bluetooth
            </div>
          </div>
          <div className="hero-badge">
            <div className="pulse-dot" />
            LIVE DEMO
          </div>
        </div>
      </header>

      <div className="app-container">

        {/* KPI Stats Row */}
        <DashboardStats
          accounts={accounts}
          transactions={transactions}
          meshState={meshState}
        />

        {/* Main Grid: Form + Mesh side by side */}
        <div className="dashboard-grid" style={{ marginBottom: 20 }}>
          <PaymentForm
            accounts={accounts}
            onRefresh={refresh}
            onLog={addLog}
          />
          <MeshNetwork meshState={meshState} loading={loading} />
        </div>

        {/* Accounts + Activity Log side by side */}
        <div className="dashboard-grid" style={{ marginBottom: 20 }}>
          <AccountList accounts={accounts} loading={loading} />

          {/* Activity Log */}
          <div className="card">
            <div className="card-header">
              <span className="card-icon">🪵</span>
              <span className="card-title">Activity Log</span>
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginLeft: 'auto' }}
                onClick={() => setLogs([])}
              >
                Clear
              </button>
            </div>
            <div className="activity-log" ref={logRef}>
              {logs.length === 0 ? (
                <span style={{ color: 'var(--text-muted)' }}>
                  No activity yet. Use the demo flow to the left →
                </span>
              ) : (
                logs.map((line, i) => {
                  const cls = line.includes('SETTLED') ? 'log-SETTLED' :
                              line.includes('DUPLICATE') ? 'log-DUPLICATE' :
                              line.includes('INVALID') || line.includes('❌') ? 'log-INVALID' :
                              line.includes('GOSSIP') ? 'log-GOSSIP' : 'log-INFO';
                  return (
                    <div key={i} className={`log-entry ${cls}`}>{line}</div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Full-width Transaction Ledger */}
        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>
          <TransactionList transactions={transactions} loading={loading} />
        </div>

        {/* Encryption Info */}
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <span className="card-icon">🔐</span>
            <span className="card-title">Encryption Architecture</span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}>
            {[
              {
                icon: '🔑',
                title: 'RSA-2048 OAEP',
                desc: 'Server\'s public key encrypts a one-time AES session key. Generated fresh on every startup.',
              },
              {
                icon: '🔒',
                title: 'AES-256-GCM',
                desc: 'Authenticated encryption for the payment payload. Any bit-flip fails the GCM tag check.',
              },
              {
                icon: '📦',
                title: 'Wire Format',
                desc: '[256B RSA-enc AES key][12B IV][AES-GCM ciphertext+tag] → base64',
              },
              {
                icon: '#️⃣',
                title: 'Idempotency Key',
                desc: 'SHA-256(ciphertext). Intermediates can\'t forge it. Prevents double-settlement.',
              },
              {
                icon: '🕐',
                title: 'Replay Protection',
                desc: 'signedAt field checked on server. Packets older than 24h or >5min in future are rejected.',
              },
              {
                icon: '🤝',
                title: 'Hybrid Encryption',
                desc: 'Same pattern as TLS, PGP, Signal. RSA handles key exchange; AES handles bulk data.',
              },
            ].map((item) => (
              <div key={item.title} style={{
                padding: 14,
                background: 'var(--bg-card-2)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>{item.icon}</div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
