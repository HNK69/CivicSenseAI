/**
 * aiHealthMonitor.js — Polls the AI service health endpoint every 30s.
 * Logs degraded/down status. Used by server.js on startup.
 */

const { getAIHealth } = require('./aiService');

let _interval = null;

async function checkHealth() {
  try {
    const data = await getAIHealth();
    const status = data?.status || 'unknown';
    if (status !== 'healthy') {
      console.warn(`[aiHealthMonitor] AI service status: ${status}`, data);
    } else {
      console.log(`[aiHealthMonitor] AI service healthy.`);
    }
  } catch (err) {
    console.error('[aiHealthMonitor] AI service unreachable:', err.message);
  }
}

function startMonitor(intervalMs = 30000) {
  if (_interval) return; // already running
  console.log(`[aiHealthMonitor] Starting health poll every ${intervalMs / 1000}s.`);
  checkHealth(); // immediate first check
  _interval = setInterval(checkHealth, intervalMs);
}

function stopMonitor() {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
  }
}

module.exports = { startMonitor, stopMonitor };
