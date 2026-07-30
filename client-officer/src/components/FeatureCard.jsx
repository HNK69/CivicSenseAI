import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * FeatureCard — Officer dashboard module card with motion.
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
  accentColor = 'rgba(37,99,235,0.08)',
}) {
  return (
    <motion.div
      style={{ height: '100%' }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
    >
      <div className="card scr-card scr-feature-card h-100" style={{ overflow: 'hidden' }}>
        <div className="card-body d-flex flex-column gap-3 p-4">
          {/* Header */}
          <div className="d-flex align-items-start justify-content-between">
            <div className="card-icon" style={{ background: accentColor }}>
              <i className={`bi ${icon}`} />
            </div>
            {badgeText && (
              <span className={`badge ${badgeClass}`} style={{ fontSize: '.7rem', borderRadius: 6 }}>
                {badgeText}
              </span>
            )}
          </div>

          {/* Content */}
          <div>
            <p className="card-title mb-1">{title}</p>
            <div className="card-stat">{stats}</div>
            {subStats && <small style={{ color: 'var(--o-text-3)', fontSize: '.78rem' }}>{subStats}</small>}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid var(--o-border)',
            padding: '10px 20px 14px',
          }}
        >
          <Link
            to={footerLink}
            className="btn btn-sm btn-primary w-100 fw-semibold"
            style={{ fontSize: '.82rem' }}
          >
            {footerText} <i className="bi bi-arrow-right ms-1" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export default FeatureCard;
