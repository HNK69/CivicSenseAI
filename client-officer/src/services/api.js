import axios from 'axios';

/**
 * Axios base instance — imported by every service file.
 * Set VITE_API_URL in .env to point at your Express server.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('officer_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, Promise.reject);

// Global error handling
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      console.warn('[api] 401 Unauthorized — token may be expired.');
    }
    return Promise.reject(err);
  }
);

export default api;
