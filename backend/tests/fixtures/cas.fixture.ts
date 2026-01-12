/**
 * Chartered Accountant Test Fixtures
 */

import { VerificationStatus, Specialization } from '@prisma/client';
import { testUsers } from './users.fixture';

export const testCAs = {
  ca1: {
    id: '10000000-0000-0000-0000-000000000001',
    userId: testUsers.ca1.id,
    caLicenseNumber: 'ICAI-123456',
    hourlyRate: 1500,
    experienceYears: 10,
    specialization: [Specialization.TAX_PLANNING, Specialization.GST, Specialization.AUDIT],
    description: 'Experienced CA with 10 years in tax and audit',
    verificationStatus: VerificationStatus.VERIFIED,
    qualifications: ['CA', 'MBA Finance'],
    languages: ['English', 'Hindi'],
  },

  ca2: {
    id: '10000000-0000-0000-0000-000000000002',
    userId: testUsers.ca2.id,
    caLicenseNumber: 'ICAI-789012',
    hourlyRate: 2000,
    experienceYears: 15,
    specialization: [Specialization.TAX_PLANNING, Specialization.INCOME_TAX, Specialization.COMPANY_LAW],
    description: 'Senior CA specializing in corporate taxation',
    verificationStatus: VerificationStatus.VERIFIED,
    qualifications: ['CA', 'CS', 'MBA'],
    languages: ['English', 'Hindi', 'Marathi'],
  },

  unverifiedCA: {
    id: '10000000-0000-0000-0000-000000000003',
    userId: '00000000-0000-0000-0000-000000000007', // Additional user
    caLicenseNumber: 'ICAI-345678',
    hourlyRate: 1200,
    experienceYears: 5,
    specialization: [Specialization.ACCOUNTING, Specialization.GST],
    description: 'New CA awaiting verification',
    verificationStatus: VerificationStatus.PENDING,
    qualifications: ['CA'],
    languages: ['English'],
  },
};

export async function getCAsForSeeding() {
  return Object.values(testCAs);
}

export const testAvailability = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    caId: testCAs.ca1.id,
    date: new Date('2026-01-15'),
    startTime: new Date('2026-01-15T09:00:00Z'),
    endTime: new Date('2026-01-15T17:00:00Z'),
    isBooked: false,
  },
  {
    id: '20000000-0000-0000-0000-000000000002',
    caId: testCAs.ca1.id,
    date: new Date('2026-01-16'),
    startTime: new Date('2026-01-16T09:00:00Z'),
    endTime: new Date('2026-01-16T17:00:00Z'),
    isBooked: false,
  },
  {
    id: '20000000-0000-0000-0000-000000000003',
    caId: testCAs.ca2.id,
    date: new Date('2026-01-15'),
    startTime: new Date('2026-01-15T10:00:00Z'),
    endTime: new Date('2026-01-15T18:00:00Z'),
    isBooked: false,
  },
];

export async function getAvailabilityForSeeding() {
  return testAvailability;
}
