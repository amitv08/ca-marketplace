import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { caService, reviewService } from '../../services';
import { Card, Button, Loading, Alert } from '../../components/common';

interface CA {
  id: string;
  caLicenseNumber: string;
  specialization: string[];
  experienceYears: number;
  hourlyRate: number;
  description?: string;
  verificationStatus: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    profileImage?: string;
  };
  averageRating?: number;
  reviewCount?: number;
  currentFirmId?: string;
  currentFirm?: {
    id: string;
    firmName: string;
    firmType: string;
    logoUrl?: string;
  };
}

interface Review {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  client: {
    user: {
      name: string;
      profileImage?: string;
    };
  };
  request: {
    serviceType: string;
  };
}

const CAProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  const [ca, setCA] = useState<CA | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCADetails = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError('');

        // Fetch CA details and reviews in parallel
        const [caResponse, reviewsResponse] = await Promise.all([
          caService.getCAById(id),
          reviewService.getReviewsByCAId(id),
        ]);

        if (caResponse.success) {
          setCA(caResponse.data);
        } else {
          setError('Failed to load CA profile');
        }

        if (reviewsResponse.success) {
          // Get top 3 recent reviews
          const allReviews = reviewsResponse.data.data || reviewsResponse.data;
          setReviews(allReviews.slice(0, 3));
        }
      } catch (err: any) {
        console.error('Error fetching CA profile:', err);
        setError(err.response?.data?.message || 'Failed to load CA profile');
      } finally {
        setLoading(false);
      }
    };

    fetchCADetails();
  }, [id]);

  const handleSendRequest = () => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Check if user is a CLIENT
    if (user?.role !== 'CLIENT') {
      setError('Only clients can send service requests to CAs.');
      setTimeout(() => setError(''), 5000);
      return;
    }

    // Navigate to service request form with CA pre-selected
    navigate('/client/requests/new', { state: { preselectedCA: ca } });
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`h-5 w-5 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (error && !ca) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Alert type="error">{error}</Alert>
          <button
            onClick={() => navigate('/cas')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to CA Listing
          </button>
        </div>
      </div>
    );
  }

  if (!ca) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>CA not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {error && <Alert type="error" className="mb-4">{error}</Alert>}

        {/* CA Profile Card */}
        <Card className="mb-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Profile Image */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                {ca.user.profileImage ? (
                  <img
                    src={ca.user.profileImage}
                    alt={ca.user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg className="w-20 h-20 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>

            {/* Profile Details */}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-3xl font-bold text-gray-900">
                      {ca.user.name}
                    </h1>
                    {ca.verificationStatus === 'VERIFIED' && (
                      <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20" aria-label="Verified CA">
                        <title>Verified CA</title>
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <p className="text-gray-600">
                    License: {ca.caLicenseNumber}
                  </p>
                </div>

                <Button
                  onClick={handleSendRequest}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
                >
                  Send Request
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="flex items-center gap-2 text-gray-700">
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                    <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
                  </svg>
                  <div>
                    <p className="text-sm text-gray-500">Experience</p>
                    <p className="font-semibold">{ca.experienceYears} years</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-gray-700">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm text-gray-500">Hourly Rate</p>
                    <p className="font-semibold">₹{ca.hourlyRate}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-gray-700">
                  <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <div>
                    <p className="text-sm text-gray-500">Rating</p>
                    <p className="font-semibold">
                      {ca.averageRating?.toFixed(1) || 'N/A'} ({ca.reviewCount || 0})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-gray-700">
                  <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <p className="font-semibold text-green-600">Available</p>
                  </div>
                </div>
              </div>

              {/* Specializations */}
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">Specializations:</p>
                <div className="flex flex-wrap gap-2">
                  {ca.specialization.map((spec, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                    >
                      {spec.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>

              {/* Description */}
              {ca.description && (
                <div className="mb-4">
                  <p className="text-gray-700">{ca.description}</p>
                </div>
              )}

              {/* Contact Info */}
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  <span>{ca.user.email}</span>
                </div>
                {ca.user.phone && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                    </svg>
                    <span>{ca.user.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Firm Affiliation */}
        {ca.currentFirm && (
          <Card className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
              </svg>
              Firm Affiliation
            </h2>
            <div className="flex items-center gap-4">
              {ca.currentFirm.logoUrl && (
                <img
                  src={ca.currentFirm.logoUrl}
                  alt={ca.currentFirm.firmName}
                  className="w-16 h-16 object-contain rounded"
                />
              )}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {ca.currentFirm.firmName}
                </h3>
                <p className="text-gray-600 text-sm">
                  {ca.currentFirm.firmType.replace('_', ' ')}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Reviews Section */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Recent Reviews</h2>
            {reviews.length > 0 && (
              <span className="text-sm text-gray-500">
                Showing {reviews.length} of {ca.reviewCount || 0} reviews
              </span>
            )}
          </div>

          {reviews.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No reviews yet. Be the first to review this CA!
            </p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="border-b border-gray-200 pb-4 last:border-b-0"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                        {review.client.user.profileImage ? (
                          <img
                            src={review.client.user.profileImage}
                            alt={review.client.user.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {review.client.user.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {review.request.serviceType.replace('_', ' ')} •{' '}
                            {new Date(review.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        {renderStars(review.rating)}
                      </div>
                      {review.comment && (
                        <p className="text-gray-700">{review.comment}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default CAProfile;
