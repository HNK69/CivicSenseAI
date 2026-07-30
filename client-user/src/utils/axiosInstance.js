import axios from 'axios';

/**
 * axiosInstance — Shared Axios base instance.
 * All service modules import from here (never call axios directly).
 *
 * TODO: set VITE_API_BASE_URL in .env
 *       e.g. VITE_API_BASE_URL=http://localhost:5000/api
 */
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  timeout: 10_000,
  withCredentials: true,   // send session cookies
  headers: { 'Content-Type': 'application/json' },
});

/* ---- Request interceptor: attach JWT if present ---- */
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('civicsense_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* ---- Response interceptor: global error handling ---- */
axiosInstance.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      // TODO: redirect to login page
      console.warn('Unauthorized — redirect to login');
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
