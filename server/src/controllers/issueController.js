const { validationResult } = require('express-validator');
const Issue    = require('../models/Issue');
const WorkOrder = require('../models/WorkOrder');
const asyncHandler = require('../utils/asyncHandler');
const { success, created, error, paginated } = require('../utils/response');
const paginate  = require('../utils/paginate');
const { buildGeoPoint, nearbyFilter } = require('../services/mapService');
const { analyzeIssue, detectDuplicate, getPriorityScore } = require('../services/aiService');
const { notifyStatusChange, notifyNewAssignment } = require('../services/notificationService');
const { emitToIssueRoom, emitToDepartment } = require('../sockets/socketHandler');

/* ====================================================================
   CATEGORY → DEPARTMENT auto-routing map
   (used by both create and officer assignment)
   ==================================================================== */
const DEPT_MAP = {
  Roads:       'PWD',
  Water:       'Water Supply',
  Electricity: 'Electrical',
  Sanitation:  'Sanitation',
  Parks:       'Parks & Gardens',
  Other:       'General',
};

/* ====================================================================
   CITIZEN — Issue Controller Functions
   ==================================================================== */

/**
 * POST /api/issues
 * Create a new civic issue. Media handled by uploadMiddleware before this.
 */
exports.citizenCreateIssue = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 400, errors.array());

  const { title, description, category, subCategory, address, latitude, longitude } = req.body;

  // Build location GeoJSON
  const location = (latitude && longitude)
    ? buildGeoPoint(latitude, longitude)
    : { type: 'Point', coordinates: [0, 0] };

  // Auto-assign department based on category
  const assignedDepartment = DEPT_MAP[category] || 'General';

  // Collect uploaded media from uploadMiddleware
  const { images = [], videos = [] } = req.uploadedMedia || {};

  const issue = await Issue.create({
    title,
    description,
    category,
    subCategory:        subCategory || null,
    location,
    address:            address     || null,
    assignedDepartment,
    createdBy:          req.user._id,
    images,
    videos,
    status:             'reported',
    statusHistory: [{
      status:    'reported',
      changedAt: new Date(),
      changedByModel: 'User',
      changedBy: req.user._id,
    }],
  });

  // AI stubs — fire-and-forget, never block the response
  Promise.all([
    analyzeIssue({ title, description, category }),
    detectDuplicate({ title, description, location }),
    getPriorityScore({ category, description }),
  ])
    .then(([analysis, dupCheck, priorityResult]) => {
      issue.aiMeta = {
        analysisTags:    analysis.analysisTags,
        summary:         analysis.summary,
        suggestedAction: analysis.suggestedAction,
        duplicateOf:     dupCheck.duplicateOf || null,
        priorityScore:   priorityResult.priorityScore,
      };
      if (priorityResult.priority) issue.priority = priorityResult.priority;
      return issue.save({ validateBeforeSave: false });
    })
    .catch(err => console.warn('[issueController] AI stub error:', err.message));

  return created(res, { issue }, 'Issue reported successfully');
});

/**
 * GET /api/issues/mine
 * Citizen's own issues with optional status filter.
 */
exports.citizenGetMyIssues = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = { createdBy: req.user._id, isDeleted: false };
  if (status) filter.status = status;

  const { docs, total } = await paginate(Issue, filter, {
    page, limit,
    populate: [
      { path: 'assignedOfficer', select: 'name designation' },
    ],
  });

  return paginated(res, docs, total, page, limit);
});

/**
 * GET /api/issues/:id
 * Single issue — citizen can only fetch their own.
 */
exports.citizenGetIssue = asyncHandler(async (req, res) => {
  const issue = await Issue.findOne({
    _id: req.params.id,
    createdBy: req.user._id,
    isDeleted: false,
  }).populate('assignedOfficer', 'name designation department');

  if (!issue) return error(res, 'Issue not found', 404);
  return success(res, { issue });
});

/**
 * GET /api/issues/nearby
 * Query: lat, lng, radius (km, default 2)
 */
exports.citizenGetNearby = asyncHandler(async (req, res) => {
  const { lat, lng, radius = 2, limit = 20 } = req.query;
  if (!lat || !lng) return error(res, 'lat and lng are required', 400);

  const geoFilter = nearbyFilter(lat, lng, parseFloat(radius));
  const issues = await Issue.find({ ...geoFilter, isDeleted: false })
    .limit(parseInt(limit))
    .select('title category status priority location address aiMeta createdAt')
    .lean();

  return success(res, { issues });
});

