import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import api from '../../services/api';
import { serviceRequestService, messageService } from '../../services';
import { Card, Button, Loading, Alert, Badge } from '../../components/common';
import FilePreview from '../../components/FilePreview';

interface ServiceRequest {
  id: string;
  serviceType: string;
  status: string;
  description: string;
  deadline?: string;
  estimatedHours?: number;
  createdAt: string;
  updatedAt: string;
  escrowStatus?: string;
  escrowAmount?: number;
  escrowPaidAt?: string;
  completedAt?: string;
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
  payments?: Array<{
    id: string;
    amount: number;
    status: string;
    autoReleaseAt?: string;
    escrowReleasedAt?: string;
  }>;
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

interface Review {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

const RequestDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [messageText, setMessageText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

        // Fetch payment and review if completed
        if (response.data.status === 'COMPLETED') {
          fetchPayment();
          if (user?.role === 'CLIENT') {
            fetchReview();
          }
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

  const fetchReview = async () => {
    try {
      // Check if review exists by fetching client's reviews and finding one for this request
      const response = await api.get('/reviews/client/my-reviews');
      if (response.data.success) {
        const reviews = response.data.data || [];
        const existingReview = reviews.find((r: any) => r.requestId === id);
        if (existingReview) {
          setReview(existingReview);
        }
      }
    } catch (err: any) {
      console.error('Failed to load review:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() && selectedFiles.length === 0) return;

    try {
      setSending(true);
      setError('');

      // Determine receiver ID (use the CA/Client entity ID, not user ID)
      const receiverId = user?.role === 'CLIENT'
        ? request?.ca?.id
        : request?.client?.id;

      // Send message with first file (backend supports single file per message)
      const response = await messageService.sendMessage({
        receiverId: receiverId!,
        requestId: id!,
        content: messageText || '📎 File attachment',
        file: selectedFiles[0],
      });

      if (response.success) {
        setMessageText('');
        setSelectedFiles([]);
        await fetchMessages();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // File upload handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      setSelectedFiles(files);
    }
  };

  const handleStatusUpdate = async (action: string) => {
    try {
      setActionLoading(true);
      setError('');
      setSuccess('');

      switch (action) {
        case 'accept':
          await serviceRequestService.acceptRequest(id!);
          setSuccess('Request accepted successfully!');
          break;
        case 'reject':
          await api.put(`/service-requests/${id}/reject`, { reason: 'Unavailable' });
          setSuccess('Request rejected');
          break;
        case 'start':
          await api.post(`/service-requests/${id}/start`);
          setSuccess('Request marked as in progress');
          break;
        case 'complete':
          await serviceRequestService.completeRequest(id!);
          setSuccess('Request marked as completed');
          break;
        case 'cancel':
          await serviceRequestService.cancelRequest(id!);
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

  const getEscrowStatusColor = (status?: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING_PAYMENT':
        return 'bg-yellow-100 text-yellow-800';
      case 'ESCROW_HELD':
        return 'bg-blue-100 text-blue-800';
      case 'ESCROW_RELEASED':
        return 'bg-green-100 text-green-800';
      case 'REFUNDED':
        return 'bg-purple-100 text-purple-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAutoReleaseCountdown = (autoReleaseAt?: string) => {
    if (!autoReleaseAt) return null;

    const releaseDate = new Date(autoReleaseAt);
    const now = new Date();
    const diff = releaseDate.getTime() - now.getTime();

    if (diff <= 0) return 'Releasing soon...';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''}`;
    }
    return `${hours} hour${hours > 1 ? 's' : ''}`;
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
  const cancelDisabledReason = !canCancel && (request.status === 'IN_PROGRESS' || request.status === 'COMPLETED')
    ? `Cannot cancel ${request.status.toLowerCase().replace('_', ' ')} requests. Please contact ${user?.role === 'CLIENT' ? 'the CA' : 'the client'} directly.`
    : undefined;

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

          {/* Escrow Status */}
          {(request.escrowStatus || request.payments?.length) && (
            <Card>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Escrow Payment Status</h2>
              <div className="space-y-4">
                {/* Current Escrow Status */}
                {request.escrowStatus && (
                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-sm font-medium text-gray-700">Current Status</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getEscrowStatusColor(request.escrowStatus)}`}>
                      {request.escrowStatus.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}

                {/* Escrow Amount */}
                {request.escrowAmount && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Amount in Escrow</span>
                    <span className="text-lg font-semibold text-gray-900">
                      ₹{request.escrowAmount.toLocaleString()}
                    </span>
                  </div>
                )}

                {/* Payment Date */}
                {request.escrowPaidAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Paid On</span>
                    <span className="text-gray-900">
                      {new Date(request.escrowPaidAt).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                )}

                {/* Payment Details */}
                {request.payments && request.payments.length > 0 && (
                  <div className="pt-3 border-t">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Details</h3>
                    {request.payments.map((pmt, index) => (
                      <div key={pmt.id} className="bg-gray-50 rounded-lg p-4 space-y-2">
                        {index > 0 && <div className="mb-3" />}

                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Payment Status</span>
                          <Badge variant={pmt.status === 'ESCROW_RELEASED' ? 'success' : 'warning'}>
                            {pmt.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Amount</span>
                          <span className="font-semibold text-gray-900">
                            ₹{pmt.amount.toLocaleString()}
                          </span>
                        </div>

                        {/* Auto-Release Countdown */}
                        {pmt.autoReleaseAt && !pmt.escrowReleasedAt && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-blue-900">
                                Auto-release in:
                              </span>
                              <span className="text-sm font-semibold text-blue-700">
                                {getAutoReleaseCountdown(pmt.autoReleaseAt)}
                              </span>
                            </div>
                            <div className="text-xs text-blue-600">
                              Scheduled: {new Date(pmt.autoReleaseAt).toLocaleDateString('en-IN', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        )}

                        {/* Released Date */}
                        {pmt.escrowReleasedAt && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Released On</span>
                            <span className="text-green-700 font-medium">
                              {new Date(pmt.escrowReleasedAt).toLocaleDateString('en-IN', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Info Note */}
                {request.escrowStatus === 'ESCROW_HELD' && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>ℹ️ Escrow Protection:</strong> Your payment is securely held in escrow.
                      Funds will be automatically released to the CA after the auto-release period,
                      or you can release them manually once satisfied with the work.
                    </p>
                  </div>
                )}

                {request.escrowStatus === 'PENDING_PAYMENT' && user?.role === 'CLIENT' && (
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-800">
                      <strong>⚠️ Payment Required:</strong> Please complete the payment to proceed
                      with your service request.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}

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

                    {/* Display attachments if present */}
                    {msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                      <div className="mt-3 flex flex-wrap">
                        {msg.attachments.map((attachment: any, idx: number) => (
                          <FilePreview
                            key={idx}
                            url={attachment.url || attachment.signedUrl}
                            name={attachment.filename || attachment.name}
                            size={attachment.size}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Send Message Form */}
            <div className="border-t pt-4">
              {/* Drag-drop zone */}
              <div
                className={`relative ${isDragging ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Type your message or drag & drop files here..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                {isDragging && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-50 bg-opacity-90 rounded-lg border-2 border-dashed border-blue-500">
                    <p className="text-blue-600 font-medium">📎 Drop files here</p>
                  </div>
                )}
              </div>

              {/* File previews */}
              {selectedFiles.length > 0 && (
                <div className="mt-3 flex flex-wrap">
                  {selectedFiles.map((file, index) => (
                    <FilePreview
                      key={index}
                      file={file}
                      onRemove={() => handleRemoveFile(index)}
                    />
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between items-center mt-2">
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    type="button"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    Attach Files
                  </button>
                </div>
                <Button
                  onClick={handleSendMessage}
                  isLoading={sending}
                  disabled={!messageText.trim() && selectedFiles.length === 0}
                >
                  {selectedFiles.length > 0 ? `Send with ${selectedFiles.length} file(s)` : 'Send Message'}
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

              {(canCancel || (user?.role === 'CLIENT' && request.status !== 'COMPLETED' && request.status !== 'CANCELLED')) && (
                <Button
                  fullWidth
                  variant="danger"
                  onClick={() => handleStatusUpdate('cancel')}
                  isLoading={actionLoading}
                  disabled={!canCancel}
                  title={cancelDisabledReason}
                >
                  Cancel Request
                </Button>
              )}
              {cancelDisabledReason && !canCancel && (user?.role === 'CLIENT' && request.status !== 'COMPLETED' && request.status !== 'CANCELLED') && (
                <p className="text-xs text-gray-500 mt-1 text-center">{cancelDisabledReason}</p>
              )}

              {request.status === 'COMPLETED' && user?.role === 'CLIENT' && (
                review ? (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Your Review</h4>
                    <div className="flex items-center mb-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`w-5 h-5 ${
                            star <= review.rating ? 'text-yellow-400' : 'text-gray-300'
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                      <span className="ml-2 text-sm text-gray-600">
                        {review.rating}/5
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-gray-700 mb-3">{review.comment}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      Reviewed on {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <Button
                    fullWidth
                    variant="outline"
                    onClick={() => navigate(`/reviews/create?requestId=${request.id}`)}
                  >
                    Leave Review
                  </Button>
                )
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RequestDetailsPage;
