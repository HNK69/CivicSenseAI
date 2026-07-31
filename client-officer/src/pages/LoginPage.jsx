import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthContext } from '../context/AuthContext.jsx';
import { officerLogin } from '../services/authService.js';

export default function OfficerLoginPage() {
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);

  const { login } = useContext(AuthContext);
  const navigate  = useNavigate();
  const [searchParams] = useSearchParams();

  /**
   * Handle cross-origin token hand-off from http://localhost:3000/login.
   * The shared login page appends ?token=...&refresh=...&user=... to the URL
   * after a successful officer login/signup. We extract, store, and redirect.
   */
  useEffect(() => {
    const token   = searchParams.get('token');
    const refresh = searchParams.get('refresh');
    const userRaw = searchParams.get('user');

    if (!token || !userRaw) return;

    setTokenLoading(true);
    try {
      const officerUser = JSON.parse(decodeURIComponent(userRaw));

      // Write directly into localStorage first so ProtectedRoute sees it immediately
      localStorage.setItem('officer_token', token);
      localStorage.setItem('officer_user', JSON.stringify(officerUser));
      if (refresh) localStorage.setItem('officer_refresh', refresh);

      // Update AuthContext state
      login(token, officerUser);

      // Use replace to clean the URL and avoid back-button re-processing
      window.location.replace('/dashboard');
    } catch (err) {
      console.error('[OfficerLoginPage] Failed to parse cross-origin credentials', err);
      setError('Authentication failed. Please try logging in directly.');
      setTokenLoading(false);
    }
  }, []); // run once on mount

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in both email and password.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await officerLogin(email, password);
      // api.js interceptor returns res.data → the server body is { success, data: { officer, accessToken, refreshToken } }
      const payload = res?.data || res;
      const accessToken  = payload?.accessToken  || payload?.token;
      const refreshToken = payload?.refreshToken;
      const officerData  = payload?.officer;

      if (accessToken && officerData) {
        localStorage.setItem('officer_token', accessToken);
        localStorage.setItem('officer_user', JSON.stringify(officerData));
        if (refreshToken) localStorage.setItem('officer_refresh', refreshToken);
        login(accessToken, officerData);
        window.location.replace('/dashboard');
      } else {
        setError('Login failed — unexpected server response.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to authenticate officer.');
    } finally {
      setLoading(false);
    }
  };

  // Show a full-screen spinner while processing cross-origin token
  if (tokenLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: '#94A3B8', fontFamily: 'Space Grotesk, sans-serif', flexDirection: 'column', gap: '1rem',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: '3px solid #334155', borderTopColor: '#3B82F6',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ margin: 0, fontSize: '0.95rem' }}>Signing you in…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
      color: '#F8FAFC', padding: '1.5rem',
      fontFamily: 'Space Grotesk, sans-serif',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          width: '100%', maxWidth: '420px',
          background: 'rgba(30, 41, 59, 0.85)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px', padding: '2.5rem',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)',
        }}
      >
        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '14px',
            background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            boxShadow: '0 8px 20px rgba(59,130,246,0.4)',
          }}>
            <i className="bi bi-shield-lock-fill" style={{ fontSize: '1.75rem', color: '#FFF' }} />
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            Officer Portal
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#94A3B8', marginTop: '0.35rem' }}>
            Municipal Operations &amp; AI Response Management
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#FCA5A5', padding: '0.75rem 1rem', borderRadius: '8px',
            fontSize: '0.85rem', marginBottom: '1.25rem',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{
              display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#CBD5E1',
              marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Officer Email
            </label>
            <input
              type="email"
              placeholder="officer@civicsense.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%', padding: '0.75rem 1rem', borderRadius: '8px',
                background: '#0F172A', border: '1px solid #334155',
                color: '#FFF', fontSize: '0.95rem', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.75rem' }}>
            <label style={{
              display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#CBD5E1',
              marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%', padding: '0.75rem 1rem', borderRadius: '8px',
                background: '#0F172A', border: '1px solid #334155',
                color: '#FFF', fontSize: '0.95rem', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '0.85rem', borderRadius: '8px',
              background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
              color: '#FFF', border: 'none', fontWeight: 600, fontSize: '0.95rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Authenticating…' : 'Sign In to Officer Portal'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
