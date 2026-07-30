/**
 * aiService.js — AI service facade used by controllers.
 *
 * transcribeAudio  → LIVE via Groq Whisper (unchanged)
 * All other fns    → real calls through aiClient.js to the FastAPI ai-service.
 *
 * Env: AI_SERVICE_URL (default http://localhost:8001), GROQ_API_KEY
 */

const aiClient = require('./aiClient');

// ---- Lazy-init Groq client (for audio transcription only) ----
let _groq = null;
const getGroq = () => {
  if (!_groq) {
    const Groq = require('groq-sdk');
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
};

/* ============================================================
   Re-export aiClient functions with the names that
   existing controllers already import.
   ============================================================ */

/**
 * analyzeIssue — wraps aiClient.analyzeComplaint.
 * Called by issueController after Cloudinary upload.
 *
 * @param {object} p
 * @param {string}   p.text          — full complaint text (title + description)
 * @param {string[]} p.image_urls
 * @param {string[]} p.video_urls
 * @param {{ lat, lng }} p.gps
 */
const analyzeIssue = async ({ text, image_urls = [], video_urls = [], gps = null } = {}) =>
  aiClient.analyzeComplaint({ text, image_urls, video_urls, gps });

/**
 * detectDuplicate — wraps aiClient.checkDuplicate.
 * Must be called AFTER analyzeIssue (needs category).
 * Must be called BEFORE saving complaint to MongoDB.
 */
const detectDuplicate = async ({ complaint_id, text, category }) =>
  aiClient.checkDuplicate({ complaint_id, text, category });

/**
 * verifyRepairAI — wraps aiClient.verifyRepair.
 * Returns { verified, confidence, explanation, remaining_issues, diff_summary }
 */
const verifyRepairAI = async ({ complaint_id, before_image_urls = [], after_image_urls = [] }) =>
  aiClient.verifyRepair({ complaint_id, before_image_urls, after_image_urls });

/**
 * municipalCopilotQuery — wraps aiClient.copilotChat.
 * complaint_context MUST be pre-fetched by the caller before invoking.
 */
const municipalCopilotQuery = async ({
  message,
  officer_id,
  officer_name,
  officer_department,
  complaint_context = {},
  tools = [],
}) =>
  aiClient.copilotChat({
    message,
    officer_id,
    officer_name,
    officer_department,
    complaint_context,
    tools,
  });

/**
 * getAIHealth — wraps aiClient.getHealth.
 */
const getAIHealth = async () => aiClient.getHealth();

/* ============================================================
   transcribeAudio — LIVE via Groq Whisper (unchanged)
   ============================================================ */
/**
 * Accepts a Buffer (multer memoryStorage) or file path string.
 * Uses whisper-large-v3-turbo. Falls back gracefully on failure.
 */
const transcribeAudio = async (audioInput) => {
  if (!process.env.GROQ_API_KEY) {
    console.warn('[aiService] GROQ_API_KEY not set — returning stub transcription.');
    return { text: 'Voice transcription unavailable (API key not configured).' };
  }
  if (!audioInput) return { text: '' };

  try {
    const groq = getGroq();
    const { toFile } = require('groq-sdk');

    let fileObj;
    if (Buffer.isBuffer(audioInput)) {
      fileObj = await toFile(audioInput, 'recording.webm', { type: 'audio/webm' });
    } else {
      const fs = require('fs');
      fileObj = await toFile(fs.createReadStream(audioInput), 'recording.webm', { type: 'audio/webm' });
    }

    const transcription = await groq.audio.transcriptions.create({
      file:            fileObj,
      model:           'whisper-large-v3-turbo',
      response_format: 'json',
      language:        'en',
    });

    const text = transcription?.text?.trim() || '';
    console.log(`[aiService] Groq transcription complete (${text.length} chars).`);
    return { text };
  } catch (err) {
    console.error('[aiService] Groq transcription failed:', err.message);
    return { text: '', error: err.message };
  }
};

module.exports = {
  analyzeIssue,
  detectDuplicate,
  verifyRepairAI,
  municipalCopilotQuery,
  getAIHealth,
  transcribeAudio,
};
