import { Card, Button } from 'react-bootstrap';
import { motion } from 'framer-motion';

/**
 * FeatureCard.jsx — Reusable dashboard card with motion.
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
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease: 'easeOut' }}
    whileHover={{ y: -3 }}
  >
    <Card className="feature-card h-100">
      <Card.Body className="d-flex flex-column gap-3 p-4">
        {/* Header row */}
        <div className="d-flex align-items-start gap-3 min-w-0">
          <div className={`card-icon-wrap ${iconClass}`}>
            <i className={`bi ${icon}`} />
          </div>
          <div className="flex-grow-1 min-w-0">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h2 className="mb-0 fw-bold" style={{ fontSize: '1rem', color: 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif' }}>
                {title}
              </h2>
              {badge}
            </div>
            {description && (
              <p className="mb-0 mt-1" style={{ fontSize: '.82rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Extra content slot */}
        {children && (
          <div className="flex-grow-1 min-w-0" style={{ minWidth: 0 }}>
            {children}
          </div>
        )}

        {/* Footer slot */}
        {footer && <div>{footer}</div>}

        {/* Primary CTA */}
        {actionLabel && (
          <motion.div whileTap={{ scale: 0.97 }}>
            <Button
              variant="primary"
              className="mt-auto w-100 fw-semibold"
              style={{ fontSize: '.875rem' }}
              onClick={onAction}
              id={`feature-card-btn-${title?.replace(/\s+/g, '-').toLowerCase()}`}
            >
              {actionLabel}
              <i className="bi bi-arrow-right ms-2" />
            </Button>
          </motion.div>
        )}
      </Card.Body>
    </Card>
  </motion.div>
);

export default FeatureCard;
