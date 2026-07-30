import React, { useEffect, useState } from 'react';
import FeatureCard from '../components/FeatureCard.jsx';
import api from '../services/api.js';

/**
 * Dashboard — home page showing all 8 feature cards in a responsive grid.
 * Stats are dynamically fetched from the live backend API (/api/officer/stats).
 */

function Dashboard() {
  const [stats, setStats] = useState({
    totalIssues: 0,
    openIssues: 0,
    inProgressIssues: 0,
    resolvedToday: 0,
    criticalIssues: 0,
    workOrders: 0,
    pendingVerifications: 0,
    flaggedContractors: 0,
    aiFindings: 0,
    duplicateGroups: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchStats() {
      try {
        const res = await api.get('/officer/stats');
        const data = res?.data || res || {};
        if (isMounted) {
          setStats({
            totalIssues: data.totalIssues || 0,
            openIssues: data.openIssues || 0,
            inProgressIssues: data.inProgressIssues || 0,
            resolvedToday: data.resolvedToday || 0,
            criticalIssues: data.criticalIssues || 0,
            workOrders: data.workOrders || 0,
            pendingVerifications: data.pendingVerifications || 0,
            flaggedContractors: data.flaggedContractors || 0,
            aiFindings: data.aiFindings || 0,
            duplicateGroups: data.duplicateGroups || 0,
          });
        }
      } catch (err) {
        console.warn('[Dashboard] Failed to fetch stats:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchStats();
    return () => { isMounted = false; };
  }, []);

  const dashboardCards = [
    {
      icon:        'bi-robot',
      title:       'AI Investigation',
      stats:       `${stats.aiFindings} Findings`,
      subStats:    'Analyzed by AI',
      badgeText:   'AI',
      badgeClass:  'bg-primary',
      footerText:  'View Findings',
      footerLink:  '/ai-investigation',
      accentColor: 'rgba(52,152,219,0.12)',
    },
    {
      icon:        'bi-map',
      title:       'Issue Dashboard',
      stats:       `${stats.totalIssues} Issues`,
      subStats:    `${stats.openIssues} Open · ${stats.criticalIssues} Critical`,
      badgeText:   `${stats.criticalIssues} Critical`,
      badgeClass:  'bg-danger',
      footerText:  'Open Dashboard',
      footerLink:  '/issues',
      accentColor: 'rgba(192,57,43,0.10)',
    },
    {
      icon:        'bi-files',
      title:       'Duplicate Merge',
      stats:       `${stats.duplicateGroups} Groups`,
      subStats:    'Duplicates identified',
      badgeText:   'AI Check',
      badgeClass:  'bg-warning text-dark',
      footerText:  'Review Duplicates',
      footerLink:  '/duplicates',
      accentColor: 'rgba(230,126,34,0.10)',
    },
    {
      icon:        'bi-sort-down',
      title:       'Smart Priority',
      stats:       'AI Ranked',
      subStats:    'Sorted by severity & impact',
      badgeText:   'AI Ranked',
      badgeClass:  'bg-success',
      footerText:  'View Rankings',
      footerLink:  '/priority',
      accentColor: 'rgba(39,174,96,0.10)',
    },
    {
      icon:        'bi-person-check',
      title:       'Assign Work',
      stats:       `${stats.workOrders} Orders`,
      subStats:    'Active work assignments',
      badgeText:   'Work Orders',
      badgeClass:  'bg-warning text-dark',
      footerText:  'Manage Assignments',
      footerLink:  '/assign-work',
      accentColor: 'rgba(142,68,173,0.10)',
    },
    {
      icon:        'bi-camera',
      title:       'Repair Verification',
      stats:       `${stats.pendingVerifications} Pending`,
      subStats:    'Awaiting completion check',
      badgeText:   'Verification',
      badgeClass:  'bg-info text-dark',
      footerText:  'Verify Repairs',
      footerLink:  '/repair-verification',
      accentColor: 'rgba(23,162,184,0.10)',
    },
    {
      icon:        'bi-star',
      title:       'Contractor Performance',
      stats:       `${stats.flaggedContractors} Flagged`,
      subStats:    'Monitored contractors',
      badgeText:   'Performance',
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
      badgeText:   'AI Copilot',
      badgeClass:  'bg-secondary',
      footerText:  'Open Copilot',
      footerLink:  '/copilot',
      accentColor: 'rgba(10,61,98,0.08)',
    },
  ];

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
          { label: 'Total Issues',   value: stats.totalIssues,   icon: 'bi-exclamation-circle-fill', color: '#c0392b' },
          { label: 'Resolved Today', value: stats.resolvedToday, icon: 'bi-check-circle-fill',       color: '#27ae60' },
          { label: 'In Progress',    value: stats.inProgressIssues, icon: 'bi-arrow-clockwise',      color: '#e67e22' },
          { label: 'Work Orders',    value: stats.workOrders,   icon: 'bi-clipboard-check-fill',    color: '#0a3d62' },
        ].map((s) => (
          <div className="col-6 col-lg-3" key={s.label}>
            <div className="card scr-card p-3 d-flex flex-row align-items-center gap-3">
              <i className={`bi ${s.icon}`} style={{ fontSize: '1.8rem', color: s.color }}></i>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>
                  {loading ? '...' : s.value}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#6c757d' }}>{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Feature cards grid — 3 cols on lg, 2 on md */}
      <div className="row g-4">
        {dashboardCards.map((card) => (
          <div className="col-lg-4 col-md-6" key={card.footerLink}>
            <FeatureCard {...card} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
