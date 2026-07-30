const jwt = require('jsonwebtoken');

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES  || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  console.error('[tokens] FATAL: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set.');
  process.exit(1);
}

/**
 * generateAccessToken — signs a short-lived access token.
 * @param {{ id, role, email }} payload
 */
const generateAccessToken = (payload) =>
  jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });

/**
 * generateRefreshToken — signs a long-lived refresh token.
 */
const generateRefreshToken = (payload) =>
  jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });

/**
 * verifyAccessToken — throws if invalid/expired.
 */
const verifyAccessToken = (token) => jwt.verify(token, ACCESS_SECRET);

/**
 * verifyRefreshToken — throws if invalid/expired.
 */
const verifyRefreshToken = (token) => jwt.verify(token, REFRESH_SECRET);

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
