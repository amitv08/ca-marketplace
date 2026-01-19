/**
 * Analytics Sample Data Seeder
 * Creates comprehensive test data for analytics dashboard, experiments, reports, and feature flags
 */

import { PrismaClient, UserRole, ServiceType, ServiceRequestStatus, PaymentStatus, PaymentMethod, ExperimentStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Test user credentials
const TEST_USERS = {
  superAdmin: {
    email: 'superadmin@camarketplace.com',
    password: 'SuperAdmin@2026',
    name: 'Super Admin',
    role: UserRole.SUPER_ADMIN,
  },
  admin: {
    email: 'admin@camarketplace.com',
    password: 'Admin@2026',
    name: 'Admin User',
    role: UserRole.ADMIN,
  },
  ca1: {
    email: 'ca.sharma@camarketplace.com',
    password: 'CAUser@2026',
    name: 'Rajesh Sharma',
    role: UserRole.CA,
  },
  ca2: {
    email: 'ca.verma@camarketplace.com',
    password: 'CAUser@2026',
    name: 'Priya Verma',
    role: UserRole.CA,
  },
  ca3: {
    email: 'ca.patel@camarketplace.com',
    password: 'CAUser@2026',
    name: 'Amit Patel',
    role: UserRole.CA,
  },
  client1: {
    email: 'client.tech@company.com',
    password: 'Client@2026',
    name: 'Tech Solutions Ltd',
    role: UserRole.CLIENT,
  },
  client2: {
    email: 'client.retail@company.com',
    password: 'Client@2026',
    name: 'Retail Ventures Pvt Ltd',
    role: UserRole.CLIENT,
  },
  client3: {
    email: 'client.export@company.com',
    password: 'Client@2026',
    name: 'Export India Corp',
    role: UserRole.CLIENT,
  },
};

async function createUsers() {
  console.log('Creating users...');
  const userIds: Record<string, string> = {};

  for (const [key, userData] of Object.entries(TEST_USERS)) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        role: userData.role,
      },
    });

    userIds[key] = user.id;
    console.log(`  ✓ Created ${userData.role}: ${userData.email}`);
  }

  return userIds;
}

async function createCAProfiles(userIds: Record<string, string>) {
  console.log('\nCreating CA profiles...');

  const caProfiles = [
    {
      userId: userIds.ca1,
      caLicenseNumber: 'CA-2015-123456',
      experienceYears: 9,
      specialization: ['GST', 'INCOME_TAX'],
      qualifications: ['Chartered Accountant', 'B.Com'],
      languages: ['English', 'Hindi'],
      hourlyRate: 2500,
      description: 'Specialized in GST compliance and income tax planning for SMEs',
      verificationStatus: 'VERIFIED',
    },
    {
      userId: userIds.ca2,
      caLicenseNumber: 'CA-2018-789012',
      experienceYears: 6,
      specialization: ['AUDIT', 'TAX_PLANNING'],
      qualifications: ['Chartered Accountant', 'M.Com'],
      languages: ['English', 'Hindi', 'Marathi'],
      hourlyRate: 3000,
      description: 'Expert in statutory audits and corporate tax planning',
      verificationStatus: 'VERIFIED',
    },
    {
      userId: userIds.ca3,
      caLicenseNumber: 'CA-2020-345678',
      experienceYears: 4,
      specialization: ['GST', 'AUDIT', 'ACCOUNTING'],
      qualifications: ['Chartered Accountant'],
      languages: ['English', 'Hindi', 'Gujarati'],
      hourlyRate: 2000,
      description: 'Focused on GST returns and internal audits',
      verificationStatus: 'VERIFIED',
    },
  ];

  for (const profile of caProfiles) {
    await prisma.charteredAccountant.upsert({
      where: { userId: profile.userId },
      update: {},
      create: profile as any,
    });
  }

  console.log(`  ✓ Created ${caProfiles.length} CA profiles`);
}

