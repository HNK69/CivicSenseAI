const router  = require('express').Router();
const { body, query } = require('express-validator');
const ic = require('../controllers/issueController');
const {
  verifyToken,
  requireCitizen,
  requireOfficer,
} = require('../middleware/authMiddleware');
const {
  uploadIssueMedia,
  uploadAudio,
  handleCloudinaryUpload,
} = require('../middleware/uploadMiddleware');

/* ====================================================================
   CITIZEN ISSUE ROUTES — /api/issues/...
   ==================================================================== */

const citizenIssueRouter = require('express').Router();

// POST /api/issues/transcribe — voice recording to text
citizenIssueRouter.post(
  '/transcribe',
  verifyToken, requireCitizen,
  uploadAudio,
  ic.transcribeVoice,
);

// GET /api/issues/nearby   — must be BEFORE /:id to avoid conflict
citizenIssueRouter.get(
  '/nearby',
  verifyToken, requireCitizen,
  [query('lat').notEmpty(), query('lng').notEmpty()],
  ic.citizenGetNearby,
);

// GET /api/issues/mine
citizenIssueRouter.get('/mine', verifyToken, requireCitizen, ic.citizenGetMyIssues);

// POST /api/issues
citizenIssueRouter.post(
  '/',
  verifyToken, requireCitizen,
  uploadIssueMedia, handleCloudinaryUpload,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().isLength({ min: 20 }).withMessage('Description ≥ 20 chars'),
    body('category').isIn(['Roads','Water','Electricity','Sanitation','Parks','Other']),
  ],
  ic.citizenCreateIssue,
);

// GET /api/issues/:id
citizenIssueRouter.get('/:id', verifyToken, requireCitizen, ic.citizenGetIssue);

// PATCH /api/issues/:id
citizenIssueRouter.patch('/:id', verifyToken, requireCitizen, ic.citizenUpdateIssue);

// DELETE /api/issues/:id
citizenIssueRouter.delete('/:id', verifyToken, requireCitizen, ic.citizenDeleteIssue);

// POST /api/issues/:id/upvote
citizenIssueRouter.post('/:id/upvote', verifyToken, requireCitizen, ic.citizenUpvote);

// PATCH /api/issues/:id/verify  (citizen confirms/disputes repair)
citizenIssueRouter.patch('/:id/verify', verifyToken, requireCitizen, [
  body('confirmed').isBoolean(),
], ic.citizenVerifyRepair);

/* ====================================================================
   OFFICER ISSUE ROUTES — /api/officer/issues/...
   ==================================================================== */

const officerIssueRouter = require('express').Router();

// GET /api/officer/issues/prioritized
officerIssueRouter.get('/prioritized', verifyToken, requireOfficer, ic.officerGetPrioritized);

// GET /api/officer/duplicates      — mounted in officerRoutes actually, but alias here
officerIssueRouter.get('/duplicates',       verifyToken, requireOfficer, ic.officerGetDuplicates);
officerIssueRouter.post('/duplicates/merge',verifyToken, requireOfficer, ic.officerMergeDuplicates);

// GET /api/officer/ai/findings
officerIssueRouter.get('/ai/findings', verifyToken, requireOfficer, ic.officerGetAIFindings);

// GET /api/officer/issues
officerIssueRouter.get('/', verifyToken, requireOfficer, ic.officerGetIssues);

// GET /api/officer/issues/:id
officerIssueRouter.get('/:id', verifyToken, requireOfficer, ic.officerGetIssue);

// PATCH /api/officer/issues/:id/status
officerIssueRouter.patch('/:id/status', verifyToken, requireOfficer, [
  body('status').notEmpty(),
], ic.officerUpdateStatus);

// PATCH /api/officer/issues/:id/assign
officerIssueRouter.patch('/:id/assign', verifyToken, requireOfficer, ic.officerAssignIssue);

// POST /api/officer/issues/:id/notes
officerIssueRouter.post('/:id/notes', verifyToken, requireOfficer, [
  body('text').trim().notEmpty(),
], ic.officerAddNote);

// PATCH /api/officer/issues/:id/priority
officerIssueRouter.patch('/:id/priority', verifyToken, requireOfficer, [
  body('priority').isIn(['CRITICAL','HIGH','MEDIUM','LOW']),
], ic.officerSetPriority);

// POST /api/officer/issues/:id/investigate  (AI stub)
officerIssueRouter.post('/:id/investigate', verifyToken, requireOfficer, ic.officerInvestigate);

module.exports = { citizenIssueRouter, officerIssueRouter };
