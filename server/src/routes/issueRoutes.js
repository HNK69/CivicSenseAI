const router  = require('express').Router();
const { body, query } = require('express-validator');
const ic = require('../controllers/issueController');
const {
  requireOfficer,
  verifyToken,
} = require('../middleware/authMiddleware');
const {
  uploadIssueMedia,
  uploadAudio,
  handleCloudinaryUpload,
} = require('../middleware/uploadMiddleware');

/* ====================================================================
   CITIZEN ISSUE ROUTES — /api/issues/...
   No auth required for now — will add JWT when login/signup is built.
   ==================================================================== */

const citizenIssueRouter = require('express').Router();

// POST /api/issues/transcribe — voice recording to text
citizenIssueRouter.post('/transcribe', uploadAudio, ic.transcribeVoice);

// GET /api/issues/nearby
citizenIssueRouter.get(
  '/nearby',
  [query('lat').notEmpty(), query('lng').notEmpty()],
  ic.citizenGetNearby,
);

// GET /api/issues/mine
citizenIssueRouter.get('/mine', ic.citizenGetMyIssues);

// POST /api/issues
citizenIssueRouter.post(
  '/',
  uploadIssueMedia, handleCloudinaryUpload,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().isLength({ min: 20 }).withMessage('Description ≥ 20 chars'),
    body('category').isIn(['Roads','Water','Electricity','Sanitation','Parks','Other']),
  ],
  ic.citizenCreateIssue,
);

// GET /api/issues/:id
citizenIssueRouter.get('/:id', ic.citizenGetIssue);

// PATCH /api/issues/:id
citizenIssueRouter.patch('/:id', ic.citizenUpdateIssue);

// DELETE /api/issues/:id
citizenIssueRouter.delete('/:id', ic.citizenDeleteIssue);

// POST /api/issues/:id/upvote
citizenIssueRouter.post('/:id/upvote', ic.citizenUpvote);

// PATCH /api/issues/:id/verify
citizenIssueRouter.patch('/:id/verify', [body('confirmed').isBoolean()], ic.citizenVerifyRepair);

/* ====================================================================
   OFFICER ISSUE ROUTES — /api/officer/issues/...
   Officer routes keep their auth (officer portal is separate).
   ==================================================================== */

const officerIssueRouter = require('express').Router();

officerIssueRouter.get('/prioritized',      verifyToken, requireOfficer, ic.officerGetPrioritized);
officerIssueRouter.get('/duplicates',       verifyToken, requireOfficer, ic.officerGetDuplicates);
officerIssueRouter.post('/duplicates/merge',verifyToken, requireOfficer, ic.officerMergeDuplicates);
officerIssueRouter.get('/ai/findings',      verifyToken, requireOfficer, ic.officerGetAIFindings);
officerIssueRouter.get('/',                 verifyToken, requireOfficer, ic.officerGetIssues);
officerIssueRouter.get('/:id',              verifyToken, requireOfficer, ic.officerGetIssue);
officerIssueRouter.patch('/:id/status',     verifyToken, requireOfficer, [body('status').notEmpty()], ic.officerUpdateStatus);
officerIssueRouter.patch('/:id/assign',     verifyToken, requireOfficer, ic.officerAssignIssue);
officerIssueRouter.post('/:id/notes',       verifyToken, requireOfficer, [body('text').trim().notEmpty()], ic.officerAddNote);
officerIssueRouter.patch('/:id/priority',   verifyToken, requireOfficer, [body('priority').isIn(['CRITICAL','HIGH','MEDIUM','LOW'])], ic.officerSetPriority);
officerIssueRouter.post('/:id/investigate', verifyToken, requireOfficer, ic.officerInvestigate);

module.exports = { citizenIssueRouter, officerIssueRouter };
