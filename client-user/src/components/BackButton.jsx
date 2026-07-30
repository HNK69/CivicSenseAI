import { useNavigate } from 'react-router-dom';

/**
 * BackButton — Reusable back navigation button.
 *
 * Props:
 *  fallback  {string}   Route to navigate to if no browser history (default: '/')
 *  label     {string}   Button text (default: 'Back')
 *  className {string}   Extra CSS classes
 *
 * Usage:
 *   <BackButton fallback="/status" />
 *   <BackButton label="Back to Dashboard" fallback="/dashboard" />
 */
const BackButton = ({ fallback = '/', label = 'Back', className = '' }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    // If there is a real history entry, go back; else fall through to fallback route
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      id="back-button"
      className={`back-btn ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(255,255,255,0.85)',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '6px 14px',
        fontSize: '.85rem',
        fontWeight: 500,
        color: '#1e293b',
        cursor: 'pointer',
        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
        transition: 'background 0.15s, box-shadow 0.15s',
        marginBottom: '1rem',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = '#f1f5f9';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.10)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.85)';
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.06)';
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
      </svg>
      {label}
    </button>
  );
};

export default BackButton;
