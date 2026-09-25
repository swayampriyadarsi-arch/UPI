import React from 'react';

/**
 * TransactionList — shows the last 20 transactions.
 * Mirrors the "Transaction Ledger" table from dashboard.html.
 */
export default function TransactionList({ transactions = [], loading }) {
  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  function formatTime(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleTimeString();
  }

  return (
    <div className="card full-width">
      <div className="card-header">
        <span className="card-icon">📜</span>
        <span className="card-title">Transaction Ledger</span>
        <span className="card-badge status-badge" style={{
          background: 'rgba(59,130,246,0.15)',
          color: 'var(--accent-blue)',
          border: '1px solid rgba(59,130,246,0.3)',
        }}>
          last 20
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 44 }} />)}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>From</th>
                <th>To</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Bridge</th>
                <th>Hops</th>
                <th>Settled At</th>
                <th>Packet Hash</th>
              </tr>
            </thead>
            <tbody>
              {safeTransactions.map((t, idx) => (
                <tr key={t.id}>
                  <td className="text-muted mono">{idx + 1}</td>
                  <td className="mono" style={{ color: 'var(--accent-cyan)' }}>{t.senderVpa}</td>
                  <td className="mono" style={{ color: 'var(--accent-purple)' }}>{t.receiverVpa}</td>
                  <td className="balance">₹{Number(t.amount).toFixed(2)}</td>
                  <td>
                    <span className={`status-badge status-${t.status}`}>
                      {t.status === 'SETTLED' ? '✓' : '✗'} {t.status}
                    </span>
                  </td>
                  <td className="mono text-muted">{t.bridgeNodeId}</td>
                  <td className="text-muted">{t.hopCount}</td>
                  <td className="text-muted">{formatTime(t.settledAt)}</td>
                  <td className="mono text-muted" style={{ fontSize: '0.68rem' }}>
                    {t.packetHash ? t.packetHash.substring(0, 12) + '…' : '—'}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                    No transactions yet — send a payment and flush the bridges!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
