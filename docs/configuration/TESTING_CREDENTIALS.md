# Testing Credentials & Features Guide

## Overview

Sample data has been successfully created for testing the CA Marketplace platform, including all analytics features, A/B testing, feature flags, and scheduled reports.

---

## Access URLs

- **Frontend Application**: http://localhost:3001
- **Backend API**: http://localhost:8081/api
- **PGAdmin Database**: http://localhost:5051
- **API Documentation**: http://localhost:8081/api/docs (if enabled)

---

## Test User Credentials

### 🔐 Super Admin
**Role**: Full platform access with all administrative privileges
- **Email**: `superadmin@camarketplace.com`
- **Password**: `SuperAdmin@2026`

**Features to Test**:
- Complete analytics dashboard
- A/B testing management
- Feature flag configuration
- Scheduled reports management
- User management
- Security audit features
- All admin features

---

### 🔐 Admin
**Role**: Administrative access for platform management
- **Email**: `admin@camarketplace.com`
- **Password**: `Admin@2026`

**Features to Test**:
- Analytics dashboard (revenue, users, metrics)
- Experiment monitoring
- Report generation
- Platform statistics
- User oversight

---

### 👨‍💼 Chartered Accountant #1 - Rajesh Sharma
**Specializations**: GST, Income Tax
- **Email**: `ca.sharma@camarketplace.com`
- **Password**: `CAUser@2026`
- **License**: CA-2015-123456
- **Experience**: 9 years
- **Hourly Rate**: ₹2,500
- **Languages**: English, Hindi

**Profile**: Specialized in GST compliance and income tax planning for SMEs

**Service Requests Assigned**: 4 requests
- 2 completed (GST Filing, Financial Consulting)
- 1 in progress (Audit)
- 1 accepted (Financial Consulting)

---

### 👨‍💼 Chartered Accountant #2 - Priya Verma
**Specializations**: Audit, Tax Planning
- **Email**: `ca.verma@camarketplace.com`
- **Password**: `CAUser@2026`
- **License**: CA-2018-789012
- **Experience**: 6 years
- **Hourly Rate**: ₹3,000
- **Languages**: English, Hindi, Marathi

**Profile**: Expert in statutory audits and corporate tax planning

**Service Requests Assigned**: 3 requests
- 2 completed (Tax Planning, Income Tax Return)
- 1 in progress (Tax Planning)

---

### 👨‍💼 Chartered Accountant #3 - Amit Patel
**Specializations**: GST, Audit, Accounting
- **Email**: `ca.patel@camarketplace.com`
- **Password**: `CAUser@2026`
- **License**: CA-2020-345678
- **Experience**: 4 years
- **Hourly Rate**: ₹2,000
- **Languages**: English, Hindi, Gujarati

**Profile**: Focused on GST returns and internal audits

**Service Requests Assigned**: 3 requests
- 1 completed (Audit)
- 1 pending (GST Filing)

---

### 🏢 Client #1 - Tech Solutions Ltd
**Industry**: Technology
- **Email**: `client.tech@company.com`
- **Password**: `Client@2026`
- **Company**: Tech Solutions Ltd
- **Location**: 123 Tech Park, Bangalore, Karnataka - 560001
- **Tax Number**: 29AAAAA0000A1Z5

**Service Requests Created**: 4 requests
- 2 completed (GST Filing, Tax Planning)
- 1 in progress (Audit)
- 1 accepted (Financial Consulting)

---

### 🏢 Client #2 - Retail Ventures Pvt Ltd
**Industry**: Retail
- **Email**: `client.retail@company.com`
- **Password**: `Client@2026`
- **Company**: Retail Ventures Pvt Ltd
- **Location**: 456 Shopping Complex, Mumbai, Maharashtra - 400001
- **Tax Number**: 27BBBBB1111B2Z6

**Service Requests Created**: 3 requests
- 2 completed (Company Registration, Audit)
- 1 in progress (Tax Planning)

---

### 🏢 Client #3 - Export India Corp
**Industry**: Export
- **Email**: `client.export@company.com`
- **Password**: `Client@2026`
- **Company**: Export India Corp
- **Location**: 789 Export Zone, Delhi - 110001
- **Tax Number**: 24CCCCC2222C3Z7

