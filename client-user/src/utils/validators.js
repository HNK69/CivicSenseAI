/**
 * validators.js — Form field validation helpers for ReportIssue.
 */

/** Returns true if string is non-empty after trimming */
export const isRequired = (value) =>
  typeof value === 'string' && value.trim().length > 0;

/** Minimum character count */
export const minLength = (value, min) =>
  typeof value === 'string' && value.trim().length >= min;

/** Max character count */
export const maxLength = (value, max) =>
  typeof value === 'string' && value.trim().length <= max;

/** Valid email */
export const isEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** Valid phone (India 10-digit) */
export const isPhone = (value) =>
  /^[6-9]\d{9}$/.test(value.replace(/\s/g, ''));

/** File size check (bytes) */
export const isFileSizeOk = (file, maxMB = 20) =>
  file && file.size <= maxMB * 1024 * 1024;

/** Allowed media MIME types */
export const isAllowedMedia = (file) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];
  return file && allowed.includes(file.type);
};

/**
 * Validate the full report-issue form.
 * Returns { valid: Boolean, errors: { field: message } }
 */
export const validateReportForm = ({ description, category, location }) => {
  const errors = {};

  if (!isRequired(description))
    errors.description = 'Please describe the issue.';
  else if (!minLength(description, 20))
    errors.description = 'Description must be at least 20 characters.';

  if (!isRequired(category))
    errors.category = 'Please select a category.';

  if (!location?.formattedString && !isRequired(location?.manual))
    errors.location = 'Location is required. Please enable GPS or enter manually.';

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
};
