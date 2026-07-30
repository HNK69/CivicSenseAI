const { Server } = require('socket.io');

let io = null;

/**
 * initSocket — creates and configures the Socket.IO server.
 * Call once from server.js, passing the raw HTTP server.
 * @param {http.Server} httpServer
 * @returns {Server} io instance
 */
const initSocket = (httpServer) => {
  const allowedOrigins = [
    process.env.CLIENT_USER_URL    || 'http://localhost:3000',
    process.env.CLIENT_OFFICER_URL || 'http://localhost:5173',
  ];

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  return io;
};

/**
 * getIO — returns the initialized io instance.
 * Throws if called before initSocket.
 */
const getIO = () => {
  if (!io) throw new Error('[socket] Socket.IO not initialized. Call initSocket first.');
  return io;
};

module.exports = { initSocket, getIO };
