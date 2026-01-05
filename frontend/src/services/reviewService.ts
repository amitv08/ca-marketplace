import api from './api';

export interface CreateReviewData {
  requestId: string;
  rating: number;
  comment?: string;
}

const reviewService = {
  // Create review (Client only)
  createReview: async (data: CreateReviewData) => {
    const response = await api.post('/reviews', data);
    return response.data;
  },

  // Get reviews for a CA
  getReviewsByCAId: async (caId: string) => {
    const response = await api.get(`/reviews/ca/${caId}`);
    return response.data;
  },

  // Get review by request ID
  getReviewByRequestId: async (requestId: string) => {
    const response = await api.get(`/reviews/request/${requestId}`);
    return response.data;
  },

  // Update review
  updateReview: async (id: string, data: Partial<CreateReviewData>) => {
    const response = await api.put(`/reviews/${id}`, data);
    return response.data;
  },

  // Delete review
  deleteReview: async (id: string) => {
    const response = await api.delete(`/reviews/${id}`);
    return response.data;
  },
};

export default reviewService;
