import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar, Footer, ProtectedRoute } from './components/common';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { setUser } from './store/slices/authSlice';
import api from './services/api';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Home
import Home from './pages/home/Home';

// Help
import HelpPage from './pages/help/HelpPage';

// Client Pages
import ClientDashboard from './pages/client/ClientDashboard';

// CA Pages
import CADashboard from './pages/ca/CADashboard';
import FirmAdminDashboard from './pages/ca/FirmAdminDashboard';
import CAListing from './pages/cas/CAListing';
import FirmRegistrationWizard from './pages/ca/FirmRegistrationWizard';
import MyFirmPage from './pages/ca/MyFirmPage';
import InvitationsPage from './pages/ca/InvitationsPage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import SecurityDashboard from './pages/admin/SecurityDashboard';
import SecurityScanDetails from './pages/admin/SecurityScanDetails';
import AnalyticsDashboard from './pages/admin/AnalyticsDashboard';
import ReportsPage from './pages/admin/ReportsPage';
import ExperimentsPage from './pages/admin/ExperimentsPage';
import FeatureFlagsPage from './pages/admin/FeatureFlagsPage';
import UserManagement from './pages/admin/UserManagement';
import CAVerification from './pages/admin/CAVerification';
import PaymentManagement from './pages/admin/PaymentManagement';
import ServiceRequestsManagement from './pages/admin/ServiceRequestsManagement';
import FirmsListPage from './pages/admin/FirmsListPage';
import FirmDetailsPage from './pages/admin/FirmDetailsPage';
import FirmAnalyticsDashboard from './pages/admin/FirmAnalyticsDashboard';
import PlatformSettingsPage from './pages/admin/PlatformSettingsPage';
import DisputesPage from './pages/admin/DisputesPage';

// Shared Pages
import ProfilePage from './pages/profile/ProfilePage';
import RequestDetailsPage from './pages/requests/RequestDetailsPage';
import CreateReviewPage from './pages/reviews/CreateReviewPage';

function AppContent() {
  const dispatch = useAppDispatch();
  const { user, token } = useAppSelector((state) => state.auth);

  // Restore user session on app load if token exists but user doesn't
  useEffect(() => {
    const restoreSession = async () => {
      // If we have a token but no user data, fetch the user profile
      if (token && !user) {
        try {
          const response = await api.get('/users/profile');
          if (response.data.success && response.data.data) {
            dispatch(setUser(response.data.data));
          }
        } catch (error) {
          console.error('Failed to restore session:', error);
          // Token is invalid, clear everything
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      }
    };

    restoreSession();
  }, [dispatch, user, token]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register/:role" element={<Register />} />
          <Route path="/cas" element={<CAListing />} />
          <Route path="/help" element={<HelpPage />} />

          {/* Shared Protected Routes - Accessible to all authenticated users */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute allowedRoles={['CLIENT', 'CA', 'ADMIN', 'SUPER_ADMIN']}>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/requests/:id"
            element={
              <ProtectedRoute allowedRoles={['CLIENT', 'CA', 'ADMIN', 'SUPER_ADMIN']}>
                <RequestDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reviews/create"
            element={
              <ProtectedRoute allowedRoles={['CLIENT']}>
                <CreateReviewPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Client Routes */}
          <Route
            path="/client/dashboard"
            element={
              <ProtectedRoute allowedRoles={['CLIENT']}>
                <ClientDashboard />
              </ProtectedRoute>
            }
          />

          {/* Protected CA Routes */}
          <Route
            path="/ca/dashboard"
            element={
              <ProtectedRoute allowedRoles={['CA']}>
                <CADashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ca/firm-admin"
            element={
              <ProtectedRoute allowedRoles={['CA']}>
                <FirmAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ca/register-firm"
            element={
              <ProtectedRoute allowedRoles={['CA']}>
                <FirmRegistrationWizard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ca/my-firm"
            element={
              <ProtectedRoute allowedRoles={['CA']}>
                <MyFirmPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ca/invitations"
            element={
              <ProtectedRoute allowedRoles={['CA']}>
                <InvitationsPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Admin Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/security"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <SecurityDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/security/scans/:scanId"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <SecurityScanDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <AnalyticsDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/experiments"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <ExperimentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/feature-flags"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <FeatureFlagsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ca-verification"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <CAVerification />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payments"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <PaymentManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/requests"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <ServiceRequestsManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/firms"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <FirmsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/firms/:firmId"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <FirmDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/firm-analytics"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <FirmAnalyticsDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/platform-settings"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <PlatformSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/disputes"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <DisputesPage />
              </ProtectedRoute>
            }
          />

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Footer />
      </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