async function createClientProfiles(userIds: Record<string, string>) {
  console.log('\nCreating client profiles...');

  const clientProfiles = [
    {
      userId: userIds.client1,
      companyName: 'Tech Solutions Ltd',
      address: '123 Tech Park, Bangalore, Karnataka - 560001',
      taxNumber: '29AAAAA0000A1Z5',
    },
    {
      userId: userIds.client2,
      companyName: 'Retail Ventures Pvt Ltd',
      address: '456 Shopping Complex, Mumbai, Maharashtra - 400001',
      taxNumber: '27BBBBB1111B2Z6',
    },
    {
      userId: userIds.client3,
      companyName: 'Export India Corp',
      address: '789 Export Zone, Delhi - 110001',
      taxNumber: '24CCCCC2222C3Z7',
    },
  ];

  for (const profile of clientProfiles) {
    await prisma.client.upsert({
      where: { userId: profile.userId },
      update: {},
      create: profile as any,
    });
  }

  console.log(`  ✓ Created ${clientProfiles.length} client profiles`);
}

async function createServiceRequests(userIds: Record<string, string>) {
  console.log('\nCreating service requests...');

  // Get Client and CA IDs from their profiles
  const client1 = await prisma.client.findUnique({ where: { userId: userIds.client1 } });
  const client2 = await prisma.client.findUnique({ where: { userId: userIds.client2 } });
  const client3 = await prisma.client.findUnique({ where: { userId: userIds.client3 } });

  const ca1 = await prisma.charteredAccountant.findUnique({ where: { userId: userIds.ca1 } });
  const ca2 = await prisma.charteredAccountant.findUnique({ where: { userId: userIds.ca2 } });
  const ca3 = await prisma.charteredAccountant.findUnique({ where: { userId: userIds.ca3 } });

  const requests = [
    // Completed requests
    { clientId: client1!.id, caId: ca1!.id, serviceType: 'GST_FILING', status: 'COMPLETED', estimatedHours: 5 },
    { clientId: client1!.id, caId: ca2!.id, serviceType: 'TAX_PLANNING', status: 'COMPLETED', estimatedHours: 8 },
    { clientId: client2!.id, caId: ca1!.id, serviceType: 'COMPANY_REGISTRATION', status: 'COMPLETED', estimatedHours: 3 },
    { clientId: client2!.id, caId: ca3!.id, serviceType: 'AUDIT', status: 'COMPLETED', estimatedHours: 15 },
    { clientId: client3!.id, caId: ca2!.id, serviceType: 'INCOME_TAX_RETURN', status: 'COMPLETED', estimatedHours: 6 },
    { clientId: client3!.id, caId: ca1!.id, serviceType: 'GST_FILING', status: 'COMPLETED', estimatedHours: 4 },

    // In progress
    { clientId: client1!.id, caId: ca3!.id, serviceType: 'AUDIT', status: 'IN_PROGRESS', estimatedHours: 12 },
    { clientId: client2!.id, caId: ca2!.id, serviceType: 'TAX_PLANNING', status: 'IN_PROGRESS', estimatedHours: 7 },

    // Pending
    { clientId: client3!.id, caId: ca3!.id, serviceType: 'GST_FILING', status: 'PENDING', estimatedHours: 5 },
    { clientId: client1!.id, caId: ca1!.id, serviceType: 'FINANCIAL_CONSULTING', status: 'ACCEPTED', estimatedHours: 2 },
  ];

  const createdRequests = [];
  for (const req of requests) {
    const request = await prisma.serviceRequest.create({
      data: {
        clientId: req.clientId,
        caId: req.caId,
        serviceType: req.serviceType as ServiceType,
        status: req.status as ServiceRequestStatus,
        estimatedHours: req.estimatedHours,
        description: `Professional ${req.serviceType.toLowerCase().replace(/_/g, ' ')} service required for our business operations. Looking for experienced CA with expertise in this domain.`,
      },
    });
    createdRequests.push(request);
  }

  console.log(`  ✓ Created ${createdRequests.length} service requests`);
  return createdRequests;
}