**Service Requests Created**: 3 requests
- 2 completed (Income Tax Return, GST Filing)
- 1 pending (GST Filing)

---

## Sample Data Summary

### Business Data
- **Total Users**: 8 (2 Admins, 3 CAs, 3 Clients)
- **Service Requests**: 10 total
  - 6 completed
  - 2 in progress
  - 1 pending
  - 1 accepted
- **Payments**: 6 completed payments
- **Reviews**: 6 reviews (4-5 star ratings)
- **Analytics Events**: 31 days of historical data (300+ events)

### Analytics Features
- **Daily Metrics**: 31 days of aggregated data
  - User registrations
  - Service requests
  - Payments completed
  - Revenue tracking
  - Platform fees
  - Average ratings

### A/B Testing
**3 Active Experiments**:

1. **New Dashboard Layout** (RUNNING)
   - Control: Current Layout (50%)
   - Variant A: New Layout (50%)
   - Started: Jan 10, 2026

2. **Pricing Display Format** (RUNNING)
   - Hourly: Hourly Rate (50%)
   - Package: Package Pricing (50%)
   - Started: Jan 12, 2026

3. **User Onboarding Flow** (COMPLETED)
   - Single: Single Page (50%)
   - Multi: Multi-Step (50%)
   - Winner: Multi-Step
   - Period: Jan 1-15, 2026

### Feature Flags
**4 Configured Flags**:

1. **Advanced Search** (ENABLED - 100%)
   - Target: Clients
   - Description: Advanced search filters for CA discovery

2. **Video Consultation** (ENABLED - 50%)
   - Target: CAs and Clients
   - Description: Video consultation feature

3. **AI Document Analysis** (DISABLED)
   - Target: CAs
   - Description: AI-powered document analysis for tax returns

4. **Subscription Plans** (ENABLED - 25%)
   - Target: Clients
   - Description: Monthly subscription plans

### Scheduled Reports
**3 Configured Reports**:

1. **Monthly Revenue Report**
   - Schedule: 1st of every month at midnight
   - Format: PDF
   - Recipients: Admin, Super Admin
   - Status: Enabled

2. **Weekly Platform Stats**
   - Schedule: Every Monday at 9am
   - Format: CSV
   - Recipients: Super Admin
   - Status: Enabled

3. **CA Performance Report**
   - Schedule: Daily at midnight
   - Format: Both (PDF & CSV)
   - Recipients: Admin
   - Status: Disabled

---

## Features to Test

### For Super Admin / Admin

#### 📊 Analytics Dashboard
**Path**: `/admin/analytics` or `/admin/dashboard`
- View real-time platform metrics
- User acquisition funnel
- Revenue breakdown and trends
- CA utilization rates
- Customer lifetime value
- Date range filtering
- Export capabilities

#### 🧪 A/B Testing (Experiments)
**Path**: `/admin/experiments`
- View all experiments
- Create new experiments
- Start/pause/complete experiments
- View experiment metrics
- Statistical significance analysis
- Declare winning variants

#### 🚩 Feature Flags
**Path**: `/admin/feature-flags`
- View all feature flags
- Create/edit flags
- Enable/disable flags
- Set rollout percentages
- Target specific user roles
- Real-time flag updates

#### 📄 Reports
**Path**: `/admin/reports`
- View scheduled reports
- Create on-demand reports
- Download report history (PDF/CSV)
- Configure report schedules
- Manage recipients

#### 🔒 Security Features
**Path**: `/admin/security`
- Security audit dashboard
- Run security scans
- View vulnerability reports
- Penetration test results
- Access control testing

### For Chartered Accountants

#### 📋 Dashboard
- View assigned service requests
- Track request status
- Manage availability
- View earnings and payment history
- Client reviews and ratings

#### 💼 Service Requests
- Accept/reject requests
- Mark requests in progress
- Complete requests
- Communicate with clients
- Upload documents

### For Clients

#### 🔍 CA Discovery
- Search for CAs
- Filter by specialization, location, rate
- View CA profiles and reviews
- Advanced search (if flag enabled)

#### 📝 Service Requests
- Create new service requests
- Track request status
- Communicate with assigned CA
- Make payments
- Leave reviews

---

## Testing Scenarios

