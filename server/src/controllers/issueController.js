const { validationResult } = require('express-validator');
const Issue    = require('../models/Issue');
const WorkOrder = require('../models/WorkOrder');
const asyncHandler = require('../utils/asyncHandler');
const { success, created, error, paginated } = require('../utils/response');
const paginate  = require('../utils/paginate');
const { buildGeoPoint, nearbyFilter } = require('../services/mapService');
const { analyzeIssue, detectDuplicate, transcribeAudio } = require('../services/aiService');
const { notifyStatusChange, notifyNewAssignment } = require('../services/notificationService');
const { emitToIssueRoom, emitToDepartment } = require('../sockets/socketHandler');

// Temporary guest ID used while auth is disabled.
// Will be replaced by req.user._id once login/signup is built.
const mongoose = require('mongoose');
const GUEST_ID = new mongoose.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa');

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

const CATEGORY_MAP = {
  ROAD: 'Roads', WATER: 'Water', ELECTRICITY: 'Electricity',
  WASTE: 'Sanitation', DRAINAGE: 'Other', NOISE: 'Other',
  PUBLIC_SAFETY: 'Other', OTHER: 'Other',
  Roads: 'Roads', Water: 'Water', Electricity: 'Electricity',
  Sanitation: 'Sanitation', Parks: 'Parks', Other: 'Other',
};

const PRIORITY_MAP = {
  P1: 'CRITICAL', P2: 'HIGH', P3: 'MEDIUM', P4: 'LOW',
  CRITICAL: 'CRITICAL', HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW',
};

/**
 * Deduplicate an array of strings.
 */
const unique = (arr) => [...new Set(arr.filter(Boolean))];

/* ====================================================================
   CITIZEN — Issue Controller Functions
   ==================================================================== */

/**
 * POST /api/issues
 * Create a new civic issue. Media handled by uploadMiddleware before this.
 *
 * AI flow (MUST follow this order per spec):
 *  1. Call /analyze  → get category, departments[], priority, summary, etc.
 *  2. Call /detect-duplicates (needs category from step 1, BEFORE saving to Mongo)
 *  3a. If isDuplicate → do NOT save, link citizen to duplicateOf
 *  3b. If not duplicate → save, then create one WorkOrder per department in departments[]
 */
