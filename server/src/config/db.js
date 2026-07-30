const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('[db] FATAL: MONGO_URI is not set in environment variables.');
  process.exit(1);
}

const connectDB = async () => {
  const MAX_RETRIES = 5;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      await mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      console.log(`[db] MongoDB connected — ${mongoose.connection.host}`);
      return;
    } catch (err) {
      attempt++;
      console.error(`[db] Connection attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt >= MAX_RETRIES) {
        console.error('[db] FATAL: Could not connect to MongoDB after maximum retries. Exiting.');
        process.exit(1);
      }
      // Exponential back-off (2s, 4s, 8s …)
      await new Promise(res => setTimeout(res, 2000 * attempt));
    }
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('[db] MongoDB disconnected — will attempt reconnect on next request.');
});

mongoose.connection.on('error', (err) => {
  console.error('[db] Mongoose connection error:', err.message);
});

module.exports = connectDB;
