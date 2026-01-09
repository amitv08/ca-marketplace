● I'll provide you with example data for testing CA and Client functionality in the browser.

  Test User Accounts

  👨‍💼 Chartered Accountants (CAs)

  CA 1: Senior Tax Specialist

  {
    "name": "Rajesh Kumar",
    "email": "rajesh.kumar@catest.com",
    "password": "Test@123",
    "phone": "+919876543210",
    "role": "CA",
    "licenseNumber": "CA-12345-MH",
    "specializations": ["INCOME_TAX", "GST"],
    "yearsOfExperience": 12,
    "hourlyRate": 2500,
    "bio": "Experienced CA specializing in Income Tax planning and GST compliance. Helped 200+ businesses optimize their tax structure. Expert in corporate taxation and international tax laws.",
    "qualifications": "CA, CPA (USA)",
    "languages": ["English", "Hindi", "Marathi"]
  }

  CA 2: Audit Expert

  {
    "name": "Priya Sharma",
    "email": "priya.sharma@catest.com",
    "password": "Test@123",
    "phone": "+919876543211",
    "role": "CA",
    "licenseNumber": "CA-67890-DL",
    "specializations": ["AUDIT", "GST"],
    "yearsOfExperience": 8,
    "hourlyRate": 2000,
    "bio": "Certified CA with expertise in statutory audits, internal audits, and GST compliance. Served 150+ SMEs and startups with comprehensive audit services.",
    "qualifications": "CA, DISA",
    "languages": ["English", "Hindi", "Punjabi"]
  }

  CA 3: GST Specialist

  {
    "name": "Amit Patel",
    "email": "amit.patel@catest.com",
    "password": "Test@123",
    "phone": "+919876543212",
    "role": "CA",
    "licenseNumber": "CA-24680-GJ",
    "specializations": ["GST"],
    "yearsOfExperience": 5,
    "hourlyRate": 1500,
    "bio": "GST compliance specialist with deep understanding of Indian taxation system. Helping businesses navigate complex GST regulations and ensuring 100% compliance.",
    "qualifications": "CA",
    "languages": ["English", "Hindi", "Gujarati"]
  }

  CA 4: All-rounder

  {
    "name": "Sneha Reddy",
    "email": "sneha.reddy@catest.com",
    "password": "Test@123",
    "phone": "+919876543213",
    "role": "CA",
    "licenseNumber": "CA-13579-TG",
    "specializations": ["INCOME_TAX", "GST", "AUDIT"],
    "yearsOfExperience": 15,
    "hourlyRate": 3000,
    "bio": "Senior CA with comprehensive expertise across Income Tax, GST, and Audit services. 15 years of experience serving Fortune 500 companies and growing startups.",
    "qualifications": "CA, MBA (Finance)",
    "languages": ["English", "Hindi", "Telugu"]
  }

  ---
  👔 Clients (Businesses)

  Client 1: Tech Startup

  {
    "name": "Rahul Verma",
    "email": "rahul.verma@techstartup.com",
    "password": "Test@123",
    "phone": "+919876543220",
    "role": "CLIENT",
    "companyName": "TechVentures India Pvt Ltd",
    "gstNumber": "27AABCT1332L1Z5",
    "industry": "Information Technology",
    "address": "WeWork, Prestige Atlanta, Bangalore - 560045",
    "city": "Bangalore",
    "state": "Karnataka",
    "pincode": "560045"
  }

  Client 2: E-commerce Business

  {
    "name": "Neha Agarwal",
    "email": "neha.agarwal@shopmart.com",
    "password": "Test@123",
    "phone": "+919876543221",
    "role": "CLIENT",
    "companyName": "ShopMart Online Solutions",
    "gstNumber": "07AABCS1234F1Z1",
    "industry": "E-commerce",
    "address": "Cyber Hub, DLF Phase 2, Gurgaon - 122002",
    "city": "Gurgaon",
    "state": "Haryana",
    "pincode": "122002"
  }

  Client 3: Manufacturing Company

  {
    "name": "Suresh Mehta",
    "email": "suresh.mehta@steelworks.com",
    "password": "Test@123",
    "phone": "+919876543222",
    "role": "CLIENT",
    "companyName": "Mehta Steel Industries Pvt Ltd",
    "gstNumber": "24AABCM1234D1Z8",
    "industry": "Manufacturing",
    "address": "GIDC Industrial Estate, Vapi - 396195",
    "city": "Vapi",
    "state": "Gujarat",
    "pincode": "396195"
  }

  Client 4: Restaurant Chain

  {
    "name": "Anita Singh",
    "email": "anita.singh@foodhaven.com",
    "password": "Test@123",
    "phone": "+919876543223",
    "role": "CLIENT",
    "companyName": "Food Haven Restaurant Chain",
    "gstNumber": "09AABCF1234G1ZP",
    "industry": "Food & Beverage",
    "address": "Connaught Place, New Delhi - 110001",
    "city": "New Delhi",
    "state": "Delhi",
    "pincode": "110001"
  }

  Client 5: Real Estate

  {
    "name": "Vikram Malhotra",
    "email": "vikram.malhotra@primerealty.com",
    "password": "Test@123",
    "phone": "+919876543224",
    "role": "CLIENT",
    "companyName": "Prime Realty Developers",
    "gstNumber": "27AABCP1234H1Z2",
    "industry": "Real Estate",
    "address": "Bandra Kurla Complex, Mumbai - 400051",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400051"
  }

  ---
  Testing Scenarios

  Scenario 1: Complete Registration to Payment Flow

  Step 1: Register as CA (Rajesh Kumar)

  1. Go to: http://localhost:3000/register
  2. Fill in:
     - Name: Rajesh Kumar
     - Email: rajesh.kumar@catest.com
     - Password: Test@123
     - Phone: +919876543210
     - Role: Chartered Accountant
  3. After registration, complete CA profile:
     - License Number: CA-12345-MH
     - Specializations: Income Tax, GST
     - Years of Experience: 12
     - Hourly Rate: ₹2500
     - Bio: [Use bio from above]

  Step 2: Register as Client (Rahul Verma)

  1. Go to: http://localhost:3000/register
  2. Fill in:
     - Name: Rahul Verma
     - Email: rahul.verma@techstartup.com
     - Password: Test@123
     - Phone: +919876543220
     - Role: Client
  3. After registration, complete Client profile:
     - Company Name: TechVentures India Pvt Ltd
     - GST Number: 27AABCT1332L1Z5
     - Industry: Information Technology
     - Address: WeWork, Prestige Atlanta, Bangalore - 560045

  Step 3: Browse CAs (as Rahul - Client)

  1. Login as: rahul.verma@techstartup.com
  2. Go to: Browse CAs or Search CAs
  3. Filter by:
     - Specialization: Income Tax
     - Max Rate: ₹3000/hour
  4. View Rajesh Kumar's profile

  Step 4: Create Service Request

  1. Click "Request Service" on Rajesh Kumar's profile
  2. Fill in:
     - Service Type: INCOME_TAX
     - Description: "Need assistance with TDS filing and tax planning for FY 2024-25"
     - Budget: ₹25000
     - Deadline: [Select date 2 weeks from now]
     - Priority: HIGH

  Step 5: CA Accepts Request

  1. Logout and login as: rajesh.kumar@catest.com
  2. Go to: Dashboard or Service Requests
  3. View pending request from TechVentures
  4. Click "Accept Request"
  5. Add note: "Happy to help with your tax planning. Let's schedule a call."

  Step 6: Client Initiates Payment

  1. Logout and login as: rahul.verma@techstartup.com
  2. Go to: My Service Requests
  3. Click on accepted request
  4. Click "Pay Now"
  5. Razorpay test payment:
     - Amount: ₹25000
     - Use Razorpay test card: 4111 1111 1111 1111
     - CVV: Any 3 digits
     - Expiry: Any future date

  Step 7: CA Marks Service Complete

  1. Login as: rajesh.kumar@catest.com
  2. Go to service request
  3. Upload deliverables (if needed)
  4. Click "Mark as Complete"

  Step 8: Client Leaves Review

  1. Login as: rahul.verma@techstartup.com
  2. Go to completed service request
  3. Click "Leave Review"
  4. Rating: 5 stars
  5. Review: "Excellent service! Very knowledgeable and responsive. Helped save significant tax amount."

  ---
  Scenario 2: Multiple Service Requests

  Service Request Examples

  Request 1: GST Compliance
  {
    "serviceType": "GST",
    "description": "Need help with quarterly GST return filing for Q3 FY24. Total transactions: 500+",
    "budget": 15000,
    "deadline": "2024-02-15",
    "priority": "MEDIUM",
    "attachments": []
  }

  Request 2: Annual Audit
  {
    "serviceType": "AUDIT",
    "description": "Require statutory audit for FY 2023-24. Company turnover: ₹5 Cr. Manufacturing business with inventory.",
    "budget": 50000,
    "deadline": "2024-03-31",
    "priority": "HIGH",
    "attachments": ["financial_statements.pdf", "trial_balance.xlsx"]
  }

  Request 3: Income Tax Filing
  {
    "serviceType": "INCOME_TAX",
    "description": "Individual ITR filing for AY 2024-25. Salary income + capital gains from equity sales.",
    "budget": 5000,
    "deadline": "2024-07-31",
    "priority": "LOW",
    "attachments": ["form16.pdf", "capital_gains_statement.pdf"]
  }

  ---
  Scenario 3: CA Availability Management

  Setting Availability (as CA)

  1. Login as any CA
  2. Go to: My Availability
  3. Add available slots:
     - Monday: 10:00 AM - 1:00 PM, 2:00 PM - 6:00 PM
     - Tuesday: 10:00 AM - 1:00 PM, 2:00 PM - 6:00 PM
     - Wednesday: 10:00 AM - 1:00 PM
     - Thursday: 10:00 AM - 1:00 PM, 2:00 PM - 6:00 PM
     - Friday: 10:00 AM - 1:00 PM, 2:00 PM - 5:00 PM

  ---
  Scenario 4: Messaging Between CA and Client

  Sample Messages

  From Client to CA (Initial Inquiry):
  Subject: Inquiry about GST services

  Hi Rajesh,

  I'm looking for ongoing GST compliance support for my e-commerce business.
  We process around 1000 transactions monthly across multiple states.

  Can you provide:
  1. Monthly GST return filing
  2. GST reconciliation
  3. Advisory on input tax credit

  Looking forward to your response.

  Best regards,
  Rahul

  From CA to Client (Response):
  Subject: Re: Inquiry about GST services

  Hi Rahul,

  Thank you for reaching out. I have extensive experience with e-commerce
  GST compliance and can definitely help you.

  For your requirements:
  1. Monthly GST Return Filing: ₹8,000/month
  2. GST Reconciliation: ₹5,000/month
  3. ITC Advisory: Included in package

  Total monthly retainer: ₹13,000 + GST

  Would you like to schedule a call to discuss further?

  Best regards,
  Rajesh Kumar
  CA-12345-MH

  ---
  Scenario 5: Admin Functions

  Admin User

  {
    "email": "admin@camarketplace.com",
    "password": "Admin@123",
    "role": "ADMIN"
  }

  Admin Actions to Test:

  1. Verify CA Profiles
     - Review pending CA verifications
     - Approve/reject CA applications
     - Check license validity

  2. Monitor Transactions
     - View all service requests
     - Track payment status
     - Review dispute cases

  3. Platform Analytics
     - Total users (CAs, Clients)
     - Revenue metrics
     - Service request trends
     - Top performing CAs

  4. Error Management (NEW)
     - Check circuit breakers: /api/error-management/circuit-breakers
     - Monitor failed operations: /api/error-management/queues
     - Process failed emails: /api/error-management/process-failed-emails

  ---
  Quick Test Data SQL Inserts

  If you want to populate database quickly, here are SQL inserts:

  -- Insert Test Users
  INSERT INTO "User" (id, name, email, password, phone, role, verified, "createdAt", "updatedAt")
  VALUES
    (gen_random_uuid(), 'Rajesh Kumar', 'rajesh.kumar@catest.com', '$2b$10$HashedPasswordHere', '+919876543210', 'CA', true, NOW(), NOW()),
    (gen_random_uuid(), 'Rahul Verma', 'rahul.verma@techstartup.com', '$2b$10$HashedPasswordHere', '+919876543220', 'CLIENT', true, NOW(), NOW());

  -- Insert CA Profile
  INSERT INTO "CharteredAccountant" (id, "userId", "licenseNumber", specializations, "yearsOfExperience", "hourlyRate", verified, bio, "createdAt", "updatedAt")
  SELECT
    gen_random_uuid(),
    id,
    'CA-12345-MH',
    ARRAY['INCOME_TAX', 'GST']::text[],
    12,
    2500,
    true,
    'Experienced CA specializing in Income Tax planning and GST compliance.',
    NOW(),
    NOW()
  FROM "User" WHERE email = 'rajesh.kumar@catest.com';

  -- Insert Client Profile
  INSERT INTO "Client" (id, "userId", "companyName", "gstNumber", "createdAt", "updatedAt")
  SELECT
    gen_random_uuid(),
    id,
    'TechVentures India Pvt Ltd',
    '27AABCT1332L1Z5',
    NOW(),
    NOW()
  FROM "User" WHERE email = 'rahul.verma@techstartup.com';

  ---
  Testing Checklist

  ✅ Registration & Authentication

  - Register as CA
  - Register as Client
  - Login with email/password
  - Password validation
  - Email verification (if enabled)

  ✅ CA Profile Management

  - Complete CA profile
  - Update profile information
  - Upload profile image
  - Set hourly rate
  - Add specializations

  ✅ Client Profile Management

  - Complete client profile
  - Update company information
  - View service request history

  ✅ Service Discovery

  - Browse all CAs
  - Search CAs by specialization
  - Filter by hourly rate
  - View CA detailed profile
  - Check CA reviews/ratings

  ✅ Service Requests

  - Create service request
  - CA receives notification
  - CA accepts/rejects request
  - Update request status
  - Upload documents

  ✅ Payments (Razorpay)

  - Initiate payment
  - Razorpay checkout opens
  - Complete test payment
  - Payment confirmation
  - Receipt generation

  ✅ Reviews & Ratings

  - Submit review after completion
  - View reviews on CA profile
  - Average rating calculation

  ✅ Messaging

  - Send message to CA/Client
  - Receive message notification
  - View message history
  - Real-time chat (if Socket.IO enabled)

  ✅ Availability Management

  - CA sets availability
  - View CA availability
  - Book time slot

  ✅ Admin Functions

  - Verify CA profiles
  - View all transactions
  - Platform analytics
  - Error management dashboard

  ---
  API Testing (Postman/cURL)

  Register User

  curl -X POST http://localhost:5000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Rajesh Kumar",
      "email": "rajesh.kumar@catest.com",
      "password": "Test@123",
      "phone": "+919876543210",
      "role": "CA"
    }'

  Login

  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "rajesh.kumar@catest.com",
      "password": "Test@123"
    }'

  Get All CAs

  curl http://localhost:5000/api/cas

  Create Service Request

  curl -X POST http://localhost:5000/api/service-requests \
    -H "Authorization: Bearer YOUR_JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "caId": "ca-uuid-here",
      "serviceType": "INCOME_TAX",
      "description": "Need tax planning assistance",
      "budget": 25000
    }'

  ---
  Notes

  1. Passwords: All test accounts use Test@123 for easy testing
  2. GST Numbers: Use valid format (15 characters) but these are test numbers
  3. Phone Numbers: Indian format (+91 prefix)
  4. Razorpay Test Mode: Use test cards for payments
  5. Email: Use unique emails for each test user

  This should give you comprehensive data to test all features! 🚀