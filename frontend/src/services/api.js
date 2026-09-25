import axios from 'axios';

/**
 * Axios instance — all API calls go through here.
 * In dev, Vite forwards /api to backend.
 * In production, VITE_API_URL points to the deployed backend URL (e.g. https://your-backend.onrender.com/api).
 */
const defaultBackend = 'https://upi-mesh-backend.onrender.com';
const rawApiUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? defaultBackend : '/api');
const apiBase = rawApiUrl.replace(/\/+$/, '') + (rawApiUrl.endsWith('/api') ? '' : '/api');

const api = axios.create({
  baseURL: apiBase,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ── Accounts ──────────────────────────────────────────────────────────────────
export const getAccounts = () => 
  api.get('/accounts').then((r) => Array.isArray(r.data) ? r.data : []).catch(() => []);

// ── Transactions ──────────────────────────────────────────────────────────────
export const getTransactions = () => 
  api.get('/transactions').then((r) => Array.isArray(r.data) ? r.data : []).catch(() => []);

// ── Server Key ────────────────────────────────────────────────────────────────
export const getServerKey = () => api.get('/server-key').then((r) => r.data);

// ── Demo / Payment ────────────────────────────────────────────────────────────
export const sendPayment = (payload) =>
  api.post('/demo/send', payload).then((r) => r.data);

// ── Mesh ──────────────────────────────────────────────────────────────────────
export const getMeshState = () => 
  api.get('/mesh/state').then((r) => (r.data && typeof r.data === 'object' ? r.data : null)).catch(() => null);
export const runGossip    = () => api.post('/mesh/gossip').then((r) => r.data);
export const flushBridges = () => api.post('/mesh/flush').then((r) => r.data);
export const resetMesh    = () => api.post('/mesh/reset').then((r) => r.data);

// ── Bridge ────────────────────────────────────────────────────────────────────
export const ingestPacket = (packet, bridgeNodeId = 'manual', hopCount = 0) =>
  api
    .post('/bridge/ingest', packet, {
      headers: {
        'X-Bridge-Node-Id': bridgeNodeId,
        'X-Hop-Count': String(hopCount),
      },
    })
    .then((r) => r.data);

export default api;