### Scenario 1: Admin Analytics Review
1. Login as Super Admin
2. Navigate to Analytics Dashboard
3. View metrics for last 30 days
4. Check revenue trends
5. Review CA utilization
6. Export data

### Scenario 2: A/B Test Management
1. Login as Admin
2. Go to Experiments page
3. View experiment metrics
4. Check statistical significance
5. Create new experiment
6. Start/pause experiment

### Scenario 3: Feature Flag Control
1. Login as Super Admin
2. Navigate to Feature Flags
3. Toggle "Video Consultation"
4. Adjust rollout percentage
5. View affected users

### Scenario 4: CA Service Delivery
1. Login as CA (Rajesh Sharma)
2. View assigned requests
3. Mark request as in progress
4. Upload documents
5. Complete request
6. View payment received

### Scenario 5: Client Service Request
1. Login as Client (Tech Solutions)
2. Browse available CAs
3. Create new service request
4. Track request status
5. Make payment after completion
6. Leave review

### Scenario 6: Security Audit
1. Login as Super Admin
2. Navigate to Security Dashboard
3. Run full security audit
4. View scan results
5. Check penetration test results
6. Review findings by severity

---

## API Testing

### Authentication
```bash
# Login
curl -X POST http://localhost:8081/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@camarketplace.com",
    "password": "SuperAdmin@2026"
  }'
```

### Analytics Endpoints (Requires Admin Auth)
```bash
# Get dashboard metrics
curl http://localhost:8081/api/admin/analytics/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get user funnel
curl http://localhost:8081/api/admin/analytics/funnel \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get revenue breakdown
curl http://localhost:8081/api/admin/analytics/revenue \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Experiments
```bash
# List experiments
curl http://localhost:8081/api/admin/experiments \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get experiment metrics
curl http://localhost:8081/api/admin/experiments/new_dashboard_layout/metrics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Feature Flags
```bash
# List all flags
curl http://localhost:8081/api/admin/feature-flags \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get user's enabled flags
curl http://localhost:8081/api/feature-flags \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Database Access (PGAdmin)

**URL**: http://localhost:5051

### Credentials
- **Email**: admin@caplatform.com
- **Password**: admin123

### Server Connection
- **Host**: ca_postgres
- **Port**: 5432
- **Database**: camarketplace
- **Username**: caadmin
- **Password**: CaSecure123!

### Tables to Explore
- `User` - All users
- `Client` - Client profiles
- `CharteredAccountant` - CA profiles
- `ServiceRequest` - Service requests
- `Payment` - Payment records
- `Review` - Reviews and ratings
- `Experiment` - A/B tests
- `FeatureFlag` - Feature flags
- `ScheduledReport` - Report configs
- `DailyMetric` - Aggregated analytics
- `AnalyticsEvent` - Event tracking
- `SecurityScan` - Security audit results

---

## Troubleshooting

### Can't Login
- Verify you're using the exact credentials (case-sensitive)
- Check that services are running: `docker ps`
- Restart containers if needed: `docker-compose restart`

### Analytics Not Showing
- Ensure you're logged in as Admin or Super Admin
- Check backend logs: `docker logs ca_backend`
- Verify analytics events were created: Check `AnalyticsEvent` table

### Experiments Not Working
- Check experiment status (should be RUNNING)
- Verify user is assigned to a variant
- Check browser console for errors

### Reports Not Generating
- Reports are scheduled via cron jobs
- For testing, use "Generate Now" button
- Check job scheduler is running

---

## Support

For issues or questions:
- Check backend logs: `docker logs ca_backend --tail 100`
- Check frontend logs: `docker logs ca_frontend --tail 100`
- Review database in PGAdmin
- Check network tab in browser DevTools

---

## Next Steps

1. **Explore the Frontend**: Login with different roles and test features
2. **Check Analytics**: View the analytics dashboard with real data
3. **Test A/B Testing**: Create and manage experiments
4. **Configure Features**: Toggle feature flags and test behavior
5. **Generate Reports**: Create on-demand reports
6. **API Testing**: Use Postman or curl to test API endpoints
7. **Database Review**: Inspect data structure in PGAdmin

---

**Last Updated**: January 19, 2026
**Data Seeded**: Yes (Run `docker exec ca_backend npm run seed` to refresh)