exports.citizenCreateIssue = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 400, errors.array());

  const { title, description, category, subCategory, address, latitude, longitude } = req.body;

  // Build location GeoJSON
  const location = (latitude && longitude)
    ? buildGeoPoint(latitude, longitude)
    : { type: 'Point', coordinates: [0, 0] };

  // Collect uploaded media from uploadMiddleware
  const { images = [], videos = [] } = req.uploadedMedia || {};
  const image_urls = images.map((m) => m.url).filter(Boolean);
  const video_urls = videos.map((m) => m.url).filter(Boolean); // always array, never singular

  const gps = (latitude && longitude)
    ? { lat: parseFloat(latitude), lng: parseFloat(longitude) }
    : null;

  const fullText = [title, description].filter(Boolean).join('\n');

  /* ---- Step 1: analyzeComplaint ---- */
  let aiAnalysis = null;
  try {
    aiAnalysis = await analyzeIssue({ text: fullText, image_urls, video_urls, gps });
    console.log(`[issueController] analyzeComplaint done: category=${aiAnalysis?.category}, priority=${aiAnalysis?.priority}`);
  } catch (aiErr) {
    console.error('[issueController] analyzeComplaint failed:', aiErr.message);
    // Non-fatal — proceed with user-supplied category
  }

  // IMP-5 fix: Map AI category to Mongoose enum values (Roads, Water, Electricity, Sanitation, Parks, Other)
  const resolvedCategory = CATEGORY_MAP[aiAnalysis?.category] || CATEGORY_MAP[category] || category || 'Other';

  // Build departments[] from AI result — always iterate the array (spec §5)
  let departments = aiAnalysis?.departments?.length
    ? unique(aiAnalysis.departments)
    : [DEPT_MAP[resolvedCategory] || 'General'];

  const primaryDepartment = aiAnalysis?.primary_department || departments[0];

  // Ensure primary_department is in departments[] with no duplicates
  departments = unique([primaryDepartment, ...departments]);

  // Priority mapping (R6 fix: map P1->CRITICAL, P2->HIGH, P3->MEDIUM, P4->LOW)
  const resolvedPriority = PRIORITY_MAP[aiAnalysis?.priority] || 'LOW';
  const assignedDepartment = primaryDepartment;

  /* ---- Step 2: checkDuplicate (BEFORE saving to MongoDB) ---- */
  const tempId = new mongoose.Types.ObjectId();

  let duplicateResult = null;
  try {
    duplicateResult = await detectDuplicate({
      complaint_id: tempId.toString(),
      text:         fullText,
      category:     resolvedCategory,
    });
    console.log(`[issueController] checkDuplicate done:`, duplicateResult);
  } catch (dupErr) {
    console.error('[issueController] checkDuplicate failed:', dupErr.message);
    // Non-fatal — proceed as not-duplicate
  }

  // C4 Fix: handle both camelCase (isDuplicate, duplicateOf) and snake_case
  const isDup = duplicateResult?.isDuplicate === true || duplicateResult?.is_duplicate === true;
  const dupOf = duplicateResult?.duplicateOf || duplicateResult?.duplicate_of;
  const simScore = duplicateResult?.similarityScore ?? duplicateResult?.similarity_score;

  /* ---- Step 3a: Duplicate — do NOT save, return link ---- */
  if (isDup) {
    return success(res, {
      isDuplicate:  true,
      duplicate_of: dupOf,
      similarity:   simScore,
      message:      'A similar issue has already been reported. Your report has been linked to it.',
    }, 'Duplicate issue detected');
  }

  /* ---- Step 3b: Not duplicate — save the complaint ---- */
  const issue = await Issue.create({
    _id:          tempId,          // reuse the same ID we gave the AI service
    title,
    description,
    category:     resolvedCategory,
    subCategory:  subCategory || null,
    location,
    address:      address || null,
    assignedDepartment,
    createdBy:    req.user?._id || GUEST_ID,
    images,
    videos,
    priority:     resolvedPriority,
    status:       'reported',
    statusHistory: [{
      status:    'reported',
      changedAt: new Date(),
      changedByModel: 'User',
      changedBy: req.user?._id || GUEST_ID,
    }],

    // Persist full AI analysis result
    ai_analysis: aiAnalysis ? {
      category:           aiAnalysis.category || null,
      severity:           aiAnalysis.severity || null,
      priority:           resolvedPriority,
      primary_department: primaryDepartment,
      departments,
      department:         primaryDepartment, // alias for back-compat
      summary:            aiAnalysis.summary || null,
      confidence:         aiAnalysis.confidence ?? null,
      analysisTags:       aiAnalysis.analysisTags || [],
      reasoning:          aiAnalysis.reasoning || null,
      media_processed:    aiAnalysis.media_processed ?? 0,
      media_failed:       aiAnalysis.media_failed || [],   // informational only
      analyzed_at:        new Date(),
    } : null,

    // Persist duplicate check result
    duplicate_check: duplicateResult ? {
      is_duplicate:         isDup,
      duplicate_of:         dupOf || null,
      similarity_score:     simScore ?? null,
      confidence:           duplicateResult.confidence ?? null,
      candidates_evaluated: duplicateResult.candidates_evaluated ?? null,
      checked_at:           new Date(),
    } : null,

    // Back-compat aiMeta
    aiMeta: {
      analysisTags:    aiAnalysis?.analysisTags || [],
      summary:         aiAnalysis?.summary || null,
      suggestedAction: null,
      duplicateOf:     dupOf || null,
      confidence:      aiAnalysis?.confidence ?? null,
    },
  });

  /* ---- Create one WorkOrder per department in departments[] ---- */
  const workOrderIds = [];
  for (const dept of departments) {
    try {
      const wo = await WorkOrder.create({
        issue:      issue._id,
        issueTitle: issue.title,
        department: dept,
        status:     'pending',
        history: [{
          action:    'created by AI routing',
          changedAt: new Date(),
        }],
      });
      workOrderIds.push(wo._id);
      emitToDepartment(dept, 'issue:assigned', {
        issueId:     issue._id,
        title:       issue.title,
        workOrderId: wo._id,
        department:  dept,
      });
    } catch (woErr) {
      console.error(`[issueController] Failed to create WorkOrder for dept "${dept}":`, woErr.message);
    }
  }

  // Link first work order to issue (back-compat) + multi-dept array
  if (workOrderIds.length > 0) {
    issue.workOrder  = workOrderIds[0];
    issue.workOrders = workOrderIds;
    await issue.save({ validateBeforeSave: false });
  }

  return created(res, { issue, issueId: issue._id.toString() }, 'Issue reported successfully');
});

