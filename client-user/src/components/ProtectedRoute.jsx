import { Navigate, Outlet } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext.jsx';

export default function ProtectedRoute() {
  const { isAuthenticated, user } = useAuthContext();
  const token = localStorage.getItem('citizen_token');

  if (!isAuthenticated && !token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
