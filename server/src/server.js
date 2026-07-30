require('dotenv').config();
const http = require('http');
const app  = require('./app');
const connectDB  = require('./config/db');
const { initSocket } = require('./config/socket');
const { initSocketHandler } = require('./sockets/socketHandler');
const { startCleanupJob } = require('./services/cleanupService');


const PORT = process.env.PORT || 5000;

/* ---- Create HTTP server and attach Socket.IO ---- */
const httpServer = http.createServer(app);
const io = initSocket(httpServer);
initSocketHandler(io);

/* ---- Boot sequence ---- */
const start = async () => {
  // 1. Connect to MongoDB (exits on failure after retries)
  await connectDB();

  // 2. Start scheduled jobs
  startCleanupJob();

  // 3. Start HTTP server
  httpServer.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║  CivicSense AI — Backend Server                  ║
╠══════════════════════════════════════════════════╣
║  HTTP   : http://localhost:${PORT}                   ║
║  Socket : ws://localhost:${PORT}                     ║
║                                                  ║
║  Citizen  → ${process.env.CLIENT_USER_URL    || 'http://localhost:3000'}   ║
║  Officer  → ${process.env.CLIENT_OFFICER_URL || 'http://localhost:5173'}   ║
╚══════════════════════════════════════════════════╝
    `);
  });
};

/* ---- Graceful shutdown ---- */
const shutdown = (signal) => {
  console.log(`\n[server] ${signal} received — shutting down gracefully…`);
  httpServer.close(() => {
    console.log('[server] HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

/* ---- Unhandled rejection guard ---- */
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled Promise Rejection:', reason);
  // Don't exit in dev — just log. In production, you may want to crash + restart.
});

start().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
