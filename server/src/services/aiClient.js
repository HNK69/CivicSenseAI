/**
 * aiClient.js — Singleton HTTP client for the CivicSense AI microservice.
 *
 * All code that calls the AI FastAPI service MUST go through this module.
 * Nothing else should call AI_SERVICE_URL directly.
 *
 * Base URL: process.env.AI_SERVICE_URL (default: http://localhost:8001)
 *
 * Retry policy:
 *   422  → no retry  — fix the request payload
 *   502  → retry up to 3×, exponential backoff starting at 2s
 *   503  → retry up to 3×, wait 5s before each retry (reduced for demo)
 *   500  → retry once, then log alert
 *   Other 5xx → no retry
 */

const axios = require('axios');

const AI_BASE = process.env.AI_SERVICE_URL || 'http://localhost:8001';

const _client = axios.create({
  baseURL: AI_BASE,
  timeout: 180000, // 3 minutes — covers full failover budget (C7)
  headers: { 'Content-Type': 'application/json' },
});

/* ---- Logging helper ---- */
const log = {
  info:  (msg, ...args) => console.log(`[aiClient] ${msg}`, ...args),
  warn:  (msg, ...args) => console.warn(`[aiClient] WARN  ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[aiClient] ERROR ${msg}`, ...args),
};

/* ---- Retry policy table ---- */
const RETRY_POLICY = {
  422: { retry: false },
  500: { retry: true, maxAttempts: 2, delayMs: 1000 },
  502: { retry: true, maxAttempts: 3, exponential: true, baseDelayMs: 2000 },
  503: { retry: true, maxAttempts: 3, delayMs: 5000 }, // R7: 5s delay for demo responsiveness
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * callWithRetry — wraps an axios call with the spec retry policy.
 * @param {Function} fn   — () => Promise<AxiosResponse>
 * @param {string}   label — human-readable name for logging
 */
async function callWithRetry(fn, label) {
  let attempt = 0;

  while (true) {
    attempt += 1;
    let response;
    try {
      response = await fn();
      const corrId = response.headers?.['x-correlation-id'];
      if (corrId) log.info(`[${label}] correlation_id=${corrId}`);
      return response.data;
    } catch (err) {
      const status = err?.response?.status;
      const corrId = err?.response?.headers?.['x-correlation-id'];
      const detail = err?.response?.data?.detail || err.message;

      log.error(`[${label}] status=${status} correlation_id=${corrId || 'n/a'} detail=${detail}`);

      const policy = RETRY_POLICY[status];

      if (!policy || !policy.retry) {
        const e = new Error(detail || `AI service error ${status}`);
        e.status = status;
        e.detail = detail;
        e.correlation_id = corrId;
        e.aiServiceError = true;
        throw e;
      }

      const maxAttempts = policy.maxAttempts || 1;
      if (attempt >= maxAttempts) {
        if (status === 500) log.error(`[${label}] Alerting: AI service returned 500 after ${attempt} attempt(s).`);
        const e = new Error(detail || `AI service error ${status} after ${attempt} attempts`);
        e.status = status;
        e.detail = detail;
        e.correlation_id = corrId;
        e.aiServiceError = true;
        throw e;
      }

      let delay;
      if (policy.exponential) {
        delay = policy.baseDelayMs * Math.pow(2, attempt - 1);
      } else {
        delay = policy.delayMs || 2000;
      }

      log.warn(`[${label}] status=${status} — retrying attempt ${attempt + 1}/${maxAttempts} in ${delay}ms…`);
      await sleep(delay);
    }
  }
}

/* ====================================================================
   PUBLIC API — one function per endpoint
   ==================================================================== */

/**
 * analyzeComplaint — POST /api/v1/analyze
 */
async function analyzeComplaint({ text, image_urls = [], video_urls = [], gps = null }) {
  return callWithRetry(
    () => _client.post('/api/v1/analyze', { text, image_urls, video_urls, gps }),
    'analyzeComplaint'
  );
}

/**
 * checkDuplicate — POST /api/v1/detect-duplicates (C3 fix)
 * Must be called AFTER analyzeComplaint (needs category from it).
 * Must be called BEFORE saving to MongoDB.
 */
async function checkDuplicate({ complaint_id, text, category }) {
  return callWithRetry(
    () => _client.post('/api/v1/detect-duplicates', { complaint_id, text, category }),
    'checkDuplicate'
  );
}

/**
 * verifyRepair — POST /api/v1/verify-repair
 */
async function verifyRepair({ complaint_id, before_image_urls = [], after_image_urls = [] }) {
  return callWithRetry(
    () => _client.post('/api/v1/verify-repair', { complaint_id, before_image_urls, after_image_urls }),
    'verifyRepair'
  );
}

/**
 * copilotChat — POST /api/v1/copilot (C2 fix: officer_query + context object)
 */
async function copilotChat({
  message,
  officer_id,
  officer_name,
  officer_department,
  complaint_context = {},
}) {
  const formatComplaintSummary = (c) => {
    if (!c) return null;
    const cid = (c.complaint_id || c.id || c._id)?.toString();
    if (!cid) return null;
    return {
      complaint_id: cid,
      text: c.text || [c.title, c.description].filter(Boolean).join(' - ') || 'Civic issue',
      category: c.category || 'Other',
      severity: c.severity || c.priority || c.ai_analysis?.severity || null,
      status: c.status || null,
      created_at: c.created_at || (c.createdAt ? new Date(c.createdAt).toISOString() : null),
    };
  };

  const rawRecent = complaint_context?.recent_complaints || (complaint_context?.id ? [complaint_context] : []);
  const recent_complaints = rawRecent.map(formatComplaintSummary).filter(Boolean);

  return callWithRetry(
    () =>
      _client.post('/api/v1/copilot', {
        officer_query: message,
        context: {
          officer_id: officer_id || 'guest_officer',
          officer_name: officer_name || 'Officer',
          officer_department: officer_department || 'General',
          recent_complaints,
          backlog: (complaint_context?.backlog || []).map(formatComplaintSummary).filter(Boolean),
          priority_queue: (complaint_context?.priority_queue || []).map(formatComplaintSummary).filter(Boolean),
        },
      }),
    'copilotChat'
  );
}

/**
 * getHealth — GET /api/v1/health
 */
async function getHealth() {
  return callWithRetry(
    () => _client.get('/api/v1/health'),
    'getHealth'
  );
}

module.exports = {
  analyzeComplaint,
  checkDuplicate,
  verifyRepair,
  copilotChat,
  getHealth,
};
