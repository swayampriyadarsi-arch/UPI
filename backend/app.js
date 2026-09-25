require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const accountRoutes     = require('./routes/accountRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const meshRoutes        = require('./routes/meshRoutes');
const bridgeRoutes      = require('./routes/bridgeRoutes');
const demoRoutes        = require('./routes/demoRoutes');
const errorHandler      = require('./middleware/errorHandler');

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow React frontend (Vite dev server) and any configured origin
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    // Or if origin is in allowed list, or if FRONTEND_URL is set to '*'
    if (!origin || allowedOrigins.includes(origin) || process.env.FRONTEND_URL === '*' || allowedOrigins.length === 0) {
      return cb(null, true);
    }
    // Also allow any vercel preview domains if needed
    if (origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com')) {
      return cb(null, true);
    }
    cb(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Bridge-Node-Id', 'X-Hop-Count'],
}));

// ── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Body Parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/accounts',     accountRoutes);
app.use('/api/transactions',  transactionRoutes);
app.use('/api/mesh',         meshRoutes);
app.use('/api/bridge',       bridgeRoutes);
app.use('/api/demo',         demoRoutes);

// Backward-compat: /api/server-key is mounted under /api/demo in demoRoutes
// but the original Java API exposed it directly at /api/server-key
// We re-expose it here for compatibility:
const { getServerPublicKey } = require('./controllers/demoController');
app.get('/api/server-key', getServerPublicKey);

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
});

// ── Centralized Error Handler ─────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
