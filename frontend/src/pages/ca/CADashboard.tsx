import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import { serviceRequestService, paymentService, caService } from '../../services';
import api from '../../services/api';
import { Card, Button, Loading } from '../../components/common';

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
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    totalEarnings: 0,
    pendingPayments: 0,
  });

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

        setStats(prev => ({
          ...prev,
          total: requests.length,
          pending: requests.filter((r: ServiceRequest) => r.status === 'PENDING').length,
          inProgress: requests.filter((r: ServiceRequest) => r.status === 'IN_PROGRESS' || r.status === 'ACCEPTED').length,
          completed: requests.filter((r: ServiceRequest) => r.status === 'COMPLETED').length,
        }));
      }

      if (paymentsResponse.success) {
        const paymentsData = paymentsResponse.data;
        setPayments(paymentsData.slice(0, 5));

        const totalEarnings = paymentsData
          .filter((p: Payment) => p.releasedToCA)
          .reduce((sum: number, p: Payment) => sum + (p.caAmount || 0), 0);

        const pendingPayments = paymentsData
          .filter((p: Payment) => p.status === 'COMPLETED' && !p.releasedToCA)
          .reduce((sum: number, p: Payment) => sum + (p.caAmount || 0), 0);

        setStats(prev => ({
          ...prev,
          totalEarnings,
          pendingPayments,
        }));
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <h3 className="text-sm font-medium opacity-90">Total Requests</h3>
          <p className="text-3xl font-bold mt-2">{stats.total}</p>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
          <h3 className="text-sm font-medium opacity-90">Pending</h3>
          <p className="text-3xl font-bold mt-2">{stats.pending}</p>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <h3 className="text-sm font-medium opacity-90">Total Earnings</h3>
          <p className="text-3xl font-bold mt-2">₹{stats.totalEarnings.toFixed(2)}</p>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <h3 className="text-sm font-medium opacity-90">Pending Payments</h3>
          <p className="text-3xl font-bold mt-2">₹{stats.pendingPayments.toFixed(2)}</p>
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
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent Payments</h2>

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
