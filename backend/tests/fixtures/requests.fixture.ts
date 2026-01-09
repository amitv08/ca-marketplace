/**
 * Service Request Test Fixtures
 */

import { ServiceType, ServiceRequestStatus } from '@prisma/client';
import { testUsers } from './users.fixture';
import { testCAs } from './cas.fixture';

export const testClients = {
  client1: {
    id: '30000000-0000-0000-0000-000000000001',
    userId: testUsers.client1.id,
    companyName: 'Test Company 1',
    gstNumber: 'GST123456789',
    panNumber: 'ABCDE1234F',
    businessType: 'Private Limited',
  },

  client2: {
    id: '30000000-0000-0000-0000-000000000002',
    userId: testUsers.client2.id,
    companyName: 'Test Company 2',
    gstNumber: 'GST987654321',
    panNumber: 'FGHIJ5678K',
    businessType: 'Partnership',
  },
};

export const testServiceRequests = {
  request1: {
    id: '40000000-0000-0000-0000-000000000001',
    clientId: testClients.client1.id,
    caId: testCAs.ca1.id,
    serviceType: ServiceType.INCOME_TAX_RETURN,
    status: ServiceRequestStatus.ACCEPTED,
    title: 'Annual Tax Filing 2024',
    description: 'Need help with annual tax filing for FY 2023-24',
    budget: 10000,
    deadline: new Date('2024-03-31'),
    documents: ['tax_doc1.pdf', 'tax_doc2.pdf'],
  },

  request2: {
    id: '40000000-0000-0000-0000-000000000002',
    clientId: testClients.client2.id,
    caId: testCAs.ca2.id,
    serviceType: ServiceType.GST_FILING,
    status: ServiceRequestStatus.IN_PROGRESS,
    title: 'GST Return Filing',
    description: 'Monthly GST return filing assistance',
    budget: 5000,
    deadline: new Date('2024-02-10'),
    documents: ['gst_doc1.pdf'],
  },

  pendingRequest: {
    id: '40000000-0000-0000-0000-000000000003',
    clientId: testClients.client1.id,
    caId: null,
    serviceType: ServiceType.AUDIT,
    status: ServiceRequestStatus.PENDING,
    title: 'Internal Audit Services',
    description: 'Looking for CA to conduct internal audit',
    budget: 25000,
    deadline: new Date('2024-04-30'),
    documents: [],
  },

  completedRequest: {
    id: '40000000-0000-0000-0000-000000000004',
    clientId: testClients.client2.id,
    caId: testCAs.ca1.id,
    serviceType: ServiceType.ACCOUNTING,
    status: ServiceRequestStatus.COMPLETED,
    title: 'Bookkeeping Services',
    description: 'Monthly bookkeeping completed',
    budget: 8000,
    deadline: new Date('2024-01-31'),
    documents: ['books1.pdf'],
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
    amount: 10000,
    platformFee: 1000,
    caAmount: 9000,
    status: 'COMPLETED' as any,
    paymentMethod: 'razorpay',
    transactionId: 'txn_test123456',
    releasedToCA: false,
  },

  payment2: {
    id: '50000000-0000-0000-0000-000000000002',
    requestId: testServiceRequests.completedRequest.id,
    clientId: testClients.client2.id,
    amount: 8000,
    platformFee: 800,
    caAmount: 7200,
    status: 'COMPLETED' as any,
    paymentMethod: 'razorpay',
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

  review2: {
    id: '60000000-0000-0000-0000-000000000002',
    requestId: '40000000-0000-0000-0000-000000000005', // Another completed request
    clientId: testClients.client1.id,
    caId: testCAs.ca2.id,
    rating: 4,
    comment: 'Good work, delivered on time',
  },
};

export async function getReviewsForSeeding() {
  return Object.values(testReviews);
}
