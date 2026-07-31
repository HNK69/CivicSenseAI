require('dotenv').config();
const mongoose = require('mongoose');

async function cleanDatabase() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/civicsense';
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[cleanDatabase] Connected to MongoDB:', MONGO_URI);

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    for (const col of collections) {
      if (col.name === 'issues' || col.name === 'notifications' || col.name === 'workorders') {
        await db.collection(col.name).deleteMany({});
        console.log(`[cleanDatabase] Cleared collection: ${col.name}`);
      }
    }
    console.log('[cleanDatabase] Clean-up complete!');
  } catch (err) {
    console.error('[cleanDatabase] Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

cleanDatabase();
