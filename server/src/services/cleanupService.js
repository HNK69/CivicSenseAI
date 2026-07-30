const cron = require('node-cron');
const Issue     = require('../models/Issue');
const WorkOrder = require('../models/WorkOrder');

/**
 * cleanupService.js — Prunes old resolved/verified history entries.
 *
 * Runs daily at midnight. Only removes sub-document entries (statusHistory
 * entries on Issue and history entries on WorkOrder) that are:
 *   - status === 'resolved' | 'verified'
 *   - AND changedAt / timestamp older than HISTORY_RETENTION_DAYS
 *
 * The parent Issue/WorkOrder document is NOT deleted — only old history
 * sub-entries are filtered out.
 *
 * Set threshold via: HISTORY_RETENTION_DAYS=7 in .env (default: 7)
 */

const RETENTION_DAYS = parseInt(process.env.HISTORY_RETENTION_DAYS || '7', 10);
const RESOLVED_STATUSES = new Set(['resolved', 'verified', 'RESOLVED', 'VERIFIED']);

const pruneOldHistory = async () => {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  let issueEntriesPruned = 0;
  let workOrderEntriesPruned = 0;

  try {
    // ─── Prune Issue.statusHistory ───────────────────────────────────────────
    const issues = await Issue.find({
      'statusHistory.status': { $in: [...RESOLVED_STATUSES] },
    }).select('statusHistory');

    for (const issue of issues) {
      const originalLen = issue.statusHistory.length;
      issue.statusHistory = issue.statusHistory.filter(entry => {
        const isOldResolved =
          RESOLVED_STATUSES.has(entry.status) &&
          new Date(entry.changedAt) < cutoff;
        return !isOldResolved;
      });

      const pruned = originalLen - issue.statusHistory.length;
      if (pruned > 0) {
        issueEntriesPruned += pruned;
        await issue.save({ validateBeforeSave: false });
      }
    }

    // ─── Prune WorkOrder.history ─────────────────────────────────────────────
    const workOrders = await WorkOrder.find({
      'history.status': { $in: [...RESOLVED_STATUSES] },
    }).select('history');

    for (const wo of workOrders) {
      const originalLen = wo.history.length;
      wo.history = wo.history.filter(entry => {
        const isOldResolved =
          RESOLVED_STATUSES.has(entry.status) &&
          new Date(entry.changedAt || entry.updatedAt) < cutoff;
        return !isOldResolved;
      });

      const pruned = originalLen - wo.history.length;
      if (pruned > 0) {
        workOrderEntriesPruned += pruned;
        await wo.save({ validateBeforeSave: false });
      }
    }

    console.log(
      `[cleanupService] Daily prune complete — ` +
      `Issue history: ${issueEntriesPruned} entries removed, ` +
      `WorkOrder history: ${workOrderEntriesPruned} entries removed ` +
      `(threshold: ${RETENTION_DAYS} days)`
    );
  } catch (err) {
    console.error('[cleanupService] Prune failed:', err.message);
  }
};

/**
 * startCleanupJob — registers the cron job. Call this in server.js
 * after the DB connection is established.
 *
 * Schedule: every day at midnight UTC  (0 0 * * *)
 */
const startCleanupJob = () => {
  cron.schedule('0 0 * * *', pruneOldHistory, {
    timezone: 'UTC',
  });
  console.log(`[cleanupService] Daily history prune job scheduled (retention: ${RETENTION_DAYS} days).`);
};

module.exports = { startCleanupJob, pruneOldHistory };