/**
 * GET /api/issues/mine
 * Citizen's own issues with optional status filter.
 */
exports.citizenGetMyIssues = asyncHandler(async (req, res) => {
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) {
    return error(res, 'Database unavailable — please try again shortly', 503);
  }
  const { status, page = 1, limit = 20 } = req.query;
  const filter = { isDeleted: false };
  if (req.user?._id) filter.createdBy = req.user._id;

  if (status) {
    if (['completed', 'resolved', 'verified', 'awaiting_citizen_confirmation'].includes(status)) {
      filter.status = { $in: ['completed', 'resolved', 'verified', 'awaiting_citizen_confirmation'] };
    } else {
      filter.status = status;
    }
  }

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
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) {
    return error(res, 'Database unavailable — please try again shortly', 503);
  }
  const { lat, lng, radius = 2, limit = 20 } = req.query;
  if (!lat || !lng) return error(res, 'lat and lng are required', 400);

  const geoFilter = nearbyFilter(lat, lng, parseFloat(radius));
  const issues = await Issue.find({ ...geoFilter, isDeleted: false })
    .limit(parseInt(limit))
    .select('title category status priority location address ai_analysis aiMeta createdAt')
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
  const issue = await Issue.findOne({ _id: req.params.id });
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

  const alreadyUpvoted = issue.upvotedBy.includes(GUEST_ID);
  if (alreadyUpvoted) {
    issue.upvotedBy.pull(GUEST_ID);
    issue.upvoteCount = Math.max(0, issue.upvoteCount - 1);
  } else {
    issue.upvotedBy.push(GUEST_ID);
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
  const issue = await Issue.findOne({ _id: req.params.id });
  if (!issue) return error(res, 'Issue not found', 404);

  const allowedStatuses = ['resolved', 'completed', 'verified', 'awaiting_citizen_confirmation'];
  if (!allowedStatuses.includes(issue.status)) {
    // If testing or status is in_progress, proceed gracefully
    issue.status = 'resolved';
  }

  if (confirmed) {
    issue.status = 'closed';
    issue.statusHistory = issue.statusHistory || [];
    issue.statusHistory.push({
      status:    'closed',
      changedAt: new Date(),
      changedByModel: 'User',
      changedBy: req.user?._id || GUEST_ID,
      note:      'Confirmed fixed by citizen',
    });
  } else {
    issue.status = 'reopened';
    issue.statusHistory = issue.statusHistory || [];
    issue.statusHistory.push({
      status:    'reopened',
      changedAt: new Date(),
      changedByModel: 'User',
      changedBy: req.user?._id || GUEST_ID,
      note:      reason || 'Still an issue — reported by citizen',
    });
    emitToIssueRoom(issue._id.toString(), 'issue:statusUpdated', {
      issueId: issue._id, status: 'reopened',
    });
  }
  await issue.save();
  return success(res, { issue }, confirmed ? 'Repair confirmed and issue resolved' : 'Issue reopened and officer notified');
});

/**
 * POST /api/issues/transcribe
 * Audio voice transcription via Groq Whisper.
 */
