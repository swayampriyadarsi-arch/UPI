require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const demoService = require('./services/demoService');

const PORT = parseInt(process.env.PORT || '5000', 10);

async function start() {
  // 1. Connect to MongoDB
  await connectDB();

  // 2. Seed demo accounts (no-op if already seeded)
  await demoService.seedAccounts();

  // 3. Start HTTP server
  const http = require('http');
  const server = http.createServer(app);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌  Port ${PORT} is already in use.`);
      console.error(`    Another backend process is running. Kill it first:`);
      console.error(`    npx kill-port ${PORT}   OR   taskkill /F /IM node.exe\n`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });

  server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║   UPI Offline Mesh — MERN Backend                 ║
║   Listening on http://localhost:${PORT}               ║
║                                                   ║
║   API:                                            ║
║   GET  /api/accounts                              ║
║   GET  /api/transactions                          ║
║   GET  /api/server-key                            ║
║   GET  /api/mesh/state                            ║
║   POST /api/demo/send                             ║
║   POST /api/mesh/gossip                           ║
║   POST /api/mesh/flush                            ║
║   POST /api/mesh/reset                            ║
║   POST /api/bridge/ingest                         ║
╚═══════════════════════════════════════════════════╝
    `);
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
