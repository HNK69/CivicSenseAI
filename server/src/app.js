require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const path    = require('path');

const { citizenAuthRouter, officerAuthRouter, contractorAuthRouter } = require('./routes/authRoutes');
const { citizenIssueRouter, officerIssueRouter } = require('./routes/issueRoutes');
const officerRoutes      = require('./routes/officerRoutes');
const { officerContractorRouter, contractorPortalRouter } = require('./routes/contractorRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

/* ---- CORS ---- */
const allowedOrigins = [
  process.env.CLIENT_USER_URL    || 'http://localhost:3000',
  process.env.CLIENT_OFFICER_URL || 'http://localhost:5173',
];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (e.g. curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

/* ---- Body parsers ---- */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ---- Logger (dev mode only) ---- */
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

/* ---- Static uploads (local dev fallback when Cloudinary is not configured) ---- */
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

/* ====================================================================
   API ROUTES
   ==================================================================== */

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- Citizen auth ----
app.use('/api/auth', citizenAuthRouter);

// ---- Officer auth ----
app.use('/api/officer/auth', officerAuthRouter);

// ---- Contractor auth ----
app.use('/api/contractor/auth', contractorAuthRouter);

// ---- Citizen issues ----
app.use('/api/issues', citizenIssueRouter);

// ---- Officer issues ----
app.use('/api/officer/issues', officerIssueRouter);

// ---- Officer management, work orders, repairs, stats, copilot, duplicates ----
app.use('/api/officer', officerRoutes);

// ---- Officer contractor management ----
app.use('/api/officer/contractors', officerContractorRouter);

// ---- Contractor Portal ----
app.use('/api/contractor', contractorPortalRouter);

// ---- Notifications (role-aware — citizen + officer + contractor) ----
app.use('/api/notifications', notificationRoutes);

/* ====================================================================
   ERROR HANDLING — MUST be last
   ==================================================================== */
app.use(notFound);
app.use(errorHandler);

module.exports = app;
