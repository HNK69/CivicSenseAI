/**
 * statusColorMap.js — Maps issue/notification status strings
 * to Bootstrap variant names and display labels.
 */

/** Maps status → Bootstrap Badge variant */
export const statusVariantMap = {
  'pending':     'warning',
  'in-progress': 'info',
  'in progress': 'info',
  'completed':   'success',
  'resolved':    'success',
  'rejected':    'danger',
  'reopened':    'danger',
  'on-hold':     'secondary',
};

/** Maps status → human-readable label */
export const statusLabelMap = {
  'pending':     'Pending',
  'in-progress': 'In Progress',
  'in progress': 'In Progress',
  'completed':   'Completed',
  'resolved':    'Resolved',
  'rejected':    'Rejected',
  'reopened':    'Reopened',
  'on-hold':     'On Hold',
};

/** Maps severity → Bootstrap color class */
export const severityColorMap = {
  'high':   'danger',
  'medium': 'warning',
  'low':    'success',
};

/** Maps issue category → Bootstrap icon class */
export const categoryIconMap = {
  'roads':       'bi-cone-striped',
  'water':       'bi-droplet-fill',
  'electricity': 'bi-lightning-fill',
  'sanitation':  'bi-trash-fill',
  'parks':       'bi-tree-fill',
  'other':       'bi-three-dots',
};

/**
 * Convenience: given a status string, return { variant, label }
 */
export const getStatusMeta = (status = '') => {
  const key = status.toLowerCase();
  return {
    variant: statusVariantMap[key] || 'secondary',
    label:   statusLabelMap[key]   || status,
  };
};
