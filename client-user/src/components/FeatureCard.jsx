import { Card, Button } from 'react-bootstrap';
import { motion } from 'framer-motion';

/**
 * FeatureCard.jsx — Reusable dashboard card.
 *
 * Props:
 *  icon        {string}    Bootstrap icon class e.g. "bi-camera-fill"
 *  iconClass   {string}    Background class e.g. "ci-blue"
 *  title       {string}    Card heading
 *  description {string}    Short description below heading
 *  actionLabel {string}    Primary CTA button text
 *  onAction    {Function}  Called when CTA is clicked
 *  badge       {node}      Optional badge/chip to show next to title
 *  children    {node}      Optional extra content inside card body
 *  footer      {node}      Optional footer below main content
 */
const FeatureCard = ({
  icon,
  iconClass = 'ci-blue',
  title,
  description,
  actionLabel,
  onAction,
  badge,
  children,
  footer,
}) => (
  <motion.div
    style={{ height: '100%' }}
    whileHover={{ y: -3, transition: { duration: 0.18 } }}
    whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
  >
    <Card className="feature-card h-100">
      <Card.Body className="d-flex flex-column gap-3 p-4">
        {/* Header row */}
        <div className="d-flex align-items-center gap-3 min-w-0">
          <div className={`card-icon-wrap ${iconClass}`}>
            <i className={`bi ${icon}`} />
          </div>
          <div className="flex-grow-1 min-w-0">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h2 className="mb-0 fw-bold" style={{ fontSize: '1.02rem', color: '#0f172a' }}>
                {title}
              </h2>
              {badge}
            </div>
            {description && (
              <p className="mb-0 mt-1" style={{ fontSize: '.82rem', color: '#64748b', lineHeight: 1.5 }}>
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Extra content slot */}
        {children && <div className="flex-grow-1 min-w-0" style={{ minWidth: 0 }}>{children}</div>}

        {/* Footer slot */}
        {footer && <div>{footer}</div>}

        {/* Primary CTA */}
        {actionLabel && (
          <Button
            variant="primary"
            className="mt-auto fw-semibold rounded-pill px-4"
            style={{ background: 'var(--civic-blue)', borderColor: 'var(--civic-blue)', fontSize: '.875rem' }}
            onClick={onAction}
            id={`feature-card-btn-${title?.replace(/\s+/g, '-').toLowerCase()}`}
          >
            {actionLabel}
          </Button>
        )}
      </Card.Body>
    </Card>
  </motion.div>
);

export default FeatureCard;
