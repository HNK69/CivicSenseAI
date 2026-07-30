// ─── Department list ─────────────────────────────────────────────────────────
export const DEPARTMENTS = [
  { id: 'PWD',     label: 'Public Works Department' },
  { id: 'WATER',   label: 'Water Supply & Sewage' },
  { id: 'ELEC',    label: 'Electricity Department' },
  { id: 'SANIT',   label: 'Sanitation & Waste Management' },
  { id: 'ROADS',   label: 'Roads & Infrastructure' },
  { id: 'PARKS',   label: 'Parks & Recreation' },
  { id: 'TRAFFIC', label: 'Traffic Management' },
  { id: 'HEALTH',  label: 'Health & Environment' },
];

// ─── Priority levels ──────────────────────────────────────────────────────────
export const PRIORITY_LEVELS = {
  CRITICAL: { label: 'Critical', badgeClass: 'badge bg-danger' },
  HIGH:     { label: 'High',     badgeClass: 'badge bg-warning text-dark' },
  MEDIUM:   { label: 'Medium',   badgeClass: 'badge bg-info text-dark' },
  LOW:      { label: 'Low',      badgeClass: 'badge bg-secondary' },
};

// ─── Issue status labels ──────────────────────────────────────────────────────
export const STATUS_LABELS = {
  OPEN:        { label: 'Open',        badgeClass: 'badge bg-danger',             icon: 'bi-exclamation-circle' },
  IN_PROGRESS: { label: 'In Progress', badgeClass: 'badge bg-warning text-dark',  icon: 'bi-arrow-clockwise' },
  RESOLVED:    { label: 'Resolved',    badgeClass: 'badge bg-success',            icon: 'bi-check-circle' },
  CLOSED:      { label: 'Closed',      badgeClass: 'badge bg-secondary',          icon: 'bi-x-circle' },
  DUPLICATE:   { label: 'Duplicate',   badgeClass: 'badge bg-dark',              icon: 'bi-files' },
};

// ─── Sidebar navigation routes ────────────────────────────────────────────────
export const NAV_ROUTES = [
  { path: '/dashboard',              label: 'Dashboard',               icon: 'bi-grid-1x2-fill' },
  { path: '/ai-investigation',       label: 'AI Investigation',        icon: 'bi-robot' },
  { path: '/issues',                 label: 'Issue Dashboard',         icon: 'bi-map' },
  { path: '/duplicates',             label: 'Duplicate Merge',         icon: 'bi-files' },
  { path: '/priority',               label: 'Smart Priority',          icon: 'bi-sort-down' },
  { path: '/assign-work',            label: 'Assign Work',             icon: 'bi-person-check' },
  { path: '/repair-verification',    label: 'Repair Verification',     icon: 'bi-camera' },
  { path: '/contractor-performance', label: 'Contractor Performance',  icon: 'bi-star' },
  { path: '/copilot',                label: 'Municipal Copilot',       icon: 'bi-chat-dots' },
];

// ─── Theme palette (for reference; primary styling via CSS vars) ──────────────
export const THEME = {
  navyBlue:     '#0a3d62',
  accentGreen:  '#27ae60',
  accentOrange: '#e67e22',
  accentRed:    '#c0392b',
  pageBg:       '#f4f6f9',
};

// ─── City & Location Defaults ───────────────────────────────────────────────────
export const DEFAULT_CITY = 'Ballari';
export const DEFAULT_COORDS = [15.1394, 76.9214]; // Ballari, Karnataka
export const DEFAULT_LOCATION = {
  lat: 15.1394,
  lng: 76.9214,
  address: 'Ballari, Karnataka',
};