/**
 * PATCH /api/issues/:id
 * Citizen updates their own issue (only if still 'reported').
 */
exports.citizenUpdateIssue = asyncHandler(async (req, res) => {
  const issue = await Issue.findOne({
    _id: req.params.id,
    createdBy: req.user._id,
    isDeleted: false,
  });
  if (!issue) return error(res, 'Issue not found', 404);
  if (!['reported'].includes(issue.status))
    return error(res, 'Cannot edit an issue that is already in progress', 403);

  const { title, description, address } = req.body;
  if (title)       issue.title       = title;
  if (description) issue.description = description;
  if (address)     issue.address     = address;
  await issue.save();

  return success(res, { issue }, 'Issue updated');
});

/**
 * DELETE /api/issues/:id  (soft delete)
 */
exports.citizenDeleteIssue = asyncHandler(async (req, res) => {
  const issue = await Issue.findOne({
    _id: req.params.id,
    createdBy: req.user._id,
  });
  if (!issue) return error(res, 'Issue not found', 404);

  issue.isDeleted = true;
  await issue.save();
  return success(res, {}, 'Issue removed');
});

/**
 * POST /api/issues/:id/upvote
 */
exports.citizenUpvote = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) return error(res, 'Issue not found', 404);

  const alreadyUpvoted = issue.upvotedBy.includes(req.user._id);
  if (alreadyUpvoted) {
    issue.upvotedBy.pull(req.user._id);
    issue.upvoteCount = Math.max(0, issue.upvoteCount - 1);
  } else {
    issue.upvotedBy.push(req.user._id);
    issue.upvoteCount += 1;
  }
  await issue.save();
  return success(res, { upvoted: !alreadyUpvoted, upvoteCount: issue.upvoteCount });
});

/**
 * PATCH /api/issues/:id/verify  (citizen confirms or disputes a completed repair)
 * Body: { confirmed: Boolean, reason?: string }
 */
exports.citizenVerifyRepair = asyncHandler(async (req, res) => {
  const { confirmed, reason } = req.body;
  const issue = await Issue.findOne({
    _id: req.params.id,
    createdBy: req.user._id,
  });
  if (!issue) return error(res, 'Issue not found', 404);
  if (issue.status !== 'resolved')
    return error(res, 'Issue is not marked as resolved yet', 400);

  if (confirmed) {
    // Citizen confirms — close it
    issue.statusHistory.push({
      status:    'resolved',
      changedAt: new Date(),
      changedByModel: 'User',
      changedBy: req.user._id,
      note:      'Confirmed fixed by citizen',
    });
  } else {
    // Citizen disputes — reopen
    issue.status = 'reopened';
    issue.statusHistory.push({
      status:    'reopened',
      changedAt: new Date(),
      changedByModel: 'User',
      changedBy: req.user._id,
      note:      reason || 'Still an issue — reported by citizen',
    });
    emitToIssueRoom(issue._id.toString(), 'issue:statusUpdated', {
      issueId: issue._id, status: 'reopened',
    });
  }
  await issue.save();
  return success(res, { issue }, confirmed ? 'Repair confirmed' : 'Issue re-opened');
});

/* ====================================================================
   OFFICER — Issue Controller Functions
   ==================================================================== */

/**
 * GET /api/officer/issues
 * List all issues with filtering/pagination.
 * Query: status, category, priority, department, search, page, limit
 */
exports.officerGetIssues = asyncHandler(async (req, res) => {
  const {
    status, category, priority, department, search,
    page = 1, limit = 20, sort = '-createdAt',
  } = req.query;

  const filter = { isDeleted: false };
  if (status)     filter.status             = status;
  if (category)   filter.category           = category;
  if (priority)   filter.priority           = priority;
  if (department) filter.assignedDepartment = department;

  if (search) {
    filter.$or = [
      { title:       { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { address:     { $regex: search, $options: 'i' } },
    ];
  }

  const sortObj = sort.startsWith('-')
    ? { [sort.slice(1)]: -1 }
    : { [sort]: 1 };

  const { docs, total } = await paginate(Issue, filter, {
    page, limit,
    sort: sortObj,
    populate: [
      { path: 'createdBy',       select: 'name email phone' },
      { path: 'assignedOfficer', select: 'name designation department' },
      { path: 'workOrder',       select: 'status department contractor' },
    ],
  });

  return paginated(res, docs, total, page, limit);
});

/**
 * GET /api/officer/issues/:id
 */
exports.officerGetIssue = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id)
    .populate('createdBy',       'name email phone ward city')
    .populate('assignedOfficer', 'name designation department')
    .populate({ path: 'workOrder', populate: { path: 'contractor', select: 'name company' } });

  if (!issue || issue.isDeleted) return error(res, 'Issue not found', 404);
  return success(res, { issue });
});

