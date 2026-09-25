import React from 'react';

/**
 * AccountList — shows all accounts with balances.
 * Mirrors the "Account Balances" table from the Java dashboard.html.
 */
export default function AccountList({ accounts = [], loading }) {
  const safeAccounts = Array.isArray(accounts) ? accounts : [];

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-icon">🏦</span>
        <span className="card-title">Account Balances</span>
        <span className="card-badge status-badge status-online">
          {safeAccounts.length} accounts
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 40 }} />
          ))}
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>VPA</th>
              <th>Holder</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {safeAccounts.map((a) => (
              <tr key={a.vpa}>
                <td className="mono">{a.vpa}</td>
                <td>{a.holderName}</td>
                <td className="balance">₹{Number(a.balance).toFixed(2)}</td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                  No accounts found. Is the backend running?
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
