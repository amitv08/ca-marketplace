import React, { useEffect, useState } from 'react';
import { Card, Button, Loading, Alert, Badge } from '../../components/common';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8081/api';

interface Invitation {
  id: string;
  token: string;
  email: string;
  role: string;
  membershipType: string;
  personalMessage: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
  firm: {
    id: string;
    firmName: string;
    firmType: string;
    city: string;
    state: string;
    establishedYear: number;
    members: {
      ca: {
        user: {
          name: string;
        };
      };
    }[];
  };
  invitedBy: {
    user: {
      name: string;
      email: string;
    };
  };
}

const InvitationsPage: React.FC = () => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState<string | null>(null);

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please login again.');
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/firm-invitations/my-invitations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Validate response structure
      if (!response?.data?.data) {
        throw new Error('Invalid response from server');
      }

      setInvitations(response.data.data.invitations || []);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Session expired. Please login again.');
      } else if (err.code === 'ECONNABORTED' || err.message === 'Network Error') {
        setError('Network error. Please check your connection and try again.');
      } else if (err.response?.status >= 500) {
        setError('Server error. Please try again later.');
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to load invitations');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invitationId: string) => {
    if (!invitationId) {
      setError('Invalid invitation');
      return;
    }

    setProcessingId(invitationId);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please login again.');
        setProcessingId(null);
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/firm-invitations/${invitationId}/accept`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response?.data) {
        throw new Error('Invalid response from server');
      }

      setSuccess('Invitation accepted successfully!');
      fetchInvitations(); // Refresh list
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Session expired. Please login again.');
      } else if (err.code === 'ECONNABORTED' || err.message === 'Network Error') {
        setError('Network error. Please check your connection and try again.');
      } else if (err.response?.status >= 500) {
        setError('Server error. Please try again later.');
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to accept invitation');
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectClick = (invitationId: string) => {
    setConfirmReject(invitationId);
  };

  const handleRejectConfirm = async () => {
    if (!confirmReject) return;

    const invitationId = confirmReject;
    setConfirmReject(null);
    setProcessingId(invitationId);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please login again.');
        setProcessingId(null);
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/firm-invitations/${invitationId}/reject`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response?.data) {
        throw new Error('Invalid response from server');
      }

      setSuccess('Invitation rejected');
      fetchInvitations(); // Refresh list
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Session expired. Please login again.');
      } else if (err.code === 'ECONNABORTED' || err.message === 'Network Error') {
        setError('Network error. Please check your connection and try again.');
      } else if (err.response?.status >= 500) {
        setError('Server error. Please try again later.');
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to reject invitation');
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectCancel = () => {
    setConfirmReject(null);
  };

  const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'ACCEPTED':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'REJECTED':
      case 'EXPIRED':
        return 'error';
      default:
        return 'default';
    }
  };

  const isExpired = (expiresAt: string): boolean => {
    return new Date(expiresAt) < new Date();
  };

  if (loading) {
    return <Loading />;
  }

  const pendingInvitations = invitations.filter(
    (inv) => inv.status === 'PENDING' && !isExpired(inv.expiresAt)
  );
  const pastInvitations = invitations.filter(
    (inv) => inv.status !== 'PENDING' || isExpired(inv.expiresAt)
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Firm Invitations</h1>
        <p className="text-gray-600 mt-1">
          View and manage invitations to join CA firms
        </p>
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

      {/* Confirmation Dialog */}
      {confirmReject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Confirm Rejection</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to reject this invitation? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={handleRejectCancel}>
                Cancel
              </Button>
              <Button variant="secondary" onClick={handleRejectConfirm}>
                Yes, Reject
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Pending Invitations */}
      <div>
        <h2 className="text-xl font-bold mb-4">
          Pending Invitations ({pendingInvitations.length})
        </h2>

        {pendingInvitations.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            </div>
            <p className="text-gray-600">No pending invitations</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingInvitations.map((invitation) => (
              <Card key={invitation.id} className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">
                      {invitation.firm.firmName}
                    </h3>
                    <div className="flex gap-2 mb-3">
                      <Badge variant="info">
                        {invitation.firm.firmType.replace(/_/g, ' ')}
                      </Badge>
                      <Badge variant="default">
                        Est. {invitation.firm.establishedYear}
                      </Badge>
                      <Badge variant={getStatusColor(invitation.status)}>
                        {invitation.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <span className="text-gray-600">Location:</span>{' '}
                        <span className="font-medium">
                          {invitation.firm.city}, {invitation.firm.state}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Team Size:</span>{' '}
                        <span className="font-medium">
                          {invitation.firm.members.length} members
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Your Role:</span>{' '}
                        <span className="font-medium">
                          {invitation.role.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Membership:</span>{' '}
                        <span className="font-medium">
                          {invitation.membershipType.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {invitation.personalMessage && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Message from {invitation.invitedBy.user.name}:</span>
                      <br />
                      {invitation.personalMessage}
                    </p>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Invited by {invitation.invitedBy.user.name} •{' '}
                    Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRejectClick(invitation.id)}
                      disabled={processingId === invitation.id}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAccept(invitation.id)}
                      disabled={processingId === invitation.id}
                    >
                      {processingId === invitation.id ? 'Processing...' : 'Accept'}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Past Invitations */}
      {pastInvitations.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">
            Past Invitations ({pastInvitations.length})
          </h2>

          <div className="space-y-3">
            {pastInvitations.map((invitation) => (
              <Card key={invitation.id} className="p-4 bg-gray-50">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{invitation.firm.firmName}</div>
                    <div className="text-sm text-gray-600">
                      {invitation.role.replace(/_/g, ' ')} •{' '}
                      Invited on {new Date(invitation.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant={getStatusColor(isExpired(invitation.expiresAt) ? 'EXPIRED' : invitation.status)}>
                    {isExpired(invitation.expiresAt) ? 'EXPIRED' : invitation.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InvitationsPage;
