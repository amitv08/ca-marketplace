/**
 * Service Request Test Fixtures
 */

import { ServiceType, ServiceRequestStatus, PaymentStatus, PaymentMethod } from '@prisma/client';
import { testUsers } from './users.fixture';
import { testCAs } from './cas.fixture';

export const testClients = {
  client1: {
    id: '30000000-0000-0000-0000-000000000001',
    userId: testUsers.client1.id,
    companyName: 'Test Company 1',
    address: 'Test Address 1, City, State - 123456',
    taxNumber: 'GST123456789',
  },

  client2: {
    id: '30000000-0000-0000-0000-000000000002',
    userId: testUsers.client2.id,
    companyName: 'Test Company 2',
    address: 'Test Address 2, City, State - 654321',
    taxNumber: 'GST987654321',
  },
};

export const testServiceRequests = {
  request1: {
    id: '40000000-0000-0000-0000-000000000001',
    clientId: testClients.client1.id,
    caId: testCAs.ca1.id,
    serviceType: ServiceType.INCOME_TAX_RETURN,
    status: ServiceRequestStatus.ACCEPTED,
    description: 'Annual Tax Filing 2024: Need help with annual tax filing for FY 2023-24',
    deadline: new Date('2026-03-31'),
    estimatedHours: 10,
  },

  request2: {
    id: '40000000-0000-0000-0000-000000000002',
    clientId: testClients.client2.id,
    caId: testCAs.ca2.id,
    serviceType: ServiceType.GST_FILING,
    status: ServiceRequestStatus.IN_PROGRESS,
    description: 'GST Return Filing: Monthly GST return filing assistance',
    deadline: new Date('2026-02-10'),
    estimatedHours: 5,
  },

  pendingRequest: {
    id: '40000000-0000-0000-0000-000000000003',
    clientId: testClients.client1.id,
    caId: null,
    serviceType: ServiceType.AUDIT,
    status: ServiceRequestStatus.PENDING,
    description: 'Internal Audit Services: Looking for CA to conduct internal audit',
    deadline: new Date('2026-04-30'),
    estimatedHours: 40,
  },

  completedRequest: {
    id: '40000000-0000-0000-0000-000000000004',
    clientId: testClients.client2.id,
    caId: testCAs.ca1.id,
    serviceType: ServiceType.ACCOUNTING,
    status: ServiceRequestStatus.COMPLETED,
    description: 'Bookkeeping Services: Monthly bookkeeping completed',
    deadline: new Date('2026-01-31'),
    estimatedHours: 8,
  },
};

export async function getClientsForSeeding() {
  return Object.values(testClients);
}

export async function getServiceRequestsForSeeding() {
  return Object.values(testServiceRequests);
}

export const testPayments = {
  payment1: {
    id: '50000000-0000-0000-0000-000000000001',
    requestId: testServiceRequests.request1.id,
    clientId: testClients.client1.id,
    caId: testCAs.ca1.id,
    amount: 10000,
    platformFee: 1000,
    caAmount: 9000,
    status: PaymentStatus.COMPLETED,
    paymentMethod: PaymentMethod.RAZORPAY,
    transactionId: 'txn_test123456',
    releasedToCA: false,
  },

  payment2: {
    id: '50000000-0000-0000-0000-000000000002',
    requestId: testServiceRequests.completedRequest.id,
    clientId: testClients.client2.id,
    caId: testCAs.ca1.id,
    amount: 8000,
    platformFee: 800,
    caAmount: 7200,
    status: PaymentStatus.COMPLETED,
    paymentMethod: PaymentMethod.RAZORPAY,
    transactionId: 'txn_test789012',
    releasedToCA: true,
  },
};

export async function getPaymentsForSeeding() {
  return Object.values(testPayments);
}

export const testReviews = {
  review1: {
    id: '60000000-0000-0000-0000-000000000001',
    requestId: testServiceRequests.completedRequest.id,
    clientId: testClients.client2.id,
    caId: testCAs.ca1.id,
    rating: 5,
    comment: 'Excellent service, very professional',
  },
};

export async function getReviewsForSeeding() {
  return Object.values(testReviews);
}