async function createPayments(requests: any[], userIds: Record<string, string>) {
  console.log('\nCreating payments...');

  const completedRequests = requests.filter(r => r.status === 'COMPLETED');
  const payments = [];

  for (const request of completedRequests) {
    const amount = (request.estimatedHours || 5) * 2500; // Average rate
    const platformFee = amount * 0.15; // 15% platform fee
    const caAmount = amount - platformFee;

    const payment = await prisma.payment.create({
      data: {
        clientId: request.clientId,
        caId: request.caId!,
        requestId: request.id,
        amount,
        platformFee,
        caAmount,
        status: PaymentStatus.COMPLETED,
        paymentMethod: PaymentMethod.UPI,
        razorpayOrderId: `order_${Math.random().toString(36).substr(2, 9)}`,
        razorpayPaymentId: `pay_${Math.random().toString(36).substr(2, 9)}`,
        releasedToCA: true,
        releasedAt: new Date(),
      },
    });
    payments.push(payment);
  }

  console.log(`  ✓ Created ${payments.length} payments`);
  return payments;
}

async function createReviews(requests: any[], userIds: Record<string, string>) {
  console.log('\nCreating reviews...');

  const completedRequests = requests.filter(r => r.status === 'COMPLETED');
  const reviews = [];

  const reviewTexts = [
    { rating: 5, comment: 'Excellent service! Very professional and thorough.' },
    { rating: 5, comment: 'Highly recommended. Completed on time with great attention to detail.' },
    { rating: 4, comment: 'Good work overall. Minor delays but quality was good.' },
    { rating: 5, comment: 'Outstanding expertise. Will definitely hire again.' },
    { rating: 4, comment: 'Professional service. Met all requirements.' },
    { rating: 5, comment: 'Best CA I have worked with. Exceptional knowledge.' },
  ];

  for (let i = 0; i < completedRequests.length; i++) {
    const request = completedRequests[i];
    const reviewData = reviewTexts[i % reviewTexts.length];

    const review = await prisma.review.create({
      data: {
        clientId: request.clientId,
        caId: request.caId!,
        requestId: request.id,
        rating: reviewData.rating,
        comment: reviewData.comment,
      },
    });
    reviews.push(review);
  }

  console.log(`  ✓ Created ${reviews.length} reviews`);
}

