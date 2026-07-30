/**
 * aiService.js — AI service calls.
 *
 * transcribeAudio: LIVE — uses Groq Whisper API (whisper-large-v3-turbo).
 * All other functions: PLACEHOLDER stubs for future FastAPI ai-service.
 *
 * Set GROQ_API_KEY in .env to enable real transcription.
 * Set AI_SERVICE_URL in .env to enable FastAPI stubs when ready.
 */

const AI_BASE = process.env.AI_SERVICE_URL || '';

// Lazy-init axios so missing AI_SERVICE_URL doesn't crash startup
let _axios = null;
const getAxios = () => {
  if (!_axios) _axios = require('axios').create({ baseURL: AI_BASE, timeout: 10000 });
  return _axios;
};

// Lazy-init Groq client
let _groq = null;
const getGroq = () => {
  if (!_groq) {
    const Groq = require('groq-sdk');
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
};

/* ---- analyzeIssue ---- */
const analyzeIssue = async (issuePayload) => {
  // TODO: return (await getAxios().post('/analyze', issuePayload)).data;
  return {
    analysisTags:    ['infrastructure', issuePayload.category?.toLowerCase()],
    summary:         `AI analysis placeholder for "${issuePayload.title}".`,
    suggestedAction: 'Assign to relevant department.',
    confidence:      null,
  };
};

/* ---- detectDuplicate ---- */
const detectDuplicate = async (issuePayload) => {
  // TODO: return (await getAxios().post('/duplicate-check', issuePayload)).data;
  return { isDuplicate: false, duplicateOf: null, similarity: 0 };
};

/* ---- getPriorityScore ---- */
const getPriorityScore = async (issuePayload) => {
  // TODO: return (await getAxios().post('/priority', issuePayload)).data;
  return { priorityScore: null, priority: issuePayload.priority || 'LOW' };
};

/* ---- runAIInvestigation ---- */
const runAIInvestigation = async (issueId) => {
  // TODO: return (await getAxios().post('/investigate', { issueId })).data;
  return {
    issueId,
    severity: 'MEDIUM',
    summary: 'AI investigation placeholder — no analysis performed.',
    suggestedAction: 'Manual review required.',
    confidence: null,
    message: 'Analysis queued (placeholder)',
  };
};

/* ---- findDuplicateMergeCandidates ---- */
const findDuplicateMergeCandidates = async (issueId) => {
  // TODO: return (await getAxios().post('/duplicates', { issueId })).data;
  return { primaryIssueId: issueId, duplicates: [] };
};

/* ---- verifyRepair ---- */
const verifyRepair = async (workOrderId, evidence) => {
  // TODO: return (await getAxios().post('/verify-repair', { workOrderId, evidence })).data;
  return { workOrderId, verdict: 'pending', confidence: null, message: 'AI repair verification placeholder.' };
};

/* ---- transcribeAudio — LIVE via Groq Whisper ---- */
/**
 * Accepts a Buffer (from multer memoryStorage) or a file path string.
 * Uses Groq's whisper-large-v3-turbo model.
 * Falls back gracefully if the API call fails.
 */
const transcribeAudio = async (audioInput) => {
  if (!process.env.GROQ_API_KEY) {
    console.warn('[aiService] GROQ_API_KEY not set — returning stub transcription.');
    return { text: 'Voice transcription unavailable (API key not configured).' };
  }

  if (!audioInput) {
    return { text: '' };
  }

  try {
    const groq = getGroq();

    // Build a File object from Buffer so the SDK can upload it
    let fileObj;
    if (Buffer.isBuffer(audioInput)) {
      // Wrap buffer in a File-like object that groq-sdk accepts
      const { File } = require('node:buffer');
      fileObj = new File([audioInput], 'recording.webm', { type: 'audio/webm' });
    } else {
      // It's a path — use fs.createReadStream via the SDK's fromPath helper
      const fs = require('fs');
      fileObj = fs.createReadStream(audioInput);
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
    // Return empty string so caller can decide what to show the user
    return { text: '', error: err.message };
  }
};

/* ---- municipalCopilotQuery ---- */
const municipalCopilotQuery = async (query, ctx = {}) => {
  // TODO: return (await getAxios().post('/copilot', { query, context: ctx })).data;
  return {
    role: 'ai',
    text: `[AI Response Placeholder] You asked: "${query}". Connect the FastAPI ai-service to get a real answer.`,
    ts:   new Date().toISOString(),
  };
};

module.exports = {
  analyzeIssue,
  detectDuplicate,
  getPriorityScore,
  runAIInvestigation,
  findDuplicateMergeCandidates,
  verifyRepair,
  transcribeAudio,
  municipalCopilotQuery,
};
