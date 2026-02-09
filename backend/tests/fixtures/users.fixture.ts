/**
 * User Test Fixtures
 */

import { UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

export const testUsers = {
  admin: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@test.com',
    password: 'AdminTestPass@24!',
    passwordHash: '', // Will be set below
    name: 'Test Admin',
    role: UserRole.ADMIN,
    phoneNumber: '+919876543210',
    address: 'Admin Address',
    isEmailVerified: true,
    isPhoneVerified: true,
  },

  ca1: {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'ca1@test.com',
    password: 'CATestingPass@95!',
    passwordHash: '',
    name: 'John CA',
    role: UserRole.CA,
    phoneNumber: '+919876543211',
    address: 'CA Address 1',
    isEmailVerified: true,
    isPhoneVerified: true,
  },

  ca2: {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'ca2@test.com',
    password: 'CATestingPass@86!',
    passwordHash: '',
    name: 'Jane CA',
    role: UserRole.CA,
    phoneNumber: '+919876543212',
    address: 'CA Address 2',
    isEmailVerified: true,
    isPhoneVerified: true,
  },

  client1: {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'client1@test.com',
    password: 'ClientTestPass@68!',
    passwordHash: '',
    name: 'Test Client 1',
    role: UserRole.CLIENT,
    phoneNumber: '+919876543213',
    address: 'Client Address 1',
    isEmailVerified: true,
    isPhoneVerified: true,
  },

  client2: {
    id: '00000000-0000-0000-0000-000000000005',
    email: 'client2@test.com',
    password: 'ClientTestPass@97!',
    passwordHash: '',
    name: 'Test Client 2',
    role: UserRole.CLIENT,
    phoneNumber: '+919876543214',
    address: 'Client Address 2',
    isEmailVerified: true,
    isPhoneVerified: true,
  },

  unverifiedUser: {
    id: '00000000-0000-0000-0000-000000000006',
    email: 'unverified@test.com',
    password: 'UserTestingPass@42!',
    passwordHash: '',
    name: 'Unverified User',
    role: UserRole.CLIENT,
    phoneNumber: '+919876543215',
    address: 'Unverified Address',
    isEmailVerified: false,
    isPhoneVerified: false,
  },
};

// Hash passwords
async function hashPasswords() {
  for (const user of Object.values(testUsers)) {
    user.passwordHash = await bcrypt.hash(user.password, 10);
  }
}

// Call immediately
hashPasswords();

export async function getUsersForSeeding() {
  await hashPasswords();
  return Object.values(testUsers).map(user => ({
    id: user.id,
    email: user.email,
    password: user.passwordHash,
    name: user.name,
    role: user.role,
    phone: user.phoneNumber,
  }));
}

export function getUserCredentials(userKey: keyof typeof testUsers) {
  return {
    email: testUsers[userKey].email,
    password: testUsers[userKey].password,
  };
}
