/**
 * aiService.js — PLACEHOLDER stubs for FastAPI ai-service calls.
 *
 * NO real AI logic is implemented here. Each function:
 *   1. Returns safe mock data immediately.
 *   2. Has a TODO comment with the intended axios call to AI_SERVICE_URL.
 *
 * Wire-up: import these in issueController (on create) and
 * officerController (on investigate/verify actions).
 * When the FastAPI service is ready, replace the mock return with
 * the commented-out axios call.
 */

const AI_BASE = process.env.AI_SERVICE_URL || '';

// Lazy-init axios so missing AI_SERVICE_URL doesn't crash startup
let _axios = null;
const getAxios = () => {
  if (!_axios) _axios = require('axios').create({ baseURL: AI_BASE, timeout: 10000 });
  return _axios;
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
  municipalCopilotQuery,
};
