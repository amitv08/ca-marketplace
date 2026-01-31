import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import api from '../../services/api';
import { serviceRequestService, messageService } from '../../services';
import { Card, Button, Loading, Alert, Badge } from '../../components/common';

interface ServiceRequest {
  id: string;
  serviceType: string;
  status: string;
  description: string;
  deadline?: string;
  estimatedHours?: number;
  createdAt: string;
  updatedAt: string;
  client?: {
    id: string;
    user: {
      name: string;
      email?: string;
      phone?: string;
    };
  };
  ca?: {
    id: string;
    user: {
      name: string;
      email?: string;
      phone?: string;
    };
    hourlyRate?: number;
  };
  firm?: {
    id: string;
    firmName: string;
  };
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  sender: {
    name: string;
  };
  attachments?: any;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  platformFee?: number;
  caAmount?: number;
  createdAt: string;
}

const RequestDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    if (id) {
      fetchRequestDetails();
      fetchMessages();
    }
  }, [id]);

  const fetchRequestDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await serviceRequestService.getRequestById(id!);

      if (response.success) {
        setRequest(response.data);

        // Fetch payment if completed
        if (response.data.status === 'COMPLETED') {
          fetchPayment();
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load request details');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      setMessagesLoading(true);
      const response = await api.get(`/messages/${id}`);

      if (response.data.success) {
        setMessages(response.data.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  const fetchPayment = async () => {
    try {
      const response = await api.get(`/payments/${id}`);
      if (response.data.success) {
        setPayment(response.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load payment:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    try {
      setSending(true);
      setError('');

      // Determine receiver ID (use the CA/Client entity ID, not user ID)
      const receiverId = user?.role === 'CLIENT'
        ? request?.ca?.id
        : request?.client?.id;

      const response = await messageService.sendMessage({
        receiverId: receiverId!,
        requestId: id!,
        content: messageText,
      });

      if (response.success) {
        setMessageText('');
        await fetchMessages();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleStatusUpdate = async (action: string) => {
    try {
      setActionLoading(true);
      setError('');
      setSuccess('');

      let response;
      switch (action) {
        case 'accept':
          response = await serviceRequestService.acceptRequest(id!);
          setSuccess('Request accepted successfully!');
          break;
        case 'reject':
          response = await api.put(`/service-requests/${id}/reject`, { reason: 'Unavailable' });
          setSuccess('Request rejected');
          break;
        case 'start':
          response = await api.post(`/service-requests/${id}/start`);
          setSuccess('Request marked as in progress');
          break;
        case 'complete':
          response = await serviceRequestService.completeRequest(id!);
          setSuccess('Request marked as completed');
          break;
        case 'cancel':
          response = await serviceRequestService.cancelRequest(id!);
          setSuccess('Request cancelled');
          break;
      }

      await fetchRequestDetails();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to ${action} request`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'ACCEPTED':
        return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS':
        return 'bg-purple-100 text-purple-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusTimeline = () => {
    const statuses = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'];
    const currentIndex = statuses.indexOf(request?.status || 'PENDING');

    return statuses.map((status, index) => ({
      status,
      completed: index <= currentIndex,
      current: index === currentIndex,
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loading size="lg" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert type="error">Request not found</Alert>
        <Button onClick={() => navigate(-1)} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  const canAccept = user?.role === 'CA' && request.status === 'PENDING';
  const canReject = user?.role === 'CA' && request.status === 'PENDING';
  const canStart = user?.role === 'CA' && request.status === 'ACCEPTED';
  const canComplete = user?.role === 'CA' && request.status === 'IN_PROGRESS';
  const canCancel = (user?.role === 'CLIENT' || user?.role === 'CA') &&
                    (request.status === 'PENDING' || request.status === 'ACCEPTED');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Button variant="outline" onClick={() => navigate(-1)} className="mb-4">
          ← Back
        </Button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {request.serviceType.replace(/_/g, ' ')}
            </h1>
            <p className="mt-2 text-gray-600">Request ID: {request.id.slice(0, 8)}</p>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(request.status)}`}>
            {request.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <Alert type="success" onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert type="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Request Details */}
          <Card>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Request Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <p className="text-gray-900">{request.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {request.deadline && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deadline
                    </label>
                    <p className="text-gray-900">
                      {new Date(request.deadline).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {request.estimatedHours && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estimated Hours
                    </label>
                    <p className="text-gray-900">{request.estimatedHours} hours</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Created
                  </label>
                  <p className="text-gray-900">
                    {new Date(request.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Updated
                  </label>
                  <p className="text-gray-900">
                    {new Date(request.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Status Timeline */}
          <Card>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Progress Timeline</h2>
            <div className="relative">
              <div className="flex justify-between">
                {getStatusTimeline().map((item, index) => (
                  <div key={item.status} className="flex flex-col items-center" style={{ width: '25%' }}>
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        item.completed
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {item.completed ? '✓' : index + 1}
                    </div>
                    <p className={`mt-2 text-xs font-medium text-center ${
                      item.completed ? 'text-blue-600' : 'text-gray-400'
                    }`}>
                      {item.status.replace(/_/g, ' ')}
                    </p>
                  </div>
                ))}
              </div>
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 -z-10">
                <div
                  className="h-full bg-blue-600 transition-all duration-500"
                  style={{
                    width: `${(getStatusTimeline().filter(s => s.completed).length - 1) * 33.33}%`
                  }}
                />
              </div>
            </div>
          </Card>

          {/* Messages */}
          <Card>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Messages</h2>

            {messagesLoading ? (
              <Loading />
            ) : messages.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No messages yet</p>
            ) : (
              <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-lg ${
                      msg.senderId === user?.id
                        ? 'bg-blue-50 ml-12'
                        : 'bg-gray-50 mr-12'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-gray-900">{msg.sender.name}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-700">{msg.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Send Message Form */}
            <div className="border-t pt-4">
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Type your message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <div className="flex justify-end mt-2">
                <Button onClick={handleSendMessage} isLoading={sending} disabled={!messageText.trim()}>
                  Send Message
                </Button>
              </div>
            </div>
          </Card>

          {/* Payment Information */}
          {payment && (
            <Card>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Details</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Amount</span>
                  <span className="font-semibold text-gray-900">₹{payment.amount.toLocaleString()}</span>
                </div>
                {payment.platformFee && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Platform Fee (15%)</span>
                    <span className="text-gray-900">₹{payment.platformFee.toLocaleString()}</span>
                  </div>
                )}
                {payment.caAmount && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">CA Amount</span>
                    <span className="text-gray-900">₹{payment.caAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between pt-3 border-t">
                  <span className="text-gray-600">Status</span>
                  <Badge variant={payment.status === 'COMPLETED' ? 'success' : 'warning'}>
                    {payment.status}
                  </Badge>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Participants */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Participants</h3>

            {request.client && (
              <div className="mb-4 pb-4 border-b">
                <p className="text-sm font-medium text-gray-700 mb-2">Client</p>
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold mr-3">
                    {request.client.user.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{request.client.user.name}</p>
                    {request.client.user.email && (
                      <p className="text-sm text-gray-500">{request.client.user.email}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {request.ca && (
              <div className="mb-4 pb-4 border-b">
                <p className="text-sm font-medium text-gray-700 mb-2">Chartered Accountant</p>
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold mr-3">
                    {request.ca.user.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{request.ca.user.name}</p>
                    {request.ca.user.email && (
                      <p className="text-sm text-gray-500">{request.ca.user.email}</p>
                    )}
                    {request.ca.hourlyRate && (
                      <p className="text-sm text-gray-600">₹{request.ca.hourlyRate}/hour</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {request.firm && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Firm</p>
                <p className="font-medium text-gray-900">{request.firm.firmName}</p>
              </div>
            )}
          </Card>

          {/* Actions */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
            <div className="space-y-3">
              {canAccept && (
                <Button
                  fullWidth
                  onClick={() => handleStatusUpdate('accept')}
                  isLoading={actionLoading}
                >
                  Accept Request
                </Button>
              )}

              {canReject && (
                <Button
                  fullWidth
                  variant="danger"
                  onClick={() => handleStatusUpdate('reject')}
                  isLoading={actionLoading}
                >
                  Reject Request
                </Button>
              )}

              {canStart && (
                <Button
                  fullWidth
                  onClick={() => handleStatusUpdate('start')}
                  isLoading={actionLoading}
                >
                  Mark In Progress
                </Button>
              )}

              {canComplete && (
                <Button
                  fullWidth
                  variant="primary"
                  onClick={() => handleStatusUpdate('complete')}
                  isLoading={actionLoading}
                >
                  Mark Completed
                </Button>
              )}

              {canCancel && (
                <Button
                  fullWidth
                  variant="danger"
                  onClick={() => handleStatusUpdate('cancel')}
                  isLoading={actionLoading}
                >
                  Cancel Request
                </Button>
              )}

              {request.status === 'COMPLETED' && user?.role === 'CLIENT' && (
                <Button
                  fullWidth
                  variant="outline"
                  onClick={() => navigate(`/reviews/create?requestId=${request.id}`)}
                >
                  Leave Review
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RequestDetailsPage;
