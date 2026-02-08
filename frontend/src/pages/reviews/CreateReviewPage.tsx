import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import api from '../../services/api';
import { Card, Button, Loading, Alert } from '../../components/common';

interface ServiceRequest {
  id: string;
  serviceType: string;
  status: string;
  ca?: {
    user: {
      name: string;
    };
  };
}

const CreateReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('requestId');
  const { user } = useAppSelector((state) => state.auth);

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!requestId) {
      setError('No request ID provided');
      setLoading(false);
      return;
    }

    fetchRequest();
  }, [requestId]);

  const fetchRequest = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/service-requests/${requestId}`);

      if (response.data.success) {
        const requestData = response.data.data;

        // Validate request can be reviewed
        if (requestData.status !== 'COMPLETED') {
          setError('Only completed requests can be reviewed');
          return;
        }

        if (!requestData.ca) {
          setError('This request has no assigned CA to review');
          return;
        }

        setRequest(requestData);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load request details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const response = await api.post('/reviews', {
        requestId,
        rating,
        comment: comment.trim() || undefined,
      });

      if (response.data.success) {
        // Navigate back to request details with success message
        navigate(`/requests/${requestId}`, {
          state: { message: 'Review submitted successfully!' }
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loading size="lg" />
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert type="error">{error}</Alert>
        <Button onClick={() => navigate(-1)} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Button variant="outline" onClick={() => navigate(-1)} className="mb-4">
          ← Back
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">Leave a Review</h1>
        <p className="mt-2 text-gray-600">
          Share your experience with {request?.ca?.user.name}
        </p>
      </div>

      {error && (
        <Alert type="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Service Details</h2>
          <p className="text-gray-600">
            {request?.serviceType.replace(/_/g, ' ')}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            CA: {request?.ca?.user.name}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Rating */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Rating <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <svg
                    className={`w-10 h-10 ${
                      star <= (hoverRating || rating)
                        ? 'text-yellow-400 fill-current'
                        : 'text-gray-300'
                    }`}
                    fill={star <= (hoverRating || rating) ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-3 text-lg font-semibold text-gray-700">
                  {rating} out of 5
                </span>
              )}
            </div>
          </div>

          {/* Comment */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comment (Optional)
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px]"
              placeholder="Share your experience with this CA..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
            />
            <p className="text-xs text-gray-500 mt-1">
              {comment.length}/1000 characters
            </p>
          </div>

          {/* Submit */}
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={submitting}
              disabled={rating === 0}
            >
              Submit Review
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CreateReviewPage;
