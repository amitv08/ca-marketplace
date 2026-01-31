/**
 * Demo Data Seeding Script
 * Creates realistic demo data for product demonstration
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Demo data configuration
const DEMO_CONFIG = {
  clients: 5,
  soloCAs: 8,
  smallFirms: 3,  // 3 members each
  mediumFirms: 2, // 15 members each
  serviceRequests: 15,
  payments: 10,
  reviews: 8
};

// Cities and specializations for variety
const CITIES = [
  { city: 'Mumbai', state: 'Maharashtra' },
  { city: 'Delhi', state: 'Delhi' },
  { city: 'Bangalore', state: 'Karnataka' },
  { city: 'Chennai', state: 'Tamil Nadu' },
  { city: 'Pune', state: 'Maharashtra' },
  { city: 'Hyderabad', state: 'Telangana' }
];

const SPECIALIZATIONS = [
  ['GST', 'TAX_PLANNING'],
  ['AUDIT', 'ACCOUNTING'],
  ['INCOME_TAX', 'TAX_PLANNING'],
  ['COMPANY_LAW', 'ACCOUNTING'],
  ['ACCOUNTING', 'FINANCIAL_PLANNING'],
  ['GST', 'INCOME_TAX']
];

const SERVICE_TYPES = [
  'GST_FILING',
  'INCOME_TAX_RETURN',
  'AUDIT',
  'ACCOUNTING',
  'TAX_PLANNING',
  'FINANCIAL_CONSULTING',
  'COMPANY_REGISTRATION'
];

const FIRM_NAMES = [
  'Shah & Associates',
  'Gupta Tax Consultants LLP',
  'Professional Accounting Services',
  'Elite CA Firm',
  'Corporate Tax Solutions'
];

const CA_NAMES = [
  'Rajesh Kumar', 'Priya Sharma', 'Amit Patel', 'Sneha Reddy',
  'Vikram Singh', 'Anjali Desai', 'Rahul Mehta', 'Kavita Iyer',
  'Arjun Nair', 'Divya Chopra', 'Sanjay Gupta', 'Neha Agarwal',
  'Karthik Menon', 'Pooja Jain', 'Manish Verma', 'Ritu Saxena'
];

const CLIENT_NAMES = [
  'ABC Pvt Ltd', 'XYZ Technologies', 'Global Trading Co',
  'Tech Innovations Inc', 'Retail Solutions Ltd'
];

// Utility functions
const getRandomElement = (array) => array[Math.floor(Math.random() * array.length)];
const getRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomDate = (daysBack) => {
  const date = new Date();
  date.setDate(date.getDate() - getRandomNumber(1, daysBack));
  return date;
};

// Create demo users and profiles
async function createDemoClients() {
  console.log('\n📋 Creating demo clients...');
  const clients = [];

  for (let i = 0; i < DEMO_CONFIG.clients; i++) {
    const location = getRandomElement(CITIES);
    const hashedPassword = await bcrypt.hash('Demo@123', 10);

    try {
      const user = await prisma.user.create({
        data: {
          name: CLIENT_NAMES[i] || `Client Company ${i + 1}`,
          email: `client${i + 1}@demo.com`,
          password: hashedPassword,
          phone: `98765${String(43210 + i).padStart(5, '0')}`,
          role: 'CLIENT',
          client: {
            create: {
              companyName: CLIENT_NAMES[i] || `Client Company ${i + 1}`,
              taxNumber: `29AAAAA${String(1000 + i).padStart(4, '0')}A1Z5`,
              address: `${getRandomNumber(1, 999)} Business Park, ${location.city}, ${location.state}`
            }
          }
        },
        include: { client: true }
      });

      clients.push(user);
      console.log(`  ✓ Created client: ${user.name} (${user.email})`);
    } catch (error) {
      console.log(`  ⚠ Skipped client ${i + 1} (${error.message})`);
    }
  }

  return clients;
}

async function createDemoSoloCAs() {
  console.log('\n👤 Creating solo CA practitioners...');
  const soloCAs = [];

  for (let i = 0; i < DEMO_CONFIG.soloCAs; i++) {
    const location = getRandomElement(CITIES);
    const specialization = getRandomElement(SPECIALIZATIONS);
    const experience = getRandomNumber(3, 20);
    const hashedPassword = await bcrypt.hash('Demo@123', 10);

    try {
      const user = await prisma.user.create({
        data: {
          name: `CA ${CA_NAMES[i] || `Professional ${i + 1}`}`,
          email: `ca${i + 1}@demo.com`,
          password: hashedPassword,
          phone: `99887${String(66000 + i).padStart(5, '0')}`,
          role: 'CA',
          charteredAccountant: {
            create: {
              caLicenseNumber: `ICAI${String(100000 + i).padStart(6, '0')}`,
              verificationStatus: 'VERIFIED',
              specialization: specialization,
              experienceYears: experience,
              hourlyRate: 1000 + (experience * 100),
              qualifications: ['CA', 'B.Com'],
              languages: ['English', 'Hindi'],
              description: `Experienced ${specialization[0]} specialist with ${experience} years of practice in ${location.city}`,
              isIndependentPractitioner: true,
              panNumber: `AAAAA${String(1000 + i).padStart(4, '0')}A`
            }
          }
        },
        include: { charteredAccountant: true }
      });

      soloCAs.push(user);
      console.log(`  ✓ Created CA: ${user.name} (${user.email})`);
    } catch (error) {
      console.log(`  ⚠ Skipped CA ${i + 1} (${error.message})`);
    }
  }

  return soloCAs;
}

async function createDemoFirm(firmIndex, memberCount) {
  const location = getRandomElement(CITIES);
  const firmName = FIRM_NAMES[firmIndex] || `Demo Firm ${firmIndex + 1}`;
  const hashedPassword = await bcrypt.hash('Demo@123', 10);

  // Create valid email by removing special characters
  const emailPrefix = firmName.toLowerCase()
    .replace(/\s+/g, '')       // Remove spaces
    .replace(/&/g, 'and')      // Replace & with 'and'
    .replace(/[^a-z0-9]/g, ''); // Remove any other special chars

  try {
    // Create firm
    const firm = await prisma.cAFirm.create({
      data: {
        firmName: firmName,
        firmType: memberCount > 10 ? 'LLP' : 'PARTNERSHIP',
        registrationNumber: `REG${String(10000 + firmIndex).padStart(6, '0')}`,
        pan: `AAAAA${String(1000 + firmIndex).padStart(4, '0')}A`,
        gstin: `29AAAAA${String(1000 + firmIndex).padStart(4, '0')}A1Z5`,
        email: `${emailPrefix}@demo.com`,
        phone: `91234${String(56000 + firmIndex).padStart(5, '0')}`,
        address: `${getRandomNumber(1, 999)} Corporate Center, ${location.city}`,
        city: location.city,
        state: location.state,
        pincode: `${400000 + getRandomNumber(1, 99999)}`,
        establishedYear: 2010 + getRandomNumber(0, 13),
        status: 'ACTIVE',
        verificationLevel: memberCount > 10 ? 'PREMIUM' : 'VERIFIED',
        specializations: getRandomElement(SPECIALIZATIONS),
        description: `Leading ${location.city}-based CA firm specializing in comprehensive accounting services`
      }
    });

    // Create members
    const members = [];
    const roles = ['FIRM_ADMIN', 'SENIOR_CA', 'SENIOR_CA', 'SENIOR_CA', 'JUNIOR_CA', 'JUNIOR_CA', 'JUNIOR_CA', 'CONSULTANT'];

    for (let i = 0; i < memberCount; i++) {
      const memberName = CA_NAMES[(firmIndex * 10 + i) % CA_NAMES.length];
      const role = i < roles.length ? roles[i] : 'JUNIOR_CA';
      const specialization = getRandomElement(SPECIALIZATIONS);
      const experience = role === 'FIRM_ADMIN' ? getRandomNumber(10, 20) :
                        role === 'SENIOR_CA' || role === 'CONSULTANT' ? getRandomNumber(5, 12) :
                        getRandomNumber(2, 8);

      try {
        const user = await prisma.user.create({
          data: {
            name: `CA ${memberName}`,
            email: `${emailPrefix}.${i + 1}@demo.com`,
            password: hashedPassword,
            phone: `98765${String(10000 + firmIndex * 100 + i).padStart(5, '0')}`,
            role: 'CA',
            charteredAccountant: {
              create: {
                caLicenseNumber: `ICAI${String(200000 + firmIndex * 100 + i).padStart(6, '0')}`,
                verificationStatus: 'VERIFIED',
                specialization: specialization,
                experienceYears: experience,
                hourlyRate: 1500 + (experience * 150),
                qualifications: ['CA', 'B.Com'],
                languages: ['English', 'Hindi'],
                description: `${role.replace(/_/g, ' ')} at ${firmName}`,
                isIndependentPractitioner: false,
                currentFirmId: firm.id,
                panNumber: `AAAAA${String(2000 + firmIndex * 100 + i).padStart(4, '0')}A`
              }
            }
          },
          include: { charteredAccountant: true }
        });

        // Add firm membership
        await prisma.firmMembership.create({
          data: {
            firmId: firm.id,
            caId: user.charteredAccountant.id,
            role: role,
            membershipType: role === 'CONSULTANT' ? 'PART_TIME' : 'FULL_TIME',
            isActive: true,
            joinDate: getRandomDate(365 * 2),
            canWorkIndependently: role === 'FIRM_ADMIN' || role === 'SENIOR_CA',
            commissionPercent: role === 'FIRM_ADMIN' ? 40.0 :
                              role === 'SENIOR_CA' ? 30.0 :
                              role === 'CONSULTANT' ? 25.0 : 20.0
          }
        });

        members.push(user);
        console.log(`    ✓ Added member: ${user.name} (${role})`);
      } catch (error) {
        console.log(`    ⚠ Skipped member ${i + 1} (${error.message})`);
      }
    }

    console.log(`  ✓ Created firm: ${firmName} with ${members.length} members`);
    return { firm, members };
  } catch (error) {
    console.log(`  ⚠ Skipped firm ${firmIndex + 1} (${error.message})`);
    return null;
  }
}

async function createDemoFirms() {
  console.log('\n🏢 Creating demo firms...');
  const firms = [];

  // Small firms (3 members)
  for (let i = 0; i < DEMO_CONFIG.smallFirms; i++) {
    const firmData = await createDemoFirm(i, 3);
    if (firmData) firms.push(firmData);
  }

  // Medium firms (15 members)
  for (let i = 0; i < DEMO_CONFIG.mediumFirms; i++) {
    const firmData = await createDemoFirm(DEMO_CONFIG.smallFirms + i, 15);
    if (firmData) firms.push(firmData);
  }

  return firms;
}

async function createDemoServiceRequests(clients, cas) {
  console.log('\n📝 Creating demo service requests...');
  const requests = [];

  const allCAs = [...cas];

  for (let i = 0; i < DEMO_CONFIG.serviceRequests; i++) {
    if (clients.length === 0 || allCAs.length === 0) break;

    const client = getRandomElement(clients);
    const ca = getRandomElement(allCAs);
    const serviceType = getRandomElement(SERVICE_TYPES);
    const statuses = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'];
    const status = getRandomElement(statuses);

    try {
      const request = await prisma.serviceRequest.create({
        data: {
          clientId: client.client.id,
          caId: ca.charteredAccountant.id,
          serviceType: serviceType,
          description: `Need professional ${serviceType.replace(/_/g, ' ').toLowerCase()} services for FY 2023-24. Require assistance with compliance and timely completion.`,
          deadline: new Date(Date.now() + getRandomNumber(7, 90) * 24 * 60 * 60 * 1000),
          estimatedHours: getRandomNumber(5, 50),
          status: status,
          createdAt: getRandomDate(60)
        }
      });

      requests.push(request);
      console.log(`  ✓ Created request: ${serviceType.replace(/_/g, ' ')} (${status})`);
    } catch (error) {
      console.log(`  ⚠ Skipped request ${i + 1} (${error.message})`);
    }
  }

  return requests;
}

async function createDemoPayments(requests) {
  console.log('\n💰 Creating demo payments...');
  const payments = [];

  const completedRequests = requests.filter(r => r.status === 'COMPLETED');

  for (let i = 0; i < Math.min(DEMO_CONFIG.payments, completedRequests.length); i++) {
    const request = completedRequests[i];
    const amount = request.budget || getRandomNumber(10000, 100000);
    const platformFee = Math.round(amount * 0.15);
    const caEarning = amount - platformFee;

    try {
      const payment = await prisma.payment.create({
        data: {
          requestId: request.id,
          clientId: request.clientId,
          caId: request.caId,
          amount: amount,
          platformFee: platformFee,
          caAmount: caEarning,
          status: 'COMPLETED',
          paymentMethod: getRandomElement(['RAZORPAY', 'BANK_TRANSFER', 'UPI']),
          transactionId: `TXN${Date.now()}${i}`,
          releasedToCA: true,
          releasedAt: getRandomDate(30),
          createdAt: getRandomDate(35)
        }
      });

      payments.push(payment);
      console.log(`  ✓ Created payment: ₹${amount.toLocaleString()}`);
    } catch (error) {
      console.log(`  ⚠ Skipped payment ${i + 1} (${error.message})`);
    }
  }

  return payments;
}

async function createDemoReviews(requests) {
  console.log('\n⭐ Creating demo reviews...');
  const reviews = [];

  const completedRequests = requests.filter(r => r.status === 'COMPLETED');

  const reviewTexts = [
    'Excellent service! Very professional and timely delivery.',
    'Great experience working with this CA. Highly recommended!',
    'Very knowledgeable and helpful. Will work with them again.',
    'Good service but could improve communication.',
    'Outstanding work quality. Exceeded expectations!',
    'Professional and efficient. Very satisfied with the service.',
    'Prompt response and quality work. Thank you!',
    'Helpful and patient in explaining complex tax matters.'
  ];

  for (let i = 0; i < Math.min(DEMO_CONFIG.reviews, completedRequests.length); i++) {
    const request = completedRequests[i];
    const rating = getRandomNumber(4, 5);

    try {
      const review = await prisma.review.create({
        data: {
          requestId: request.id,
          clientId: request.clientId,
          caId: request.caId,
          rating: rating,
          comment: reviewTexts[i % reviewTexts.length],
          createdAt: getRandomDate(25)
        }
      });

      reviews.push(review);
      console.log(`  ✓ Created review: ${rating} stars for request ${request.id.substring(0, 8)}`);
    } catch (error) {
      console.log(`  ⚠ Skipped review ${i + 1} (${error.message})`);
    }
  }

  return reviews;
}

// Main seeding function
async function main() {
  console.log('🌱 Starting demo data seeding...');
  console.log('================================');

  try {
    // Create demo data
    const clients = await createDemoClients();
    const soloCAs = await createDemoSoloCAs();
    const firms = await createDemoFirms();

    // Collect all CAs (solo + firm members)
    const allCAs = [...soloCAs];
    firms.forEach(firmData => {
      if (firmData && firmData.members) {
        allCAs.push(...firmData.members);
      }
    });

    const requests = await createDemoServiceRequests(clients, allCAs);
    const payments = await createDemoPayments(requests);
    const reviews = await createDemoReviews(requests);

    console.log('\n================================');
    console.log('✅ Demo data seeding complete!');
    console.log('================================');
    console.log('\n📊 Summary:');
    console.log(`  Clients:          ${clients.length}`);
    console.log(`  Solo CAs:         ${soloCAs.length}`);
    console.log(`  Firms:            ${firms.length}`);
    console.log(`  Total CAs:        ${allCAs.length}`);
    console.log(`  Service Requests: ${requests.length}`);
    console.log(`  Payments:         ${payments.length}`);
    console.log(`  Reviews:          ${reviews.length}`);

    console.log('\n🔐 Demo Login Credentials:');
    console.log('  Clients:     client1@demo.com to client5@demo.com');
    console.log('  Solo CAs:    ca1@demo.com to ca8@demo.com');
    console.log('  Firm Members: Check firm emails (e.g., shah&associates.1@demo.com)');
    console.log('  Password:    Demo@123');

    console.log('\n🎬 Ready for demo!');
  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeder
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
