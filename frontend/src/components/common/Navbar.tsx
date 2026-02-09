import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/slices/authSlice';
import Button from './Button';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <h1 className="text-2xl font-bold text-blue-600">CA Marketplace</h1>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                {/* Role-specific Dashboard - First */}
                {user?.role === 'CLIENT' && (
                  <Link to="/client/dashboard" className="text-gray-700 hover:text-blue-600">
                    Dashboard
                  </Link>
                )}

                {user?.role === 'CA' && (
                  <Link to="/ca/dashboard" className="text-gray-700 hover:text-blue-600">
                    Dashboard
                  </Link>
                )}

                {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
                  <Link to="/admin/dashboard" className="text-gray-700 hover:text-blue-600">
                    Admin Dashboard
                  </Link>
                )}

                {/* Find CAs - Only for CLIENTS */}
                {user?.role === 'CLIENT' && (
                  <Link to="/cas" className="text-gray-700 hover:text-blue-600">
                    Find CAs
                  </Link>
                )}

                {/* Profile */}
                <Link to="/profile" className="text-gray-700 hover:text-blue-600">
                  Profile
                </Link>

                {/* Help - Last before user info */}
                <Link to="/help" className="text-gray-700 hover:text-blue-600">
                  Help
                </Link>

                {/* User info + Logout */}
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600">
                    {user?.name} ({user?.role})
                  </span>
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    Logout
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Unauthenticated users can browse CAs */}
                <Link to="/cas" className="text-gray-700 hover:text-blue-600">
                  Find CAs
                </Link>
                <Link to="/help" className="text-gray-700 hover:text-blue-600">
                  Help
                </Link>
                <Link to="/login">
                  <Button variant="outline" size="sm">
                    Login
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm">
                    Register
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
