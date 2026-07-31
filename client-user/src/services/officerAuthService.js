import axios from 'axios';

/**
 * officerAuthService.js — Officer auth from the shared login page.
 * Returns tokens so the caller can pass them cross-origin via URL params.
 */

const OFFICER_API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const loginOfficer = async ({ email, password }) => {
  try {
    const { data } = await axios.post(`${OFFICER_API}/officer/auth/login`, { email, password });
    const { officer, accessToken, refreshToken } = data.data || {};
    return { success: true, officer, accessToken, refreshToken };
  } catch (err) {
    const msg = err.response?.data?.message || 'Officer login failed. Please check your credentials.';
    return { success: false, message: msg };
  }
};

export const registerOfficer = async ({ name, email, phone, password }) => {
  try {
    const { data } = await axios.post(`${OFFICER_API}/officer/auth/register`, {
      name, email, phone, password,
    });
    const { officer, accessToken, refreshToken } = data.data || {};
    return { success: true, officer, accessToken, refreshToken };
  } catch (err) {
    const msg = err.response?.data?.message || 'Officer registration failed.';
    return { success: false, message: msg };
  }
};
