import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ROUTES } from '../config/routes';
import { UserRole } from '../config/constants';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }) {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }
  return children || <Outlet />;
}

export function AdminRoute({ children }) {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }
  if (user?.role !== UserRole.ADMIN) {
    return <Navigate to={ROUTES.FORBIDDEN} replace />;
  }
  return children || <Outlet />;
}

export function GuestOrAuthRoute({ children }) {
  const location = useLocation();
  const { isAuthenticated, isGuest } = useAuth();
  if (!isAuthenticated && !isGuest) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }
  return children || <Outlet />;
}

export function PublicOnlyRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to={ROUTES.HOME} replace /> : children || <Outlet />;
}
