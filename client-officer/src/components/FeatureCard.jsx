import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * FeatureCard — Generic reusable Bootstrap Card used on the Dashboard.
 *
 * Props:
 *   icon         {string}  Bootstrap icon class, e.g. 'bi-map'
 *   title        {string}  Card label, e.g. 'Issue Dashboard'
 *   stats        {string}  Primary stat value, e.g. '142 Open'
 *   subStats     {string}  Optional secondary line, e.g. '12 Critical'
 *   badgeText    {string}  Optional badge text
 *   badgeClass   {string}  Bootstrap badge class, e.g. 'bg-danger'
 *   footerText   {string}  Footer button label
 *   footerLink   {string}  React Router path for footer button
 *   accentColor  {string}  CSS color for icon background accent
 */
function FeatureCard({
  icon        = 'bi-grid',
  title       = 'Feature',
  stats       = '—',
  subStats    = '',
  badgeText   = '',
  badgeClass  = 'bg-secondary',
  footerText  = 'View Details',
  footerLink  = '#',
  accentColor = 'rgba(10,61,98,0.08)',
}) {
  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
      style={{ height: '100%' }}
    >
      <div className="card scr-card scr-feature-card h-100">
        <div className="card-body d-flex flex-column gap-3 p-4">
          {/* Header row: icon + badge */}
          <div className="d-flex align-items-start justify-content-between">
            <div className="card-icon" style={{ background: accentColor }}>
              <i className={`bi ${icon}`}></i>
            </div>
            {badgeText && (
              <span className={`badge ${badgeClass}`} style={{ fontSize: '0.72rem', padding: '5px 8px' }}>
                {badgeText}
              </span>
            )}
          </div>

          {/* Title + stat */}
          <div>
            <p className="card-title mb-1">{title}</p>
            <div className="card-stat">{stats}</div>
            {subStats && <small className="text-muted" style={{ fontSize: '0.8rem' }}>{subStats}</small>}
          </div>
        </div>

        {/* Footer link */}
        <div className="card-footer bg-transparent border-top pt-2 pb-3 px-4">
          <Link to={footerLink} className="btn btn-sm btn-outline-primary w-100">
            {footerText} <i className="bi bi-arrow-right ms-1"></i>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export default FeatureCard;
