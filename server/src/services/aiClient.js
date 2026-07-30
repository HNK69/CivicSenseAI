/**
 * aiClient.js — Singleton HTTP client for the CivicSense AI microservice.
 *
 * All code that calls the AI FastAPI service MUST go through this module.
 * Nothing else should call AI_SERVICE_URL directly.
 *
 * Base URL: process.env.AI_SERVICE_URL (default: http://localhost:8001)
 *
 * Retry policy (per spec):
 *   422  → no retry  — fix the request payload
 *   502  → retry up to 3×, exponential backoff starting at 2s
 *   503  → retry up to 3×, wait ≥30s before each retry
 *   500  → retry once, then log alert
 *   Other 5xx → no retry
 */

const axios = require('axios');

const AI_BASE = process.env.AI_SERVICE_URL || 'http://localhost:8001';

const _client = axios.create({
  baseURL: AI_BASE,
  timeout: 60000, // 60s — AI inference can be slow
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
  503: { retry: true, maxAttempts: 3, delayMs: 30000 },
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
      // Propagate X-Correlation-ID for every successful call
      const corrId = response.headers?.['x-correlation-id'];
      if (corrId) log.info(`[${label}] correlation_id=${corrId}`);
      return response.data;
    } catch (err) {
      const status = err?.response?.status;
      const corrId = err?.response?.headers?.['x-correlation-id'];
      const detail = err?.response?.data?.detail || err.message;

      // Always log correlation ID on error
      log.error(`[${label}] status=${status} correlation_id=${corrId || 'n/a'} detail=${detail}`);

      const policy = RETRY_POLICY[status];

      if (!policy || !policy.retry) {
        // No retry — throw structured error
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
 *
 * @param {object} payload
 * @param {string}   payload.text
 * @param {string[]} payload.image_urls
 * @param {string[]} payload.video_urls  — ALWAYS an array, never video_url singular
 * @param {object}   payload.gps         — { lat, lng }
 * @returns {Promise<object>} AI analysis result
 */
async function analyzeComplaint({ text, image_urls = [], video_urls = [], gps = null }) {
  return callWithRetry(
    () => _client.post('/api/v1/analyze', { text, image_urls, video_urls, gps }),
    'analyzeComplaint'
  );
}

/**
 * checkDuplicate — POST /api/v1/check-duplicate
 * Must be called AFTER analyzeComplaint (needs category from it).
 * Must be called BEFORE saving to MongoDB.
 *
 * @param {object} payload
 * @param {string} payload.complaint_id — MongoDB ObjectId string of the new complaint
 * @param {string} payload.text
 * @param {string} payload.category     — from analyzeComplaint output
 * @returns {Promise<object>} { is_duplicate, duplicate_of, similarity_score, confidence, ... }
 */
async function checkDuplicate({ complaint_id, text, category }) {
  return callWithRetry(
    () => _client.post('/api/v1/check-duplicate', { complaint_id, text, category }),
    'checkDuplicate'
  );
}

/**
 * verifyRepair — POST /api/v1/verify-repair
 *
 * @param {object}   payload
 * @param {string}   payload.complaint_id
 * @param {string[]} payload.before_image_urls
 * @param {string[]} payload.after_image_urls
 * @returns {Promise<object>} { verified, confidence, explanation, remaining_issues, diff_summary }
 */
async function verifyRepair({ complaint_id, before_image_urls = [], after_image_urls = [] }) {
  return callWithRetry(
    () => _client.post('/api/v1/verify-repair', { complaint_id, before_image_urls, after_image_urls }),
    'verifyRepair'
  );
}

/**
 * copilotChat — POST /api/v1/copilot
 * Always pre-fetch complaint_context server-side — Gemma has no grounding without it.
 *
 * @param {object} payload
 * @param {string} payload.message
 * @param {string} payload.officer_id
 * @param {string} payload.officer_name
 * @param {string} payload.officer_department
 * @param {object} payload.complaint_context — pre-fetched complaint data
 * @param {array}  payload.tools             — optional tool list
 * @returns {Promise<object>} { response, ... }
 */
async function copilotChat({
  message,
  officer_id,
  officer_name,
  officer_department,
  complaint_context = {},
  tools = [],
}) {
  return callWithRetry(
    () =>
      _client.post('/api/v1/copilot', {
        message,
        officer_id,
        officer_name,
        officer_department,
        complaint_context,
        tools,
      }),
    'copilotChat'
  );
}

/**
 * getHealth — GET /api/v1/health
 * HTTP always returns 200; check body.status: 'healthy' | 'degraded' | 'down'.
 * Used by health-monitor; polled every 30s.
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
