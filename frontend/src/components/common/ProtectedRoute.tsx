import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: ('CLIENT' | 'CA' | 'ADMIN' | 'SUPER_ADMIN')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    if (user.role === 'CLIENT') {
      return <Navigate to="/client/dashboard" replace />;
    } else if (user.role === 'CA') {
      return <Navigate to="/ca/dashboard" replace />;
    } else if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
