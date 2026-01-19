import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar, Footer, ProtectedRoute } from './components/common';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Home
import Home from './pages/home/Home';

// Client Pages
import ClientDashboard from './pages/client/ClientDashboard';

// CA Pages
import CADashboard from './pages/ca/CADashboard';
import CAListing from './pages/cas/CAListing';

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

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register/:role" element={<Register />} />
          <Route path="/cas" element={<CAListing />} />

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

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
