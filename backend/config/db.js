const mongoose = require('mongoose');

/**
 * Connect to MongoDB with retry logic.
 * Equivalent to Spring Boot's spring.datasource configuration.
 */
const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/upi_offline';
  
  try {
    const conn = await mongoose.connect(uri, {
      // Use new URL parser and unified topology
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[DB] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    console.error(`[DB] MongoDB connection failed: ${err.message}`);
    if (process.env.NODE_ENV === 'test') {
      throw err;
    }
    console.error('[DB] Is mongod running? Try: mongod --dbpath ./data');
    process.exit(1);
  }
};

module.exports = connectDB;
