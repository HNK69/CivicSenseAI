import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const loginContractor = async ({ email, password }) => {
  try {
    const { data } = await axios.post(`${API_BASE}/contractor/auth/login`, { email, password });
    const { contractor, accessToken, refreshToken } = data.data || {};
    return { success: true, contractor, accessToken, refreshToken };
  } catch (err) {
    const msg = err.response?.data?.message || 'Contractor login failed. Please check your credentials.';
    return { success: false, message: msg };
  }
};
