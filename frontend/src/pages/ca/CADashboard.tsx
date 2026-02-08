import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import { serviceRequestService, paymentService, caService } from '../../services';
import api from '../../services/api';
import { Card, Button, Loading } from '../../components/common';
import { useCADashboardMetrics } from '../../hooks/useDashboardMetrics';

interface ServiceRequest {
  id: string;
  serviceType: string;
  status: string;
  description: string;
  createdAt: string;
  client: {
    user: {
      name: string;
    };
  };
}

interface Payment {
  id: string;
  amount: number;
  caAmount?: number;
  status: string;
  releasedToCA: boolean;
  createdAt: string;
}

interface FirmInfo {
  id: string;
  firmName: string;
  firmType: string;
  status: string;
  role: string;
  isAdmin: boolean;
}

const CADashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [firmInfo, setFirmInfo] = useState<FirmInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileCompletion, setProfileCompletion] = useState(0);

  // Use dashboard metrics hook with 5-minute cache
  const { metrics: dashboardMetrics, loading: metricsLoading, error: metricsError } = useCADashboardMetrics();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [requestsResponse, paymentsResponse, profileResponse, firmResponse] = await Promise.all([
        serviceRequestService.getRequests({ limit: 10 }),
        paymentService.getPaymentHistory(),
        caService.getMyProfile().catch(() => null),
        // Fetch CA's firm information
        api.get('/firms?myFirm=true').catch(() => ({ data: { success: false, data: [] } })),
      ]);

      if (requestsResponse.success) {
        const requests = requestsResponse.data.data || requestsResponse.data;
        setServiceRequests(requests);
      }

      if (paymentsResponse.success) {
        const paymentsData = paymentsResponse.data;
        setPayments(paymentsData.slice(0, 5));
      }

      if (profileResponse?.success) {
        setProfile(profileResponse.data);

        // Calculate profile completion
        const prof = profileResponse.data;
        let completed = 0;
        const fields = [
          prof.caLicenseNumber,
          prof.specialization?.length > 0,
          prof.experienceYears,
          prof.hourlyRate,
          prof.description,
          prof.qualifications?.length > 0,
          prof.languages?.length > 0,
        ];
        completed = fields.filter(Boolean).length;
        setProfileCompletion(Math.round((completed / fields.length) * 100));

        // Check if CA is part of a firm
        if (prof.currentFirmId && firmResponse.data.success) {
          const firms = firmResponse.data.data.firms || [];
          const currentFirm = firms.find((f: any) => f.id === prof.currentFirmId);

          if (currentFirm) {
            // Find the CA's membership to get their role
            const membership = currentFirm.members?.find((m: any) => m.caId === prof.id);

            setFirmInfo({
              id: currentFirm.id,
              firmName: currentFirm.firmName,
              firmType: currentFirm.firmType,
              status: currentFirm.status,
              role: membership?.role || 'MEMBER',
              isAdmin: membership?.role === 'FIRM_ADMIN',
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'ACCEPTED':
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getVerificationBadge = () => {
    if (!profile) return null;

    const status = profile.verificationStatus;
    if (status === 'VERIFIED') {
      return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">Verified</span>;
    } else if (status === 'PENDING') {
      return <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">Pending Verification</span>;
    } else if (status === 'REJECTED') {
      return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">Rejected</span>;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loading size="lg" />
      </div>
    );
  }

  const getWelcomeMessage = () => {
    if (firmInfo) {
      if (firmInfo.isAdmin) {
        return {
          title: `Welcome, ${user?.name}`,
          subtitle: `Firm Admin at ${firmInfo.firmName}`,
          description: 'Manage your firm, team members, and business operations',
        };
      } else {
        return {
          title: `Welcome, ${user?.name}`,
          subtitle: `${firmInfo.role.replace(/_/g, ' ')} at ${firmInfo.firmName}`,
          description: 'Manage your assigned service requests and track earnings',
        };
      }
    }
    return {
      title: `Welcome, CA ${user?.name}`,
      subtitle: 'Independent Chartered Accountant',
      description: 'Manage your service requests and earnings',
    };
  };

  const welcomeMsg = getWelcomeMessage();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex justify-between items-start">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{welcomeMsg.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            {firmInfo ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
                {welcomeMsg.subtitle}
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                {welcomeMsg.subtitle}
              </span>
            )}
          </div>
          <p className="mt-2 text-gray-600">{welcomeMsg.description}</p>
        </div>
        <div>{getVerificationBadge()}</div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <h3 className="text-sm font-medium opacity-90">Total Requests</h3>
          <p className="text-3xl font-bold mt-2">{dashboardMetrics?.totalRequests || 0}</p>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
          <h3 className="text-sm font-medium opacity-90">Pending</h3>
          <p className="text-3xl font-bold mt-2">{dashboardMetrics?.pendingCount || 0}</p>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <h3 className="text-sm font-medium opacity-90">Total Earnings</h3>
          <p className="text-3xl font-bold mt-2">₹{(dashboardMetrics?.totalEarnings || 0).toFixed(2)}</p>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <h3 className="text-sm font-medium opacity-90">Pending Payments</h3>
          <p className="text-3xl font-bold mt-2">{dashboardMetrics?.pendingPayments || 0}</p>
        </Card>
      </div>

      {/* CA Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Request Capacity */}
        <Card>
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-medium text-gray-600">Request Capacity</h3>
            {((dashboardMetrics?.activeCapacity?.current || 0) >= (dashboardMetrics?.activeCapacity?.max || 15)) && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">Limit Reached</span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-gray-900">{dashboardMetrics?.activeCapacity?.current || 0}</p>
            <p className="text-gray-500">/ {dashboardMetrics?.activeCapacity?.max || 15}</p>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Active Requests</span>
              <span>{Math.round(((dashboardMetrics?.activeCapacity?.current || 0) / (dashboardMetrics?.activeCapacity?.max || 15)) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  (dashboardMetrics?.activeCapacity?.current || 0) >= (dashboardMetrics?.activeCapacity?.max || 15)
                    ? 'bg-red-500'
                    : (dashboardMetrics?.activeCapacity?.current || 0) >= (dashboardMetrics?.activeCapacity?.max || 15) * 0.8
                    ? 'bg-yellow-500'
                    : 'bg-blue-500'
                }`}
                style={{
                  width: `${Math.min(((dashboardMetrics?.activeCapacity?.current || 0) / (dashboardMetrics?.activeCapacity?.max || 15)) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
          {((dashboardMetrics?.activeCapacity?.current || 0) >= (dashboardMetrics?.activeCapacity?.max || 15)) && (
            <p className="mt-2 text-xs text-red-600">
              Complete existing requests before accepting new ones
            </p>
          )}
        </Card>

        {/* Reputation Score */}
        <Card>
          <h3 className="text-sm font-medium text-gray-600 mb-2">Reputation Score</h3>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-gray-900">{dashboardMetrics?.reputationScore || 5.0.toFixed(1)}</p>
            <p className="text-gray-500">/ 5.0</p>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg
                  key={star}
                  className={`w-5 h-5 ${
                    star <= Math.round(dashboardMetrics?.reputationScore || 5.0)
                      ? 'text-yellow-400'
                      : 'text-gray-300'
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-600">
              {dashboardMetrics?.reputationScore || 5.0 >= 4.5
                ? 'Excellent performance'
                : dashboardMetrics?.reputationScore || 5.0 >= 4.0
                ? 'Good standing'
                : dashboardMetrics?.reputationScore || 5.0 >= 3.0
                ? 'Average performance'
                : 'Needs improvement'}
            </p>
          </div>
        </Card>

        {/* Abandonment Count */}
        <Card>
          <h3 className="text-sm font-medium text-gray-600 mb-2">Abandonment History</h3>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-gray-900">{dashboardMetrics?.abandonmentCount || 0}</p>
            <p className="text-gray-500">total</p>
          </div>
          <div className="mt-3">
            {dashboardMetrics?.abandonmentCount || 0 === 0 ? (
              <div className="flex items-center text-green-600 text-sm">
                <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                No abandonments
              </div>
            ) : (
              <div>
                <div className={`flex items-center text-sm ${
                  dashboardMetrics?.abandonmentCount || 0 > 3 ? 'text-red-600' :
                  dashboardMetrics?.abandonmentCount || 0 > 1 ? 'text-yellow-600' :
                  'text-gray-600'
                }`}>
                  <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {dashboardMetrics?.abandonmentCount || 0 > 3 ? 'High abandonment rate' : 'Monitor carefully'}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Each abandonment reduces your reputation score
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Firm Management */}
      <Card className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {firmInfo ? 'Firm Management' : 'CA Firm Management'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {firmInfo
                ? firmInfo.isAdmin
                  ? 'Manage your firm, team members, and operations'
                  : 'View your firm details and invitations'
                : 'Register or join a CA firm'}
            </p>
          </div>
        </div>

        {firmInfo ? (
          /* Firm Member View */
          <div className="space-y-4">
            {/* Current Firm Info */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500 rounded-lg">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{firmInfo.firmName}</h4>
                    <p className="text-sm text-gray-600">
                      {firmInfo.role.replace(/_/g, ' ')} • {firmInfo.firmType.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  firmInfo.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                  firmInfo.status === 'PENDING_VERIFICATION' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {firmInfo.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => navigate('/ca/my-firm')}
                className="group p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Firm Dashboard</h4>
                    <p className="text-xs text-gray-500">View firm details</p>
                  </div>
                </div>
              </button>

              {firmInfo.isAdmin && (
                <button
                  onClick={() => navigate('/ca/firm-admin')}
                  className="group p-4 border-2 border-purple-200 bg-purple-50 rounded-lg hover:border-purple-500 hover:bg-purple-100 transition-all text-left"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-200 rounded-lg group-hover:bg-purple-300 transition-colors">
                      <svg
                        className="w-6 h-6 text-purple-700"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-medium text-purple-900">Admin Panel</h4>
                      <p className="text-xs text-purple-600">Manage team & settings</p>
                    </div>
                  </div>
                </button>
              )}

              <button
                onClick={() => navigate('/ca/invitations')}
                className="group p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all text-left"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                    <svg
                      className="w-6 h-6 text-purple-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Invitations</h4>
                    <p className="text-xs text-gray-500">View pending invites</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        ) : (
          /* Independent CA View */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/ca/my-firm')}
              className="group p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <svg
                    className="w-6 h-6 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">My Firm</h4>
                  <p className="text-xs text-gray-500">View & manage firm</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate('/ca/register-firm')}
              className="group p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                  <svg
                    className="w-6 h-6 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Register Firm</h4>
                  <p className="text-xs text-gray-500">Create new firm</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate('/ca/invitations')}
              className="group p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <svg
                    className="w-6 h-6 text-purple-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Invitations</h4>
                  <p className="text-xs text-gray-500">View pending invites</p>
                </div>
              </div>
            </button>
          </div>
        )}
      </Card>

      {/* Profile Completion & Availability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Profile Completion */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Completion</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Complete your profile to get more clients</span>
              <span className="text-sm font-semibold text-gray-900">{profileCompletion}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  profileCompletion === 100 ? 'bg-green-500' :
                  profileCompletion >= 70 ? 'bg-blue-500' :
                  profileCompletion >= 40 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${profileCompletion}%` }}
              />
            </div>
            {profileCompletion < 100 && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">Missing fields:</p>
                <ul className="text-xs text-gray-500 space-y-1">
                  {!profile?.description && <li>• Add profile description</li>}
                  {!profile?.qualifications?.length && <li>• Add qualifications</li>}
                  {!profile?.languages?.length && <li>• Add languages</li>}
                  {!profile?.specialization?.length && <li>• Add specializations</li>}
                </ul>
                <Button size="sm" className="mt-3" onClick={() => navigate('/profile')}>
                  Complete Profile
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Availability Calendar */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Availability This Week</h3>
          <div className="space-y-2">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => (
              <div key={day} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-700">{day}</span>
                <div className="flex items-center space-x-2">
                  {index < 5 ? (
                    <>
                      <span className="text-xs text-gray-500">9:00 AM - 6:00 PM</span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Available</span>
                    </>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">Not Available</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" fullWidth className="mt-4">
            Update Availability
          </Button>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Service Requests */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Service Requests</h2>
            <Button size="sm" onClick={() => navigate('/profile')}>
              Update Profile
            </Button>
          </div>

          <div className="space-y-4">
            {serviceRequests.length === 0 ? (
              <Card>
                <p className="text-gray-500 text-center py-4">No service requests yet</p>
                <p className="text-sm text-gray-400 text-center mt-2">
                  {profile?.verificationStatus !== 'VERIFIED'
                    ? 'Your profile needs to be verified before receiving requests'
                    : 'Clients will send you requests based on your profile'}
                </p>
              </Card>
            ) : (
              serviceRequests.map((request) => (
                <Card key={request.id} hoverable onClick={() => navigate(`/requests/${request.id}`)}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{request.serviceType.replace(/_/g, ' ')}</h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{request.description}</p>
                      <p className="text-sm text-gray-500 mt-2">Client: {request.client.user.name}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                      {request.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Payments & Earnings */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Earnings Overview</h2>

          {/* Earnings Summary Card */}
          <Card className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Status</h3>
            <div className="space-y-4">
              {/* Total Earnings */}
              <div className="flex justify-between items-center pb-3 border-b">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg mr-3">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Total Earnings (Lifetime)</p>
                    <p className="text-xs text-gray-500">All completed services</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-green-600">
                  ₹{(dashboardMetrics?.totalEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Pending in Escrow */}
              <div className="flex justify-between items-center pb-3 border-b">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg mr-3">
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Pending in Escrow</p>
                    <p className="text-xs text-gray-500">Held until auto-release or manual release</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-blue-600">
                  ₹{payments
                    .filter(p => !p.releasedToCA && p.status !== 'PENDING_PAYMENT')
                    .reduce((sum, p) => sum + (p.caAmount || 0), 0)
                    .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  }
                </span>
              </div>

              {/* Available for Withdrawal */}
              <div className="flex justify-between items-center pb-3 border-b">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg mr-3">
                    <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Available for Withdrawal</p>
                    <p className="text-xs text-gray-500">Released funds ready to withdraw</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-purple-600">
                  ₹{payments
                    .filter(p => p.releasedToCA && p.status !== 'PENDING_PAYMENT')
                    .reduce((sum, p) => sum + (p.caAmount || 0), 0)
                    .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  }
                </span>
              </div>

              {/* Payout Information */}
              <div className="pt-2">
                <div className="flex items-start">
                  <div className="p-2 bg-yellow-100 rounded-lg mr-3">
                    <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">Next Payout Schedule</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Automatic payouts are processed monthly on the 1st of each month
                    </p>
                    <p className="text-xs text-blue-600 mt-1 font-medium">
                      Next payout: {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Withdrawal Button */}
              {payments.filter(p => p.releasedToCA).length > 0 && (
                <div className="pt-3 border-t">
                  <Button
                    fullWidth
                    variant="primary"
                    onClick={() => {
                      // TODO: Implement withdrawal functionality
                      alert('Withdrawal functionality coming soon! Please contact support to withdraw your earnings.');
                    }}
                  >
                    Request Withdrawal
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <h3 className="text-xl font-semibold text-gray-900 mb-4">Recent Payments</h3>

          <div className="space-y-4">
            {payments.length === 0 ? (
              <Card>
                <p className="text-gray-500 text-center py-4">No payments yet</p>
              </Card>
            ) : (
              payments.map((payment) => (
                <Card key={payment.id}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">
                        Total: ₹{payment.amount.toFixed(2)}
                      </p>
                      <p className="text-sm text-green-600 font-medium mt-1">
                        Your Amount: ₹{(payment.caAmount || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {payment.releasedToCA ? 'Released' : 'Pending Release'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                      {payment.status}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CADashboard;
