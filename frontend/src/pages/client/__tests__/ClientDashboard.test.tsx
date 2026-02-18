import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import authReducer from '../../../store/slices/authSlice';
import userReducer from '../../../store/slices/userSlice';
import serviceReducer from '../../../store/slices/serviceSlice';
import ClientDashboard from '../ClientDashboard';

// Mock the services
jest.mock('../../../services', () => ({
  serviceRequestService: {
    getRequests: jest.fn(),
  },
  paymentService: {
    getPaymentHistory: jest.fn(),
  },
  notificationService: {
    getNotifications: jest.fn(),
  },
}));

// Mock the dashboard metrics hook
jest.mock('../../../hooks/useDashboardMetrics', () => ({
  useClientDashboardMetrics: () => ({
    metrics: {
      totalRequests: 5,
      pendingCount: 2,
      inProgressCount: 1,
      acceptedCount: 0,
      completedCount: 2,
    },
    loading: false,
    error: null,
  }),
}));

import { serviceRequestService, paymentService } from '../../../services';

const mockUser = {
  id: 'user-1',
  email: 'client@example.com',
  role: 'CLIENT' as const,
  name: 'Test Client',
};

const mockServiceRequests = [
  {
    id: 'req-1',
    serviceType: 'GST_FILING',
    status: 'PENDING',
    description: 'Need help with GST filing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'req-2',
    serviceType: 'INCOME_TAX_RETURN',
    status: 'COMPLETED',
    description: 'Income tax return filing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ca: { user: { name: 'CA Ramesh' } },
  },
];

const mockPayments = [
  {
    id: 'pay-1',
    amount: 5000,
    status: 'COMPLETED',
    createdAt: new Date().toISOString(),
  },
];

const createTestStore = (user = mockUser) =>
  configureStore({
    reducer: {
      auth: authReducer,
      user: userReducer,
      service: serviceReducer,
    },
    preloadedState: {
      auth: {
        user,
        token: 'test-token',
        isAuthenticated: true,
        loading: false,
        error: null,
      },
    },
  });

const renderWithProviders = (store = createTestStore()) =>
  render(
    <Provider store={store}>
      <MemoryRouter>
        <ClientDashboard />
      </MemoryRouter>
    </Provider>
  );

describe('ClientDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (serviceRequestService.getRequests as jest.Mock).mockResolvedValue({
      success: true,
      data: { data: mockServiceRequests },
    });
    (paymentService.getPaymentHistory as jest.Mock).mockResolvedValue({
      success: true,
      data: mockPayments,
    });
  });

  it('shows loading spinner initially', () => {
    const { container } = renderWithProviders();
    // The loading spinner svg is rendered before data fetches resolve
    // It uses animate-spin class
    expect(container.querySelector('svg.animate-spin')).toBeInTheDocument();
  });

  it('renders welcome message with user name after loading', async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText(/Welcome, Test Client/i)).toBeInTheDocument();
    });
  });

  it('renders dashboard stats cards', async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('Total Requests')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  it('renders total requests count from metrics', async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // totalRequests
    });
  });

  it('renders pending count from metrics', async () => {
    renderWithProviders();
    await waitFor(() => {
      // pendingCount=2 shown in "Pending Requests (2/3)" heading
      expect(screen.getByText(/Pending Requests/i)).toBeInTheDocument();
      expect(screen.getByText(/\(2\/3\)/i)).toBeInTheDocument();
    });
  });

  it('renders service requests section', async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('All Requests')).toBeInTheDocument();
    });
  });

  it('renders service request items', async () => {
    renderWithProviders();
    await waitFor(() => {
      // GST FILING appears in both pending section and all-requests section
      const gstItems = screen.getAllByText('GST FILING');
      expect(gstItems.length).toBeGreaterThan(0);
      // INCOME TAX RETURN appears in all-requests section
      expect(screen.getAllByText('INCOME TAX RETURN').length).toBeGreaterThan(0);
    });
  });

  it('renders Recent Payments section', async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('Recent Payments')).toBeInTheDocument();
    });
  });

  it('renders payment amount', async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('₹5000.00')).toBeInTheDocument();
    });
  });

  it('renders New Request button', async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /New Request/i })).toBeInTheDocument();
    });
  });

  it('renders Notifications section', async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });
  });
});