async function createAnalyticsEvents(userIds: Record<string, string>) {
  console.log('\nCreating analytics events...');

  const events = [];
  const eventTypes = ['USER_REGISTRATION', 'REQUEST_CREATED', 'PAYMENT_COMPLETED', 'REVIEW_CREATED', 'LOGIN', 'PROFILE_VIEW'];

  // Generate events for last 30 days
  for (let day = 30; day >= 0; day--) {
    const date = new Date();
    date.setDate(date.getDate() - day);

    // 5-15 events per day
    const eventsPerDay = Math.floor(Math.random() * 10) + 5;

    for (let i = 0; i < eventsPerDay; i++) {
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const userKeys = Object.keys(userIds);
      const randomUser = userIds[userKeys[Math.floor(Math.random() * userKeys.length)]];

      await prisma.analyticsEvent.create({
        data: {
          eventType,
          userId: randomUser,
          sessionId: `session_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(date.getTime() + Math.random() * 86400000),
          metadata: {
            source: 'web',
            device: Math.random() > 0.3 ? 'desktop' : 'mobile',
          },
        },
      });
    }
  }

  console.log(`  ✓ Created analytics events for last 30 days`);
}

async function createExperiments() {
  console.log('\nCreating A/B test experiments...');

  const experiments = [
    {
      key: 'new_dashboard_layout',
      name: 'New Dashboard Layout',
      description: 'Testing redesigned dashboard with improved navigation',
      status: ExperimentStatus.RUNNING,
      variants: [
        { id: 'control', name: 'Current Layout', weight: 50 },
        { id: 'variant_a', name: 'New Layout', weight: 50 },
      ],
      startDate: new Date('2026-01-10'),
    },
    {
      key: 'pricing_display',
      name: 'Pricing Display Format',
      description: 'Testing hourly vs package pricing display',
      status: ExperimentStatus.RUNNING,
      variants: [
        { id: 'hourly', name: 'Hourly Rate', weight: 50 },
        { id: 'package', name: 'Package Pricing', weight: 50 },
      ],
      startDate: new Date('2026-01-12'),
    },
    {
      key: 'onboarding_flow',
      name: 'User Onboarding Flow',
      description: 'Single-page vs multi-step onboarding',
      status: ExperimentStatus.COMPLETED,
      variants: [
        { id: 'single', name: 'Single Page', weight: 50 },
        { id: 'multi', name: 'Multi-Step', weight: 50 },
      ],
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-15'),
      winningVariant: 'multi',
    },
  ];

  for (const exp of experiments) {
    await prisma.experiment.upsert({
      where: { key: exp.key },
      update: {},
      create: exp as any,
    });
  }

  console.log(`  ✓ Created ${experiments.length} experiments`);
}

async function createFeatureFlags() {
  console.log('\nCreating feature flags...');

  const flags = [
    {
      key: 'advanced_search',
      name: 'Advanced Search',
      description: 'Enable advanced search filters for CA discovery',
      enabled: true,
      rolloutPercent: 100,
      targetRoles: [UserRole.CLIENT],
      targetUserIds: [],
    },
    {
      key: 'video_consultation',
      name: 'Video Consultation',
      description: 'Enable video consultation feature',
      enabled: true,
      rolloutPercent: 50,
      targetRoles: [UserRole.CA, UserRole.CLIENT],
      targetUserIds: [],
    },
    {
      key: 'ai_document_analysis',
      name: 'AI Document Analysis',
      description: 'AI-powered document analysis for tax returns',
      enabled: false,
      rolloutPercent: 0,
      targetRoles: [UserRole.CA],
      targetUserIds: [],
    },
    {
      key: 'subscription_plans',
      name: 'Subscription Plans',
      description: 'Monthly subscription plans for clients',
      enabled: true,
      rolloutPercent: 25,
      targetRoles: [UserRole.CLIENT],
      targetUserIds: [],
    },
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {},
      create: flag as any,
    });
  }

  console.log(`  ✓ Created ${flags.length} feature flags`);
}

async function createScheduledReports(userIds: Record<string, string>) {
  console.log('\nCreating scheduled reports...');

  const reports = [
    {
      name: 'Monthly Revenue Report',
      reportType: 'MONTHLY_REVENUE',
      schedule: '0 0 1 * *', // 1st of every month at midnight
      format: 'PDF',
      recipients: [TEST_USERS.admin.email, TEST_USERS.superAdmin.email],
      enabled: true,
      filters: {},
    },
    {
      name: 'Weekly Platform Stats',
      reportType: 'PLATFORM_STATS',
      schedule: '0 9 * * 1', // Every Monday at 9am
      format: 'CSV',
      recipients: [TEST_USERS.superAdmin.email],
      enabled: true,
      filters: {},
    },
    {
      name: 'CA Performance Report',
      reportType: 'CA_PERFORMANCE',
      schedule: '0 0 * * *', // Daily at midnight
      format: 'BOTH',
      recipients: [TEST_USERS.admin.email],
      enabled: false,
      filters: {},
    },
  ];

  for (const report of reports) {
    await prisma.scheduledReport.create({
      data: report as any,
    });
  }

  console.log(`  ✓ Created ${reports.length} scheduled reports`);
}

async function createDailyMetrics() {
  console.log('\nCreating daily metrics aggregates...');

  // Create daily metrics for last 30 days
  for (let day = 30; day >= 0; day--) {
    const date = new Date();
    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);

    const newUsers = Math.floor(Math.random() * 5) + 1;
    const requestsCreated = Math.floor(Math.random() * 8) + 2;
    const paymentsCompleted = Math.floor(Math.random() * 6) + 1;
    const totalRevenue = paymentsCompleted * (Math.random() * 5000 + 3000);

    await prisma.dailyMetric.upsert({
      where: { date },
      update: {},
      create: {
        date,
        newUsers,
        newClients: Math.floor(newUsers * 0.6),
        newCAs: Math.floor(newUsers * 0.4),
        requestsCreated,
        requestsCompleted: Math.floor(requestsCreated * 0.7),
        paymentsCompleted,
        totalRevenue,
        platformFees: totalRevenue * 0.15,
        reviewsCreated: Math.floor(paymentsCompleted * 0.8),
        averageRating: 4.5 + Math.random() * 0.5,
      },
    });
  }

  console.log(`  ✓ Created daily metrics for last 30 days`);
}

async function main() {
  console.log('🚀 Starting analytics data seeding...\n');

  try {
    // Create users and profiles
    const userIds = await createUsers();
    await createCAProfiles(userIds);
    await createClientProfiles(userIds);

    // Create business data
    const requests = await createServiceRequests(userIds);
    await createPayments(requests, userIds);
    await createReviews(requests, userIds);

    // Create analytics data
    await createAnalyticsEvents(userIds);
    await createDailyMetrics();

    // Create experiments and feature flags
    await createExperiments();
    await createFeatureFlags();
    await createScheduledReports(userIds);

    console.log('\n✅ Analytics data seeding completed successfully!');
    console.log('\n📋 Test Credentials:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n🔐 SUPER ADMIN');
    console.log(`   Email:    ${TEST_USERS.superAdmin.email}`);
    console.log(`   Password: ${TEST_USERS.superAdmin.password}`);
    console.log('\n🔐 ADMIN');
    console.log(`   Email:    ${TEST_USERS.admin.email}`);
    console.log(`   Password: ${TEST_USERS.admin.password}`);
    console.log('\n👨‍💼 CHARTERED ACCOUNTANT #1');
    console.log(`   Email:    ${TEST_USERS.ca1.email}`);
    console.log(`   Password: ${TEST_USERS.ca1.password}`);
    console.log('\n👨‍💼 CHARTERED ACCOUNTANT #2');
    console.log(`   Email:    ${TEST_USERS.ca2.email}`);
    console.log(`   Password: ${TEST_USERS.ca2.password}`);
    console.log('\n👨‍💼 CHARTERED ACCOUNTANT #3');
    console.log(`   Email:    ${TEST_USERS.ca3.email}`);
    console.log(`   Password: ${TEST_USERS.ca3.password}`);
    console.log('\n🏢 CLIENT #1');
    console.log(`   Email:    ${TEST_USERS.client1.email}`);
    console.log(`   Password: ${TEST_USERS.client1.password}`);
    console.log('\n🏢 CLIENT #2');
    console.log(`   Email:    ${TEST_USERS.client2.email}`);
    console.log(`   Password: ${TEST_USERS.client2.password}`);
    console.log('\n🏢 CLIENT #3');
    console.log(`   Email:    ${TEST_USERS.client3.email}`);
    console.log(`   Password: ${TEST_USERS.client3.password}`);
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('\n📊 Data Summary:');
    console.log(`   • Users: ${Object.keys(TEST_USERS).length}`);
    console.log(`   • Service Requests: ${requests.length}`);
    console.log(`   • Experiments: 3`);
    console.log(`   • Feature Flags: 4`);
    console.log(`   • Scheduled Reports: 3`);
    console.log(`   • Daily Metrics: 31 days`);
    console.log('\n🌐 Access URLs:');
    console.log(`   Frontend:  http://localhost:3001`);
    console.log(`   Backend:   http://localhost:8081/api`);
    console.log(`   PGAdmin:   http://localhost:5051`);
    console.log('\n');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
