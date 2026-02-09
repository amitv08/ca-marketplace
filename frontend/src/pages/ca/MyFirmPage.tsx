import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Loading, Alert, Badge } from '../../components/common';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8081/api';

interface Firm {
  id: string;
  firmName: string;
  firmType: string;
  status: string;
  verificationLevel: string;
  registrationNumber: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  establishedYear: number;
  createdAt: string;
}

interface Member {
  id: string;
  role: string;
  membershipType: string;
  isActive: boolean;
  joinedAt: string;
  ca: {
    user: {
      name: string;
      email: string;
    };
  };
}

interface RegistrationStatus {
  canSubmit: boolean;
  memberCount: number;
  requiredMembers: number;
  documentsUploaded: number;
  requiredDocuments: number;
  blockers: string[];
  nextSteps: string[];
}

interface ServiceRequest {
  id: string;
  serviceType: string;
  status: string;
  description: string;
  deadline?: string;
  estimatedHours?: number;
  createdAt: string;
  client: {
    user: {
      name: string;
      email: string;
    };
  };
  ca?: {
    user: {
      name: string;
      email: string;
    };
  };
  firm?: {
    id: string;
    firmName: string;
    firmType: string;
    status: string;
    verificationLevel: string;
  };
}

const MyFirmPage: React.FC = () => {
  const navigate = useNavigate();
  const [firm, setFirm] = useState<Firm | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [status, setStatus] = useState<RegistrationStatus | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchFirmData();
  }, []);

  const fetchFirmData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please login again.');
        setLoading(false);
        return;
      }

      // Get my firm
      const firmResponse = await axios.get(`${API_BASE_URL}/firms`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { myFirm: true },
      });

      // Validate response structure
      if (!firmResponse?.data?.data) {
        throw new Error('Invalid response from server');
      }

      const firms = firmResponse.data.data.firms;
      if (firms && Array.isArray(firms) && firms.length > 0) {
        const myFirm = firms[0];

        if (!myFirm?.id) {
          throw new Error('Invalid firm data received');
        }

        setFirm(myFirm);

        // Get firm details including members
        const detailsResponse = await axios.get(
          `${API_BASE_URL}/firms/${myFirm.id}?details=true`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        // Validate details response
        if (!detailsResponse?.data?.data) {
          throw new Error('Invalid details response from server');
        }

        setMembers(detailsResponse.data.data.members || []);

        // Get registration status if not active yet
        if (myFirm.status !== 'ACTIVE') {
          const statusResponse = await axios.get(
            `${API_BASE_URL}/firms/${myFirm.id}/registration-status`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (statusResponse?.data?.data) {
            setStatus(statusResponse.data.data);
          }
        }

        // Fetch firm service requests
        try {
          const requestsResponse = await axios.get(
            `${API_BASE_URL}/service-requests`,
            {
              headers: { Authorization: `Bearer ${token}` },
              params: { limit: 50 },
            }
          );

          if (requestsResponse?.data?.data) {
            // Filter requests that belong to this firm
            const firmRequests = (requestsResponse.data.data.data || requestsResponse.data.data)
              .filter((req: ServiceRequest) => req.firm?.id === myFirm.id);
            setRequests(firmRequests);
          }
        } catch (reqErr) {
          console.error('Failed to fetch firm requests:', reqErr);
          // Don't fail the entire page if requests fail
        }
      } else {
        // No firm found
        setFirm(null);
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        // No firm found
        setFirm(null);
      } else if (err.response?.status === 401) {
        setError('Session expired. Please login again.');
      } else if (err.code === 'ECONNABORTED' || err.message === 'Network Error') {
        setError('Network error. Please check your connection and try again.');
      } else if (err.response?.status >= 500) {
        setError('Server error. Please try again later.');
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to load firm data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForVerification = async () => {
    if (!firm?.id) {
      setError('Firm ID not found');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please login again.');
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/firms/${firm.id}/submit-for-verification`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response?.data) {
        throw new Error('Invalid response from server');
      }

      setSuccess('Firm submitted for verification successfully!');
      // Refresh firm data to get updated status
      setTimeout(() => {
        fetchFirmData();
      }, 1500);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Session expired. Please login again.');
      } else if (err.code === 'ECONNABORTED' || err.message === 'Network Error') {
        setError('Network error. Please check your connection and try again.');
      } else if (err.response?.status >= 500) {
        setError('Server error. Please try again later.');
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to submit for verification');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'PENDING_VERIFICATION':
        return 'warning';
      case 'DRAFT':
        return 'info';
      case 'SUSPENDED':
      case 'DISSOLVED':
        return 'error';
      default:
        return 'default';
    }
  };

  const getVerificationBadge = (level: string) => {
    switch (level) {
      case 'PREMIUM':
        return <Badge variant="success">Premium Verified</Badge>;
      case 'VERIFIED':
        return <Badge variant="info">Verified</Badge>;
      case 'BASIC':
        return <Badge variant="default">Basic</Badge>;
      default:
        return <Badge variant="default">Unverified</Badge>;
    }
  };

  const getRequestStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'IN_PROGRESS':
      case 'ACCEPTED':
        return 'info';
      case 'PENDING':
        return 'warning';
      case 'CANCELLED':
        return 'error';
      default:
        return 'default';
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (!firm) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="p-12 text-center">
          <div className="mb-6">
            <svg
              className="mx-auto h-16 w-16 text-gray-400"
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
          <h2 className="text-2xl font-bold mb-2">No Firm Found</h2>
          <p className="text-gray-600 mb-6">
            You haven't registered a firm yet. Start by creating your CA firm now.
          </p>
          <Button onClick={() => navigate('/ca/register-firm')}>
            Register Your Firm
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{firm.firmName}</h1>
          <p className="text-gray-600 mt-1">
            {firm.firmType.replace(/_/g, ' ')} • Established {firm.establishedYear}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={getStatusColor(firm.status)}>
            {firm.status.replace(/_/g, ' ')}
          </Badge>
          {getVerificationBadge(firm.verificationLevel)}
        </div>
      </div>

      {error && (
        <Alert type="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert type="success" onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Registration Status Alert */}
      {status && firm.status !== 'ACTIVE' && (
        <Alert type={status.canSubmit ? 'success' : 'warning'}>
          <div>
            <p className="font-medium mb-2">
              {status.canSubmit
                ? 'Your firm is ready for verification!'
                : 'Complete the following to submit for verification:'}
            </p>
            {status.blockers.length > 0 && (
              <ul className="list-disc list-inside space-y-1 text-sm mb-3">
                {status.blockers.map((blocker, index) => (
                  <li key={index}>{blocker}</li>
                ))}
              </ul>
            )}
            {status.canSubmit && (
              <Button size="sm" onClick={handleSubmitForVerification} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit for Verification'}
              </Button>
            )}
          </div>
        </Alert>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600">Total Members</div>
          <div className="text-2xl font-bold">{members.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Active Members</div>
          <div className="text-2xl font-bold">
            {members.filter((m) => m.isActive).length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Registration Number</div>
          <div className="text-lg font-semibold">{firm.registrationNumber}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Location</div>
          <div className="text-lg font-semibold">
            {firm.city}, {firm.state}
          </div>
        </Card>
      </div>

      {/* Firm Details */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Firm Details</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-600">Email</dt>
            <dd className="font-medium">{firm.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-600">Phone</dt>
            <dd className="font-medium">{firm.phone}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-600">Registration Number</dt>
            <dd className="font-medium">{firm.registrationNumber}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-600">Firm Type</dt>
            <dd className="font-medium">{firm.firmType.replace(/_/g, ' ')}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-600">Registered On</dt>
            <dd className="font-medium">
              {new Date(firm.createdAt).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-600">Verification Level</dt>
            <dd className="font-medium">
              {firm.verificationLevel.replace(/_/g, ' ')}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Team Members */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Team Members</h2>
          {firm.status === 'DRAFT' && (
            <Button size="sm" onClick={() => navigate('/ca/register-firm')}>
              Invite Members
            </Button>
          )}
        </div>

        {members.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No members yet. Invite CAs to join your firm.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50"
              >
                <div>
                  <div className="font-medium">{member.ca.user.name}</div>
                  <div className="text-sm text-gray-600">{member.ca.user.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {member.role.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs text-gray-600">
                    {member.membershipType.replace(/_/g, ' ')}
                  </div>
                  <div className="mt-1">
                    {member.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="default">Inactive</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Service Requests */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Service Requests</h2>
          <div className="text-sm text-gray-600">
            {requests.length} total request{requests.length !== 1 ? 's' : ''}
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No service requests assigned to your firm yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex justify-between items-start p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/requests/${request.id}`)}
              >
                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="font-medium text-lg">
                        {request.serviceType.replace(/_/g, ' ')}
                      </div>
                      <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {request.description}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <div>
                          <span className="font-medium">Client:</span>{' '}
                          {request.client.user.name}
                        </div>
                        {request.ca && (
                          <div>
                            <span className="font-medium">Assigned to:</span>{' '}
                            {request.ca.user.name}
                          </div>
                        )}
                        {!request.ca && (
                          <div className="text-orange-600 font-medium">
                            Unassigned - Available for any team member
                          </div>
                        )}
                        {request.deadline && (
                          <div>
                            <span className="font-medium">Deadline:</span>{' '}
                            {new Date(request.deadline).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 ml-4">
                  <Badge variant={getRequestStatusColor(request.status)}>
                    {request.status.replace(/_/g, ' ')}
                  </Badge>
                  <div className="text-xs text-gray-500">
                    {new Date(request.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Next Steps */}
      {status && status.nextSteps.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Next Steps</h2>
          <ol className="list-decimal list-inside space-y-2">
            {status.nextSteps.map((step, index) => (
              <li key={index} className="text-gray-700">
                {step}
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
};

export default MyFirmPage;