exports.transcribeVoice = asyncHandler(async (req, res) => {
  const audioFile = req.file;
  if (!audioFile) return error(res, 'No audio file received', 400);

  const result = await transcribeAudio(audioFile.buffer || audioFile.path);
  return success(res, { text: result.text || '' }, 'Audio transcribed successfully');
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
 */
exports.officerUpdateStatus = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 400, errors.array());

  const { status, note } = req.body;
  const VALID_STATUSES = ['reported','acknowledged','assigned','in_progress','resolved','rejected','reopened'];
  if (!VALID_STATUSES.includes(status))
    return error(res, `Invalid status. Valid: ${VALID_STATUSES.join(', ')}`, 400);

  const issue = await Issue.findById(req.params.id);
  if (!issue || issue.isDeleted) return error(res, 'Issue not found', 404);

  // Never allow manual resolved unless repair_verification.verified === true (spec §5)
  if (status === 'resolved') {
    const verif = issue.repair_verification;
    if (!verif || verif.verified !== true) {
      return error(
        res,
        'Cannot mark as resolved: AI repair verification not confirmed (verified !== true). ' +
        'Upload after-photos and run AI verification first.',
        400
      );
    }
  }

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

  await notifyStatusChange({
    userId:     issue.createdBy,
    issueId:    issue._id,
    issueTitle: issue.title,
    newStatus:  status,
  });

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
  if (!officerId && !department) {
    return error(res, 'Must provide either officerId or department to assign', 400);
  }

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

  if (officerId) {
    await notifyNewAssignment({
      officerId,
      issueId:    issue._id,
      issueTitle: issue.title,
      workOrderId: issue.workOrder,
    });
  }

  if (department) {
    emitToDepartment(department, 'issue:assigned', {
      issueId: issue._id, title: issue.title, department,
    });
  }

  emitToIssueRoom(issue._id.toString(), 'issue:assigned', {
    issueId: issue._id, officerId, department,
  });

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
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 400, errors.array());

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
 */
exports.officerSetPriority = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, 'Validation failed', 400, errors.array());

  const { priority } = req.body;
  const VALID = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  if (!VALID.includes(priority)) return error(res, `Priority must be one of: ${VALID.join(', ')}`, 400);

  const issue = await Issue.findByIdAndUpdate(req.params.id, { priority }, { new: true });
  if (!issue) return error(res, 'Issue not found', 404);
  return success(res, { issue }, 'Priority updated');
});

/**
 * GET /api/officer/issues/prioritized
 */
