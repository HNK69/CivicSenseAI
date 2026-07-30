import React from 'react';
import FeatureCard from '../components/FeatureCard.jsx';

/**
 * Dashboard — home page showing all 8 feature cards in a responsive grid.
 * Each card's data is defined in DASHBOARD_CARDS — update stats here (or via API later).
 * No separate card component per feature — all rendered via the reusable FeatureCard.
 */

const DASHBOARD_CARDS = [
  {
    icon:        'bi-robot',
    title:       'AI Investigation',
    stats:       '3 Findings',
    subStats:    '2 require action',
    badgeText:   'AI',
    badgeClass:  'bg-primary',
    footerText:  'View Findings',
    footerLink:  '/ai-investigation',
    accentColor: 'rgba(52,152,219,0.12)',
  },
  {
    icon:        'bi-map',
    title:       'Issue Dashboard',
    stats:       '142 Issues',
    subStats:    '38 Open · 12 Critical',
    badgeText:   '12 Critical',
    badgeClass:  'bg-danger',
    footerText:  'Open Dashboard',
    footerLink:  '/issues',
    accentColor: 'rgba(192,57,43,0.10)',
  },
  {
    icon:        'bi-files',
    title:       'Duplicate Merge',
    stats:       '2 Groups',
    subStats:    '3 duplicates pending',
    badgeText:   'Pending',
    badgeClass:  'bg-warning text-dark',
    footerText:  'Review Duplicates',
    footerLink:  '/duplicates',
    accentColor: 'rgba(230,126,34,0.10)',
  },
  {
    icon:        'bi-sort-down',
    title:       'Smart Priority',
    stats:       '5 Ranked',
    subStats:    '1 Critical at top',
    badgeText:   'AI Ranked',
    badgeClass:  'bg-success',
    footerText:  'View Rankings',
    footerLink:  '/priority',
    accentColor: 'rgba(39,174,96,0.10)',
  },
  {
    icon:        'bi-person-check',
    title:       'Assign Work',
    stats:       '4 Orders',
    subStats:    '2 Pending assignment',
    badgeText:   '2 Pending',
    badgeClass:  'bg-warning text-dark',
    footerText:  'Manage Assignments',
    footerLink:  '/assign-work',
    accentColor: 'rgba(142,68,173,0.10)',
  },
  {
    icon:        'bi-camera',
    title:       'Repair Verification',
    stats:       '3 Repairs',
    subStats:    '2 awaiting verification',
    badgeText:   '2 Pending',
    badgeClass:  'bg-info text-dark',
    footerText:  'Verify Repairs',
    footerLink:  '/repair-verification',
    accentColor: 'rgba(23,162,184,0.10)',
  },
  {
    icon:        'bi-star',
    title:       'Contractor Performance',
    stats:       '5 Contractors',
    subStats:    '1 Flagged',
    badgeText:   '1 Flagged',
    badgeClass:  'bg-danger',
    footerText:  'View Ratings',
    footerLink:  '/contractor-performance',
    accentColor: 'rgba(231,76,60,0.10)',
  },
  {
    icon:        'bi-chat-dots',
    title:       'Municipal Copilot',
    stats:       'AI Ready',
    subStats:    'Ask anything about civic data',
    badgeText:   'Beta',
    badgeClass:  'bg-secondary',
    footerText:  'Open Copilot',
    footerLink:  '/copilot',
    accentColor: 'rgba(10,61,98,0.08)',
  },
];

function Dashboard() {
  return (
    <div>
      {/* Page header */}
      <div className="scr-page-header">
        <h1>Officer Dashboard</h1>
        <p>Smart Civic Reporter — All module overview</p>
      </div>

      {/* Summary stat strip */}
      <div className="row g-3 mb-4">
        {[
          { label: 'Total Issues',   value: '142', icon: 'bi-exclamation-circle-fill', color: '#c0392b' },
          { label: 'Resolved Today', value: '8',   icon: 'bi-check-circle-fill',       color: '#27ae60' },
          { label: 'In Progress',    value: '23',  icon: 'bi-arrow-clockwise',         color: '#e67e22' },
          { label: 'Work Orders',    value: '4',   icon: 'bi-clipboard-check-fill',    color: '#0a3d62' },
        ].map((s) => (
          <div className="col-6 col-lg-3" key={s.label}>
            <div className="card scr-card p-3 d-flex flex-row align-items-center gap-3">
              <i className={`bi ${s.icon}`} style={{ fontSize: '1.8rem', color: s.color }}></i>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.78rem', color: '#6c757d' }}>{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Feature cards grid — 3 cols on lg, 2 on md */}
      <div className="row g-4">
        {DASHBOARD_CARDS.map((card) => (
          <div className="col-lg-4 col-md-6" key={card.footerLink}>
            <FeatureCard {...card} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
