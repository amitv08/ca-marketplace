/**
 * E2E Test Data Seeder
 *
 * Creates the minimal set of users + records required by the Cypress
 * mvp-flows test suite.  Credentials must match cypress.config.js env block.
 *
 * Run inside the container:
 *   npm run seed:e2e
 *
 * Idempotent — uses upsert so re-running is safe.
 */

import { PrismaClient, UserRole, Specialization, VerificationStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

async function hash(plain: string) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function main() {
  console.log('→ Seeding E2E demo data…');

  // ── 1. Admin ───────────────────────────────────────────────────────────────
  const adminPw = await hash('Admin@123!');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@caplatform.com' },
    update: { password: adminPw },
    create: {
      email: 'admin@caplatform.com',
      password: adminPw,
      role: UserRole.ADMIN,
      name: 'Platform Admin',
      phone: '9000000001',
    },
  });
  console.log(`  ✓ Admin: ${adminUser.email}`);

  // ── 2. Clients ─────────────────────────────────────────────────────────────
  const clientPw = await hash('Demo@123');

  for (let i = 1; i <= 5; i++) {
    const u = await prisma.user.upsert({
      where: { email: `client${i}@demo.com` },
      update: { password: clientPw },
      create: {
        email: `client${i}@demo.com`,
        password: clientPw,
        role: UserRole.CLIENT,
        name: `Demo Client ${i}`,
        phone: `900000100${i}`,
      },
    });

    await prisma.client.upsert({
      where: { userId: u.id },
      update: {},
      create: {
        userId: u.id,
        companyName: `Test Co ${i}`,
        address: `${i} Main Street, Mumbai`,
      },
    });
    console.log(`  ✓ Client: ${u.email}`);
  }

  // ── 3. CAs ─────────────────────────────────────────────────────────────────
  const caPw = await hash('Demo@123');

  const caData = [
    {
      email: 'ca1@demo.com',
      name: 'Ravi Sharma CA',
      license: 'CA-MUM-001',
      specs: [Specialization.GST, Specialization.INCOME_TAX],
      rate: 1500,
      status: VerificationStatus.VERIFIED,
    },
    {
      email: 'ca2@demo.com',
      name: 'Priya Mehta CA',
      license: 'CA-MUM-002',
      specs: [Specialization.AUDIT, Specialization.INCOME_TAX],
      rate: 2000,
      status: VerificationStatus.VERIFIED,
    },
    {
      email: 'ca3@demo.com',
      name: 'Amit Patel CA',
      license: 'CA-MUM-003',
      specs: [Specialization.GST],
      rate: 1200,
      status: VerificationStatus.PENDING,
    },
  ];

  for (const ca of caData) {
    const u = await prisma.user.upsert({
      where: { email: ca.email },
      update: { password: caPw },
      create: {
        email: ca.email,
        password: caPw,
        role: UserRole.CA,
        name: ca.name,
        phone: `900000200${caData.indexOf(ca) + 1}`,
      },
    });

    await prisma.charteredAccountant.upsert({
      where: { userId: u.id },
      update: { verificationStatus: ca.status },
      create: {
        userId: u.id,
        caLicenseNumber: ca.license,
        specialization: ca.specs,
        experienceYears: 5 + caData.indexOf(ca),
        qualifications: ['CA', 'CPA'],
        verificationStatus: ca.status,
        hourlyRate: ca.rate,
        description: `${ca.name} — experienced chartered accountant.`,
        languages: ['English', 'Hindi'],
        isIndependentPractitioner: true,
      },
    });
    console.log(`  ✓ CA: ${u.email} (${ca.status})`);
  }

  // ── 4. Firm admin (used by firm-related tests) ─────────────────────────────
  const firmAdminUser = await prisma.user.upsert({
    where: { email: 'shahandassociates.1@demo.com' },
    update: { password: caPw },
    create: {
      email: 'shahandassociates.1@demo.com',
      password: caPw,
      role: UserRole.CA,
      name: 'Shah and Associates Admin',
      phone: '9000003001',
    },
  });

  await prisma.charteredAccountant.upsert({
    where: { userId: firmAdminUser.id },
    update: {},
    create: {
      userId: firmAdminUser.id,
      caLicenseNumber: 'CA-MUM-FIRM-001',
      specialization: [Specialization.GST, Specialization.AUDIT],
      experienceYears: 10,
      qualifications: ['CA'],
      verificationStatus: VerificationStatus.VERIFIED,
      hourlyRate: 2500,
      description: 'Senior partner at Shah & Associates.',
      languages: ['English', 'Hindi', 'Gujarati'],
      isIndependentPractitioner: true,
    },
  });
  console.log(`  ✓ Firm Admin: ${firmAdminUser.email}`);

  console.log('\n✅ E2E seed complete.\n');
  console.log('  Credentials for Cypress:');
  console.log('    Admin:      admin@caplatform.com / Admin@123!');
  console.log('    Client 1-5: clientN@demo.com    / Demo@123');
  console.log('    CA 1-3:     caN@demo.com         / Demo@123');
  console.log('    Firm Admin: shahandassociates.1@demo.com / Demo@123');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
