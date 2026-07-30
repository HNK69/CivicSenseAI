import { createContext, useContext, useState } from 'react';

/**
 * AuthContext — Simple mock user context (no JWT / no auth).
 */
const MOCK_USER = {
  id: 'CIT-001',
  name: 'Aditya Kumar',
  email: 'aditya.kumar@example.com',
  avatar: null,
  ward: 'Ward 42',
  city: 'Ballari',
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user] = useState(MOCK_USER);

  return (
    <AuthContext.Provider value={{ user, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider');
  return ctx;
};

export default AuthContext;
