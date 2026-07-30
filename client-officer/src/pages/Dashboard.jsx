import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import FeatureCard from '../components/FeatureCard.jsx';
import api from '../services/api.js';

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
};

function Dashboard() {
  const [stats, setStats] = useState({
    totalIssues: 0, openIssues: 0, inProgressIssues: 0, resolvedToday: 0,
    criticalIssues: 0, workOrders: 0, pendingVerifications: 0,
    flaggedContractors: 0, aiFindings: 0, duplicateGroups: 0,
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
            totalIssues:          data.totalIssues          || 0,
            openIssues:           data.openIssues           || 0,
            inProgressIssues:     data.inProgressIssues     || 0,
            resolvedToday:        data.resolvedToday        || 0,
            criticalIssues:       data.criticalIssues       || 0,
            workOrders:           data.workOrders           || 0,
            pendingVerifications: data.pendingVerifications || 0,
            flaggedContractors:   data.flaggedContractors   || 0,
            aiFindings:           data.aiFindings           || 0,
            duplicateGroups:      data.duplicateGroups      || 0,
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

  const statStrip = [
    { label: 'Total Issues',    value: stats.totalIssues,       icon: 'bi-exclamation-circle-fill', color: 'var(--o-red)',    bg: 'var(--o-red-bg)' },
    { label: 'Resolved Today',  value: stats.resolvedToday,     icon: 'bi-check-circle-fill',       color: 'var(--o-green)',  bg: 'var(--o-green-bg)' },
    { label: 'In Progress',     value: stats.inProgressIssues,  icon: 'bi-arrow-clockwise',         color: 'var(--o-orange)', bg: 'var(--o-orange-bg)' },
    { label: 'Work Orders',     value: stats.workOrders,        icon: 'bi-clipboard-check-fill',    color: 'var(--o-blue)',   bg: 'var(--o-blue-light)' },
  ];

  const dashboardCards = [
    {
      icon: 'bi-robot',        title: 'AI Investigation',
      stats: `${stats.aiFindings} Findings`,   subStats: 'Analyzed by AI',
      badgeText: 'AI',         badgeClass: 'badge-progress',
      footerText: 'View Findings',             footerLink: '/ai-investigation',
      accentColor: 'rgba(37,99,235,.1)',
    },
    {
      icon: 'bi-map',          title: 'Issue Dashboard',
      stats: `${stats.totalIssues} Issues`,    subStats: `${stats.openIssues} Open · ${stats.criticalIssues} Critical`,
      badgeText: `${stats.criticalIssues} Critical`, badgeClass: 'badge-critical',
      footerText: 'Open Dashboard',            footerLink: '/issues',
      accentColor: 'rgba(220,38,38,.1)',
    },
    {
      icon: 'bi-files',        title: 'Duplicate Merge',
      stats: `${stats.duplicateGroups} Groups`, subStats: 'Duplicates identified',
      badgeText: 'AI Check',   badgeClass: 'badge-medium',
      footerText: 'Review Duplicates',         footerLink: '/duplicates',
      accentColor: 'rgba(234,88,12,.1)',
    },
    {
      icon: 'bi-sort-down',    title: 'Smart Priority',
      stats: 'AI Ranked',                      subStats: 'Sorted by severity & impact',
      badgeText: 'AI Ranked',  badgeClass: 'badge-resolved',
      footerText: 'View Rankings',             footerLink: '/priority',
      accentColor: 'rgba(22,163,74,.1)',
    },
    {
      icon: 'bi-person-check', title: 'Assign Work',
      stats: `${stats.workOrders} Orders`,     subStats: 'Active work assignments',
      badgeText: 'Work Orders', badgeClass: 'badge-medium',
      footerText: 'Manage Assignments',        footerLink: '/assign-work',
      accentColor: 'rgba(124,58,237,.1)',
    },
    {
      icon: 'bi-camera',       title: 'Repair Verification',
      stats: `${stats.pendingVerifications} Pending`, subStats: 'Awaiting completion check',
      badgeText: 'Verification', badgeClass: 'badge-progress',
      footerText: 'Verify Repairs',            footerLink: '/repair-verification',
      accentColor: 'rgba(13,148,136,.1)',
    },
    {
      icon: 'bi-star',         title: 'Contractor Performance',
      stats: `${stats.flaggedContractors} Flagged`, subStats: 'Monitored contractors',
      badgeText: 'Performance', badgeClass: 'badge-critical',
      footerText: 'View Ratings',              footerLink: '/contractor-performance',
      accentColor: 'rgba(220,38,38,.1)',
    },
    {
      icon: 'bi-chat-dots',    title: 'Municipal Copilot',
      stats: 'AI Ready',                       subStats: 'Ask anything about civic data',
      badgeText: 'AI Copilot', badgeClass: 'badge-progress',
      footerText: 'Open Copilot',              footerLink: '/copilot',
      accentColor: 'rgba(37,99,235,.08)',
    },
  ];

  return (
    <div>
      {/* ── Page header ── */}
      <motion.div
        className="scr-page-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <h1><i className="bi bi-grid-1x2-fill" />Officer Dashboard</h1>
        <p>CivicSense AI — All module overview and live metrics</p>
      </motion.div>

      {/* ── Stat strip ── */}
      <motion.div
        className="row g-3 mb-4"
        variants={stagger}
        initial="initial"
        animate="animate"
      >
        {statStrip.map(s => (
          <div className="col-6 col-lg-3" key={s.label}>
            <motion.div variants={fadeUp}>
              <div className="scr-stat-card">
                <div className="scr-stat-icon" style={{ background: s.bg }}>
                  <i className={`bi ${s.icon}`} style={{ color: s.color, fontSize: '1.2rem' }} />
                </div>
                <div>
                  <div className="scr-stat-value" style={{ color: s.color }}>
                    {loading ? <span style={{ opacity: .4 }}>–</span> : s.value}
                  </div>
                  <div className="scr-stat-label">{s.label}</div>
                </div>
              </div>
            </motion.div>
          </div>
        ))}
      </motion.div>

      {/* ── Feature cards ── */}
      <motion.div
        className="row g-4"
        variants={stagger}
        initial="initial"
        animate="animate"
      >
        {dashboardCards.map((card) => (
          <motion.div
            className="col-lg-4 col-md-6"
            key={card.footerLink}
            variants={fadeUp}
          >
            <FeatureCard {...card} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

export default Dashboard;