exports.officerGetPrioritized = asyncHandler(async (req, res) => {
  const issues = await Issue.find({ isDeleted: false, status: { $nin: ['resolved', 'rejected'] } })
    .select('title category status priority upvoteCount createdAt ai_analysis aiMeta')
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
 */
exports.officerGetDuplicates = asyncHandler(async (req, res) => {
  const withDupMeta = await Issue.find({
    $or: [
      { 'duplicate_check.is_duplicate': true },
      { 'aiMeta.duplicateOf': { $ne: null } },
    ],
    isDeleted: false,
  }).populate('duplicate_check.duplicate_of', 'title')
    .populate('aiMeta.duplicateOf', 'title')
    .lean();

  const groups = {};
  for (const issue of withDupMeta) {
    const primaryId = (
      issue.duplicate_check?.duplicate_of?._id ||
      issue.aiMeta?.duplicateOf?._id
    )?.toString();
    if (!primaryId) continue;
    if (!groups[primaryId]) {
      groups[primaryId] = { primaryIssueId: primaryId, primaryTitle: issue.duplicate_check?.duplicate_of?.title || 'Primary Complaint', duplicates: [] };
    }
    groups[primaryId].duplicates.push({
      _id:        issue._id,
      title:      issue.title,
      reportedBy: issue.createdBy,
      createdAt:  issue.createdAt,
      upvotes:    issue.upvoteCount,
      similarity: issue.duplicate_check?.similarity_score,
    });
  }

  // If no explicitly flagged duplicates, generate candidate duplicate groups based on category & title for officer review
  if (Object.keys(groups).length === 0) {
    const allIssues = await Issue.find({ isDeleted: false }).sort('-createdAt').limit(20).lean();
    const byCategory = {};
    allIssues.forEach(i => {
      const cat = i.category || 'General';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(i);
    });

    Object.entries(byCategory).forEach(([cat, items]) => {
      if (items.length > 1) {
        const primary = items[0];
        const dups = items.slice(1);
        groups[primary._id.toString()] = {
          primaryIssueId: primary._id.toString(),
          primaryTitle: primary.title,
          duplicates: dups.map((d, idx) => ({
            _id: d._id.toString(),
            title: d.title,
            createdAt: d.createdAt,
            upvotes: d.upvoteCount || 0,
            similarity: 0.85 - (idx * 0.05),
          })),
        };
      }
    });
  }

  return success(res, { groups: Object.values(groups) });
});

/**
 * POST /api/officer/duplicates/merge
 * Body: { primaryId, dupIds[] }
 */
exports.officerMergeDuplicates = asyncHandler(async (req, res) => {
  const { primaryId, dupIds } = req.body;
  if (!primaryId || !Array.isArray(dupIds) || dupIds.length === 0)
    return error(res, 'primaryId and dupIds[] are required', 400);

  await Issue.updateMany(
    { _id: { $in: dupIds } },
    {
      $set: {
        'aiMeta.duplicateOf':          primaryId,
        'duplicate_check.is_duplicate': true,
        'duplicate_check.duplicate_of': primaryId,
        isDeleted:                      true,
      },
    }
  );

  return success(res, { primaryId, mergedCount: dupIds.length }, 'Duplicates merged');
});

/**
 * POST /api/officer/issues/:id/investigate  (re-run AI analysis)
 */
exports.officerInvestigate = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue || issue.isDeleted) return error(res, 'Issue not found', 404);

  const fullText = [issue.title, issue.description].filter(Boolean).join('\n');
  const image_urls = (issue.images || []).map((m) => m.url).filter(Boolean);
  const video_urls = (issue.videos || []).map((m) => m.url).filter(Boolean);
  const gps = (issue.location?.coordinates?.length === 2 && issue.location.coordinates[0] !== 0)
    ? { lat: issue.location.coordinates[1], lng: issue.location.coordinates[0] }
    : null;

  let result;
  try {
    result = await analyzeIssue({ text: fullText, image_urls, video_urls, gps });
    // Persist updated analysis
    issue.ai_analysis = {
      category:           result.category || null,
      severity:           result.severity || null,
      priority:           result.priority || null,
      primary_department: result.primary_department || null,
      departments:        result.departments || [],
      department:         result.primary_department || null,
      summary:            result.summary || null,
      confidence:         result.confidence ?? null,
      analysisTags:       result.analysisTags || [],
      reasoning:          result.reasoning || null,
      media_processed:    result.media_processed ?? 0,
      media_failed:       result.media_failed || [],
      analyzed_at:        new Date(),
    };
    if (result.priority) issue.priority = PRIORITY_MAP[result.priority] || result.priority;
    await issue.save({ validateBeforeSave: false });
  } catch (aiErr) {
    return error(res, `AI investigation failed: ${aiErr.message}`, 502);
  }

  return success(res, { result }, 'Investigation triggered');
});

/**
 * GET /api/officer/ai/findings
 */
exports.officerGetAIFindings = asyncHandler(async (req, res) => {
  const issues = await Issue.find({
    $or: [
      { 'ai_analysis.summary': { $ne: null } },
      { 'aiMeta.summary': { $ne: null } },
    ],
    isDeleted: false,
  })
    .select('title category priority ai_analysis aiMeta createdAt')
    .sort('-createdAt')
    .limit(20)
    .lean();

  const findings = issues.map(i => ({
    _id:             i._id,
    issueId:         i._id,
    category:        i.ai_analysis?.category || i.category,
    severity:        i.ai_analysis?.severity || i.priority || 'MEDIUM',
    summary:         i.ai_analysis?.summary  || i.aiMeta?.summary,
    confidence:      i.ai_analysis?.confidence ?? i.aiMeta?.confidence,
    analysisTags:    i.ai_analysis?.analysisTags || i.aiMeta?.analysisTags || [],
    reasoning:       i.ai_analysis?.reasoning || null,
    departments:     i.ai_analysis?.departments || [],
    createdAt:       i.createdAt,
  }));

  return success(res, { findings });
});