/**
 * PATCH /api/officer/issues/:id/status
 * Body: { status, note? }
 * Maps: client-officer's updateIssueStatus(id, status) → PATCH /api/officer/issues/:id/status
 */
exports.officerUpdateStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const VALID_STATUSES = ['reported','acknowledged','assigned','in_progress','resolved','rejected','reopened'];
  if (!VALID_STATUSES.includes(status))
    return error(res, `Invalid status. Valid: ${VALID_STATUSES.join(', ')}`, 400);

  const issue = await Issue.findById(req.params.id);
  if (!issue || issue.isDeleted) return error(res, 'Issue not found', 404);

  const prevStatus = issue.status;
  issue.status = status;
  issue.statusHistory.push({
    status,
    changedAt:      new Date(),
    changedByModel: 'Officer',
    changedBy:      req.officer._id,
    note:           note || null,
  });
  await issue.save();

  // Notify citizen
  await notifyStatusChange({
    userId:     issue.createdBy,
    issueId:    issue._id,
    issueTitle: issue.title,
    newStatus:  status,
  });

  // Emit to issue room
  emitToIssueRoom(issue._id.toString(), 'issue:statusUpdated', {
    issueId: issue._id, prevStatus, status, changedBy: req.officer.name,
  });

  return success(res, { issue }, 'Status updated');
});

/**
 * PATCH /api/officer/issues/:id/assign
 * Body: { officerId?, department?, note? }
 */
exports.officerAssignIssue = asyncHandler(async (req, res) => {
  const { officerId, department, note } = req.body;
  const issue = await Issue.findById(req.params.id);
  if (!issue || issue.isDeleted) return error(res, 'Issue not found', 404);

  if (officerId)   issue.assignedOfficer    = officerId;
  if (department)  issue.assignedDepartment = department;
  if (issue.status === 'reported' || issue.status === 'acknowledged')
    issue.status = 'assigned';

  issue.statusHistory.push({
    status:    issue.status,
    changedAt: new Date(),
    changedByModel: 'Officer',
    changedBy: req.officer._id,
    note:      note || `Assigned to ${department || 'officer'}`,
  });
  await issue.save();

  // Notify assigned officer
  if (officerId) {
    await notifyNewAssignment({
      officerId,
      issueId:    issue._id,
      issueTitle: issue.title,
      workOrderId: issue.workOrder,
    });
  }

  // Emit to department room
  if (department) {
    emitToDepartment(department, 'issue:assigned', {
      issueId: issue._id, title: issue.title, department,
    });
  }

  // Emit to issue room
  emitToIssueRoom(issue._id.toString(), 'issue:assigned', {
    issueId: issue._id, officerId, department,
  });

  // Notify citizen
  await notifyStatusChange({
    userId:     issue.createdBy,
    issueId:    issue._id,
    issueTitle: issue.title,
    newStatus:  issue.status,
  });

  return success(res, { issue }, 'Issue assigned');
});

/**
 * POST /api/officer/issues/:id/notes
 * Add an internal officer note.
 * Body: { text }
 */
exports.officerAddNote = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return error(res, 'Note text is required', 400);

  const issue = await Issue.findById(req.params.id);
  if (!issue || issue.isDeleted) return error(res, 'Issue not found', 404);

  issue.internalNotes.push({ text, author: req.officer._id });
  await issue.save();

  return success(res, { note: issue.internalNotes.at(-1) }, 'Note added');
});

/**
 * PATCH /api/officer/issues/:id/priority
 * Body: { priority }
 * Supports: client-officer's overridePriority(id, priority)
 */
