/**
 * Chartered Accountant Test Fixtures
 */

import { VerificationStatus } from '@prisma/client';
import { testUsers } from './users.fixture';

export const testCAs = {
  ca1: {
    id: '10000000-0000-0000-0000-000000000001',
    userId: testUsers.ca1.id,
    membershipId: 'ICAI-123456',
    hourlyRate: 1500,
    experienceYears: 10,
    specialization: ['Tax Planning', 'GST', 'Auditing'],
    description: 'Experienced CA with 10 years in tax and audit',
    verificationStatus: VerificationStatus.VERIFIED,
    verificationDocuments: ['doc1.pdf', 'doc2.pdf'],
    availableForNewClients: true,
    profileImage: 'profile1.jpg',
    certificateImage: 'cert1.jpg',
  },

  ca2: {
    id: '10000000-0000-0000-0000-000000000002',
    userId: testUsers.ca2.id,
    membershipId: 'ICAI-789012',
    hourlyRate: 2000,
    experienceYears: 15,
    specialization: ['Corporate Tax', 'International Taxation', 'Transfer Pricing'],
    description: 'Senior CA specializing in corporate taxation',
    verificationStatus: VerificationStatus.VERIFIED,
    verificationDocuments: ['doc3.pdf', 'doc4.pdf'],
    availableForNewClients: true,
    profileImage: 'profile2.jpg',
    certificateImage: 'cert2.jpg',
  },

  unverifiedCA: {
    id: '10000000-0000-0000-0000-000000000003',
    userId: '00000000-0000-0000-0000-000000000007', // Additional user
    membershipId: 'ICAI-345678',
    hourlyRate: 1200,
    experienceYears: 5,
    specialization: ['Bookkeeping', 'GST'],
    description: 'New CA awaiting verification',
    verificationStatus: VerificationStatus.PENDING,
    verificationDocuments: ['doc5.pdf'],
    availableForNewClients: false,
    profileImage: null,
    certificateImage: 'cert3.jpg',
  },
};

export async function getCAsForSeeding() {
  return Object.values(testCAs);
}

export const testAvailability = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    caId: testCAs.ca1.id,
    dayOfWeek: 1, // Monday
    startTime: '09:00',
    endTime: '17:00',
    isAvailable: true,
  },
  {
    id: '20000000-0000-0000-0000-000000000002',
    caId: testCAs.ca1.id,
    dayOfWeek: 2, // Tuesday
    startTime: '09:00',
    endTime: '17:00',
    isAvailable: true,
  },
  {
    id: '20000000-0000-0000-0000-000000000003',
    caId: testCAs.ca2.id,
    dayOfWeek: 1,
    startTime: '10:00',
    endTime: '18:00',
    isAvailable: true,
  },
];

export async function getAvailabilityForSeeding() {
  return testAvailability;
}
