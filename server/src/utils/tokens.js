const jwt = require('jsonwebtoken');

const path = require('path');
if (!process.env.JWT_ACCESS_SECRET) {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
}

const getAccessSecret = () => process.env.JWT_ACCESS_SECRET || 'fallback_access_secret_for_dev_mode';
const getRefreshSecret = () => process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_for_dev_mode';
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES  || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';

/**
 * generateAccessToken — signs a short-lived access token.
 * @param {{ id, role, email }} payload
 */
const generateAccessToken = (payload) =>
  jwt.sign(payload, getAccessSecret(), { expiresIn: ACCESS_EXPIRES });

/**
 * generateRefreshToken — signs a long-lived refresh token.
 */
const generateRefreshToken = (payload) =>
  jwt.sign(payload, getRefreshSecret(), { expiresIn: REFRESH_EXPIRES });

/**
 * verifyAccessToken — throws if invalid/expired.
 */
const verifyAccessToken = (token) => jwt.verify(token, getAccessSecret());

/**
 * verifyRefreshToken — throws if invalid/expired.
 */
const verifyRefreshToken = (token) => jwt.verify(token, getRefreshSecret());

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
