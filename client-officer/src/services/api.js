import axios from 'axios';

/**
 * Axios base instance — imported by every officer service file.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('officer_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, Promise.reject);

// Global error handling — redirect to shared login page on 401
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      console.warn('[api] 401 Unauthorized — clearing session and redirecting to login.');
      localStorage.removeItem('officer_token');
      localStorage.removeItem('officer_refresh');
      localStorage.removeItem('officer_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
