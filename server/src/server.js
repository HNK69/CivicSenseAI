const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const http = require('http');
const app  = require('./app');
const connectDB  = require('./config/db');
const { initSocket } = require('./config/socket');
const { initSocketHandler } = require('./sockets/socketHandler');
const { startCleanupJob } = require('./services/cleanupService');
const { startMonitor: startAIMonitor } = require('./services/aiHealthMonitor');


const PORT = process.env.PORT || 5000;

/* ---- Create HTTP server and attach Socket.IO ---- */
const httpServer = http.createServer(app);
const io = initSocket(httpServer);
initSocketHandler(io);

/* ---- Boot sequence ---- */
const start = async () => {
  // 1. Start HTTP server immediately
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

  // 2. Start scheduled jobs
  startCleanupJob();

  // 3. Start AI service health monitor (polls every 30s per spec)
  startAIMonitor(30000);

  // 4. Connect to MongoDB in background
  connectDB().catch((err) => {
    console.warn('[db] MongoDB initial connection attempt warning:', err.message);
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