exports.officerSetPriority = asyncHandler(async (req, res) => {
  const { priority } = req.body;
  const VALID = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  if (!VALID.includes(priority)) return error(res, `Priority must be one of: ${VALID.join(', ')}`, 400);

  const issue = await Issue.findByIdAndUpdate(
    req.params.id,
    { priority },
    { new: true }
  );
  if (!issue) return error(res, 'Issue not found', 404);
  return success(res, { issue }, 'Priority updated');
});

/**
 * GET /api/officer/issues/prioritized
 * Returns issues ranked by score (upvoteCount + daysOpen + priority weight).
 * Mirrors: client-officer's getPrioritizedIssues()
 */
exports.officerGetPrioritized = asyncHandler(async (req, res) => {
  const issues = await Issue.find({ isDeleted: false, status: { $nin: ['resolved', 'rejected'] } })
    .select('title category status priority upvoteCount createdAt aiMeta')
    .lean();

  const PRIORITY_WEIGHT = { CRITICAL: 40, HIGH: 20, MEDIUM: 10, LOW: 0 };
  const now = Date.now();

  const ranked = issues.map(i => {
    const daysOpen = Math.floor((now - new Date(i.createdAt)) / 86400000);
    const score    = (i.aiMeta?.priorityScore ?? 0)
                   + (PRIORITY_WEIGHT[i.priority] || 0)
                   + i.upvoteCount * 2
                   + daysOpen;
    return { ...i, score, daysOpen };
  }).sort((a, b) => b.score - a.score);

  return success(res, { issues: ranked });
});

/**
 * GET /api/officer/duplicates
 * Find duplicate groups (by AI meta or proximity matching).
 * Supports: client-officer's getDuplicateGroups()
 */
exports.officerGetDuplicates = asyncHandler(async (req, res) => {
  const withDupMeta = await Issue.find({
    'aiMeta.duplicateOf': { $ne: null },
    isDeleted: false,
  }).populate('aiMeta.duplicateOf', 'title').lean();

  // Group by primary
  const groups = {};
  for (const issue of withDupMeta) {
    const primaryId = issue.aiMeta.duplicateOf._id.toString();
    if (!groups[primaryId]) {
      groups[primaryId] = { primaryIssueId: primaryId, duplicates: [] };
    }
    groups[primaryId].duplicates.push({
      _id:        issue._id,
      title:      issue.title,
      reportedBy: issue.createdBy,
      createdAt:  issue.createdAt,
      upvotes:    issue.upvoteCount,
    });
  }

  return success(res, { groups: Object.values(groups) });
});

/**
 * POST /api/officer/duplicates/merge
 * Body: { primaryId, dupIds[] }
 * Supports: client-officer's mergeDuplicates()
 */
exports.officerMergeDuplicates = asyncHandler(async (req, res) => {
  const { primaryId, dupIds } = req.body;
  if (!primaryId || !Array.isArray(dupIds) || dupIds.length === 0)
    return error(res, 'primaryId and dupIds[] are required', 400);

  await Issue.updateMany(
    { _id: { $in: dupIds } },
    { $set: { 'aiMeta.duplicateOf': primaryId, isDeleted: true } }
  );

  return success(res, { primaryId, mergedCount: dupIds.length }, 'Duplicates merged');
});

/**
 * POST /api/officer/issues/:id/investigate  (AI stub)
 * Supports: client-officer's triggerAnalysis(issueId)
 */
exports.officerInvestigate = asyncHandler(async (req, res) => {
  const { runAIInvestigation } = require('../services/aiService');
  const result = await runAIInvestigation(req.params.id);
  return success(res, { result }, 'Investigation triggered');
});

/**
 * GET /api/officer/ai/findings
 * Returns AI meta for all recent issues.
 * Supports: client-officer's getFindings()
 */
exports.officerGetAIFindings = asyncHandler(async (req, res) => {
  const issues = await Issue.find({
    'aiMeta.summary': { $ne: null },
    isDeleted: false,
  })
    .select('title category aiMeta createdAt')
    .sort('-createdAt')
    .limit(20)
    .lean();

  const findings = issues.map(i => ({
    _id:             i._id,
    issueId:         i._id,
    category:        i.category,
    severity:        i.priority || 'MEDIUM',
    summary:         i.aiMeta?.summary,
    confidence:      i.aiMeta?.confidence,
    suggestedAction: i.aiMeta?.suggestedAction,
    createdAt:       i.createdAt,
  }));

  return success(res, { findings });
});
