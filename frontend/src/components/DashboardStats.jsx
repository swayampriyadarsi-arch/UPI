import React from 'react';

/**
 * DashboardStats — summary KPI cards at the top of the dashboard.
 * Shows accounts, total balance, transactions, mesh devices, and idempotency cache.
 */
export default function DashboardStats({ accounts = [], transactions = [], meshState }) {
  const safeAccounts = Array.isArray(accounts) ? accounts : [];
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const safeDevices = Array.isArray(meshState?.devices) ? meshState.devices : [];

  const totalBalance = safeAccounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const settledCount = safeTransactions.filter((t) => t.status === 'SETTLED').length;
  const cacheSize    = meshState?.idempotencyCacheSize ?? 0;
  const onlineDevices = safeDevices.filter((d) => d.hasInternet).length;

  return (
    <div className="dashboard-grid-3">
      <div className="stat-card blue">
        <span className="stat-icon">🏦</span>
        <div className="stat-label">Accounts</div>
        <div className="stat-value blue">{safeAccounts.length}</div>
        <div className="stat-sub">₹{totalBalance.toFixed(2)} total balance</div>
      </div>

      <div className="stat-card green">
        <span className="stat-icon">✅</span>
        <div className="stat-label">Settled Txns</div>
        <div className="stat-value green">{settledCount}</div>
        <div className="stat-sub">of {transactions.length} recent</div>
      </div>

      <div className="stat-card cyan">
        <span className="stat-icon">📡</span>
        <div className="stat-label">Mesh Devices</div>
        <div className="stat-value cyan">{meshState?.devices?.length ?? 0}</div>
        <div className="stat-sub">{onlineDevices} with internet (bridge)</div>
      </div>

      <div className="stat-card purple">
        <span className="stat-icon">🔑</span>
        <div className="stat-label">Idempotency Cache</div>
        <div className="stat-value purple">{cacheSize}</div>
        <div className="stat-sub">hashes remembered (24h TTL)</div>
      </div>

      <div className="stat-card amber">
        <span className="stat-icon">📦</span>
        <div className="stat-label">Packets in Mesh</div>
        <div className="stat-value amber">
          {safeDevices.reduce((s, d) => s + (Number(d.packetCount) || 0), 0)}
        </div>
        <div className="stat-sub">across all virtual devices</div>
      </div>

      <div className="stat-card blue">
        <span className="stat-icon">🔐</span>
        <div className="stat-label">Encryption</div>
        <div className="stat-value blue" style={{ fontSize: '0.9rem', marginTop: 4 }}>
          RSA+AES
        </div>
        <div className="stat-sub">RSA-2048 OAEP + AES-256-GCM</div>
      </div>
    </div>
  );
}
