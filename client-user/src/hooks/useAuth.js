import { useAuthContext } from '../context/AuthContext.jsx';

/**
 * useAuth — Convenient hook to consume AuthContext.
 * Returns { user, loading, login, logout }
 */
const useAuth = () => useAuthContext();

export default useAuth;
