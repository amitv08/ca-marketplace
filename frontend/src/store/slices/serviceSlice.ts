import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ServiceRequest {
  id: string;
  clientId: string;
  caId?: string;
  serviceType: string;
  status: 'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  description: string;
  documents?: any;
  deadline?: string;
  estimatedHours?: number;
  createdAt: string;
  updatedAt: string;
}

interface CA {
  id: string;
  userId: string;
  caLicenseNumber: string;
  specialization: string[];
  experienceYears: number;
  qualifications: string[];
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  hourlyRate: number;
  description?: string;
  languages: string[];
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    profileImage?: string;
  };
  averageRating?: number;
  reviewCount?: number;
}

interface Payment {
  id: string;
  clientId: string;
  caId: string;
  requestId: string;
  amount: number;
  platformFee?: number;
  caAmount?: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentMethod: string;
  transactionId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  releasedToCA: boolean;
  releasedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface ServiceState {
  serviceRequests: ServiceRequest[];
  currentRequest: ServiceRequest | null;
  caList: CA[];
  selectedCA: CA | null;
  payments: Payment[];
  loading: boolean;
  error: string | null;
  filters: {
    specialization?: string;
    minExperience?: number;
    maxHourlyRate?: number;
    languages?: string[];
  };
}

const initialState: ServiceState = {
  serviceRequests: [],
  currentRequest: null,
  caList: [],
  selectedCA: null,
  payments: [],
  loading: false,
  error: null,
  filters: {},
};

const serviceSlice = createSlice({
  name: 'service',
  initialState,
  reducers: {
    // Service Requests
    fetchRequestsStart: (state: ServiceState) => {
      state.loading = true;
      state.error = null;
    },
    fetchRequestsSuccess: (state, action: PayloadAction<ServiceRequest[]>) => {
      state.loading = false;
      state.serviceRequests = action.payload;
      state.error = null;
    },
    fetchRequestsFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    setCurrentRequest: (state, action: PayloadAction<ServiceRequest | null>) => {
      state.currentRequest = action.payload;
    },
    addServiceRequest: (state, action: PayloadAction<ServiceRequest>) => {
      state.serviceRequests.unshift(action.payload);
    },
    updateServiceRequest: (state, action: PayloadAction<ServiceRequest>) => {
      const index = state.serviceRequests.findIndex((req) => req.id === action.payload.id);
      if (index !== -1) {
        state.serviceRequests[index] = action.payload;
      }
      if (state.currentRequest?.id === action.payload.id) {
        state.currentRequest = action.payload;
      }
    },

    // CA Listings
    fetchCAsStart: (state: ServiceState) => {
      state.loading = true;
      state.error = null;
    },
    fetchCAsSuccess: (state, action: PayloadAction<CA[]>) => {
      state.loading = false;
      state.caList = action.payload;
      state.error = null;
    },
    fetchCAsFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    setSelectedCA: (state, action: PayloadAction<CA | null>) => {
      state.selectedCA = action.payload;
    },
    setFilters: (state, action: PayloadAction<ServiceState['filters']>) => {
      state.filters = action.payload;
    },

    // Payments
    fetchPaymentsStart: (state: ServiceState) => {
      state.loading = true;
      state.error = null;
    },
    fetchPaymentsSuccess: (state, action: PayloadAction<Payment[]>) => {
      state.loading = false;
      state.payments = action.payload;
      state.error = null;
    },
    fetchPaymentsFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    addPayment: (state, action: PayloadAction<Payment>) => {
      state.payments.unshift(action.payload);
    },

    clearError: (state: ServiceState) => {
      state.error = null;
    },
    clearServiceState: (state: ServiceState) => {
      state.serviceRequests = [];
      state.currentRequest = null;
      state.caList = [];
      state.selectedCA = null;
      state.payments = [];
      state.error = null;
      state.filters = {};
    },
  },
});

export const {
  fetchRequestsStart,
  fetchRequestsSuccess,
  fetchRequestsFailure,
  setCurrentRequest,
  addServiceRequest,
  updateServiceRequest,
  fetchCAsStart,
  fetchCAsSuccess,
  fetchCAsFailure,
  setSelectedCA,
  setFilters,
  fetchPaymentsStart,
  fetchPaymentsSuccess,
  fetchPaymentsFailure,
  addPayment,
  clearError,
  clearServiceState,
} = serviceSlice.actions;

export default serviceSlice.reducer;
