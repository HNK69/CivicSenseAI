const { getIO } = require('../config/socket');

/**
 * socketHandler.js — All Socket.IO wiring in one place.
 *
 * Rooms:
 *   user:<userId>           — citizen receives their own notifications/updates
 *   officer:<officerId>     — officer receives assignment notifications
 *   issue:<issueId>         — both sides subscribe to a specific issue
 *   department:<dept>       — officers in a department receive new issues
 *
 * Exported emit helpers are used by controllers and notificationService.
 *
 * Events emitted by server → client:
 *   notification:new       — new notification (citizen & officer)
 *   issue:statusUpdated    — issue status changed
 *   issue:assigned         — issue assigned to officer/dept
 *   issue:newAssignment    — officer-side: new work assigned to YOU
 *   workOrder:updated      — work order status changed
 *
 * Events emitted by client → server (listened here):
 *   issue:subscribe        — join issue:<issueId> room
 *   issue:unsubscribe      — leave issue:<issueId> room
 *   user:join              — citizen joins their personal room
 *   officer:join           — officer joins their personal + dept room
 */
const initSocketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log(`[socket] Client connected: ${socket.id}`);

    /* ---- Citizen: join personal room ---- */
    socket.on('user:join', ({ userId }) => {
      if (!userId) return;
      socket.join(`user:${userId}`);
      console.log(`[socket] User ${userId} joined room user:${userId}`);
    });

    /* ---- Officer: join personal + department room ---- */
    socket.on('officer:join', ({ officerId, department }) => {
      if (!officerId) return;
      socket.join(`officer:${officerId}`);
      if (department) socket.join(`department:${department}`);
      console.log(`[socket] Officer ${officerId} joined rooms`);
    });

    /* ---- Subscribe to a specific issue room (both sides) ---- */
    socket.on('issue:subscribe', ({ issueId }) => {
      if (!issueId) return;
      socket.join(`issue:${issueId}`);
    });

    socket.on('issue:unsubscribe', ({ issueId }) => {
      if (!issueId) return;
      socket.leave(`issue:${issueId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[socket] Client disconnected: ${socket.id}`);
    });
  });
};

/* ============================================================
   EMIT HELPERS — used by controllers and notificationService
   ============================================================ */

const emitToUser = (userId, event, payload) => {
  try { getIO().to(`user:${userId}`).emit(event, payload); }
  catch (e) { console.warn('[socket] emitToUser failed:', e.message); }
};

const emitToOfficer = (officerId, event, payload) => {
  try { getIO().to(`officer:${officerId}`).emit(event, payload); }
  catch (e) { console.warn('[socket] emitToOfficer failed:', e.message); }
};

const emitToIssueRoom = (issueId, event, payload) => {
  try { getIO().to(`issue:${issueId}`).emit(event, payload); }
  catch (e) { console.warn('[socket] emitToIssueRoom failed:', e.message); }
};

const emitToDepartment = (dept, event, payload) => {
  try { getIO().to(`department:${dept}`).emit(event, payload); }
  catch (e) { console.warn('[socket] emitToDepartment failed:', e.message); }
};

module.exports = {
  initSocketHandler,
  emitToUser,
  emitToOfficer,
  emitToIssueRoom,
  emitToDepartment,
};
