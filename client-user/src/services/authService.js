import api from '../utils/axiosInstance.js';

/**
 * authService.js — Citizen authentication API calls.
 * Backend: POST /api/auth/register | POST /api/auth/login | GET /api/auth/me
 */

/** POST /api/auth/register */
export const registerCitizen = async ({ name, email, phone, password }) => {
  // Returns { success, data: { user, accessToken, refreshToken } }
  const res = await api.post('/auth/register', { name, email, phone, password });
  return res;
};

/** POST /api/auth/login */
export const loginCitizen = async ({ email, password }) => {
  const res = await api.post('/auth/login', { email, password });
  return res;
};

/** GET /api/auth/me */
export const getMe = async () => {
  const res = await api.get('/auth/me');
  return res;
};

/** POST /api/auth/logout */
export const logoutCitizen = async (refreshToken) => {
  try {
    await api.post('/auth/logout', { refreshToken });
  } catch (_) {
    // swallow — we're clearing local state regardless
  }
};
