/**
 * start-mongo.js
 *
 * Starts a persistent MongoMemoryServer on port 27017 that survives
 * across backend restarts. Run this in a separate terminal BEFORE
 * starting the backend.
 *
 * Usage:  node start-mongo.js
 *
 * Once running, start the backend normally:
 *   npm run dev
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'mongo-persistent');
const PORT = 27017;

async function main() {
  console.log('🍃 Starting MongoDB Memory Server on port', PORT);
  console.log('   DB path:', DB_PATH);

  fs.mkdirSync(DB_PATH, { recursive: true });

  const mongod = await MongoMemoryServer.create({
    instance: {
      port: PORT,
      dbPath: DB_PATH,
      storageEngine: 'wiredTiger',
    },
    // persist data between starts
  });

  const uri = mongod.getUri();
  console.log('✅ MongoDB running at:', uri);
  console.log('   Connection string: mongodb://127.0.0.1:27017/upi_offline');
  console.log('\n   Press Ctrl+C to stop\n');

  process.on('SIGINT', async () => {
    console.log('\n🛑 Stopping MongoDB...');
    await mongod.stop({ doCleanup: false }); // keep data
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Failed to start MongoDB:', err);
  process.exit(1);
});
