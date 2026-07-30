/**
 * Format a JS Date or ISO string to a readable Indian locale date.
 * @param {string|Date} date
 * @returns {string} e.g. "30 Jul 2025"
 */
export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/**
 * Return Bootstrap bg-* class for an issue status key.
 * @param {string} status  OPEN | IN_PROGRESS | RESOLVED | CLOSED | DUPLICATE
 * @returns {string}
 */
export function getStatusBadgeColor(status) {
  const map = {
    OPEN:        'bg-danger',
    IN_PROGRESS: 'bg-warning text-dark',
    RESOLVED:    'bg-success',
    CLOSED:      'bg-secondary',
    DUPLICATE:   'bg-dark',
  };
  return map[status] || 'bg-light text-dark';
}

/**
 * Return Bootstrap text-* class for a priority key.
 * @param {string} priority  CRITICAL | HIGH | MEDIUM | LOW
 * @returns {string}
 */
export function getPriorityColor(priority) {
  const map = {
    CRITICAL: 'text-danger',
    HIGH:     'text-warning',
    MEDIUM:   'text-info',
    LOW:      'text-secondary',
  };
  return map[priority] || 'text-muted';
}

/**
 * Truncate a string to maxLen characters.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
export function truncate(str, maxLen = 80) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

/**
 * Render a star-rating string from a numeric rating 0-5.
 * @param {number} rating
 * @returns {string}
 */
export function renderStars(rating) {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}
