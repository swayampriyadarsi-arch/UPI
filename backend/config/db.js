const mongoose = require('mongoose');

const dns = require('dns');

/**
 * Connect to MongoDB with retry logic and DNS fallback for Atlas SRV.
 * Equivalent to Spring Boot's spring.datasource configuration.
 */
const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/upi_offline';
  
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log(`[DB] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    if (uri.startsWith('mongodb+srv') && (err.message.includes('querySrv') || err.message.includes('ECONNREFUSED'))) {
      try {
        console.log('[DB] Retrying connection using public DNS (8.8.8.8)...');
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
        console.log(`[DB] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
        return;
      } catch (retryErr) {
        console.error(`[DB] MongoDB retry failed: ${retryErr.message}`);
      }
    }
    console.error(`[DB] MongoDB connection failed: ${err.message}`);
    if (process.env.NODE_ENV === 'test') {
      throw err;
    }
    console.error('[DB] Is mongod running or is the Atlas connection string correct?');
    process.exit(1);
  }
};

module.exports = connectDB;
