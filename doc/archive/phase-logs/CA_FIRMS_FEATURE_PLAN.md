# CA Firms Feature - Implementation Plan

## Overview
Add support for CA Firms (organizations) to the marketplace, allowing multiple Chartered Accountants to work together under a single firm entity.

## Feature Requirements

### 1. Firm Management
- **Firm Registration**: Register CA firms with company details
- **Firm Profile**: Manage firm information, specializations, and credentials
- **Firm Verification**: Admin approval process for firms
- **Firm Dashboard**: Central management interface for firm operations

### 2. CA-Firm Relationship
- **Firm Membership**: CAs can join firms as partners or employees
- **Role Hierarchy**: Define roles within firms (Partner, Senior CA, Junior CA, Employee)
- **Independent vs Firm CAs**: CAs can work independently or as part of a firm
- **Multiple Firm Membership**: Option for CAs to be part of multiple firms (consulting basis)

### 3. Service Request Handling
- **Firm-Level Requests**: Clients can request services from firms
- **CA Assignment**: Firms can assign requests to specific CAs
- **Firm Capacity**: Track total capacity based on all member CAs
- **Request Distribution**: Internal routing of requests within firms

### 4. Reviews and Ratings
- **Firm Ratings**: Aggregate ratings at firm level
- **Individual CA Ratings**: Maintain individual CA ratings within firm
- **Dual Review System**: Reviews can be for the firm and/or assigned CA

### 5. Financial Management
- **Firm Payments**: Payments go to firm account
- **Revenue Split**: Define revenue distribution among firm members
- **Firm Analytics**: Track firm-level financial performance
- **Commission Structure**: Platform fee + firm internal distribution

### 6. Client Experience
- **Firm Discovery**: Browse and filter firms in marketplace
- **Firm Comparison**: Compare firms based on ratings, experience, pricing
- **CA Selection**: Option to request specific CA within a firm
- **Firm vs Individual**: Choose between booking individual CAs or firms

---

## Database Schema Changes

### New Models

#### 1. CAFirm Model
```prisma
model CAFirm {
  id                  String             @id @default(uuid())
  firmName            String             @unique
  registrationNumber  String             @unique
  email               String             @unique
  phone               String
  address             String?
  city                String?
  state               String?
  country             String             @default("India")
  pincode             String?

  // Professional Details
  establishedYear     Int
  specializations     Specialization[]
  description         String?            @db.Text
  website             String?

  // Verification
  verificationStatus  VerificationStatus @default(PENDING)
  verifiedAt          DateTime?

  // Financials
  platformFeePercent  Float              @default(10) // Negotiable based on volume

  // Relations
  members            FirmMember[]
  serviceRequests    ServiceRequest[]
  reviews            FirmReview[]
  payments           Payment[]

  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  @@index([firmName])
  @@index([verificationStatus])
  @@index([city])
  @@index([establishedYear])
}
```

#### 2. FirmMember Model (Junction Table)
```prisma
enum FirmRole {
  PARTNER
  SENIOR_CA
  JUNIOR_CA
  EMPLOYEE
  CONSULTANT
}

model FirmMember {
  id              String    @id @default(uuid())
  firmId          String
  caId            String
  role            FirmRole  @default(EMPLOYEE)
  joinDate        DateTime  @default(now())
  endDate         DateTime? // For consultants or former employees
  isActive        Boolean   @default(true)

  // Revenue sharing
  commissionPercent Float?  // % of firm revenue this CA receives

  // Relations
  firm            CAFirm              @relation(fields: [firmId], references: [id], onDelete: Cascade)
  ca              CharteredAccountant @relation(fields: [caId], references: [id], onDelete: Cascade)

  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  @@unique([firmId, caId])
  @@index([firmId])
  @@index([caId])
  @@index([isActive])
}
```

#### 3. FirmReview Model
```prisma
model FirmReview {
  id         String   @id @default(uuid())
  firmId     String
  clientId   String
  requestId  String   @unique
  rating     Int      // 1-5 stars
  comment    String?  @db.Text

  // Relations
  firm       CAFirm         @relation(fields: [firmId], references: [id], onDelete: Cascade)
  client     Client         @relation(fields: [clientId], references: [id], onDelete: Cascade)
  request    ServiceRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([firmId])
  @@index([clientId])
  @@index([rating])
  @@index([createdAt])
}
```

### Schema Modifications

#### Update CharteredAccountant Model
```prisma
model CharteredAccountant {
  // ... existing fields ...

  // Add relations
  firmMemberships FirmMember[]  // CA can be part of multiple firms

  // Add field to track if CA works independently
  acceptsIndependentWork Boolean @default(true)
}
```

#### Update ServiceRequest Model
```prisma
model ServiceRequest {
  // ... existing fields ...

  // Add optional firm assignment
  firmId     String?

  // Relations
  firm       CAFirm?  @relation(fields: [firmId], references: [id], onDelete: SetNull)
  firmReview FirmReview?

  @@index([firmId])
}
```

#### Update Payment Model
```prisma
model Payment {
  // ... existing fields ...

  // Add optional firm payment
  firmId     String?
  firmAmount Float?   // Amount to be paid to firm

  // Relations
  firm       CAFirm?  @relation(fields: [firmId], references: [id], onDelete: SetNull)

  @@index([firmId])
}
```

#### Update Client Model
```prisma
model Client {
  // ... existing fields ...

  // Add relation
  firmReviews FirmReview[]
}
```

---

## API Endpoints

### Firm Management Endpoints

#### Public Endpoints
```
GET    /api/firms                           # List all verified firms (with filters)
GET    /api/firms/:firmId                   # Get firm details
GET    /api/firms/:firmId/members           # Get firm members (CAs)
GET    /api/firms/:firmId/reviews           # Get firm reviews
GET    /api/firms/:firmId/stats             # Get firm statistics
```

#### Firm Dashboard (Authenticated - Partner/Admin)
```
POST   /api/firms                           # Register new firm
GET    /api/firms/my-firm                   # Get my firm details
PUT    /api/firms/my-firm                   # Update firm profile
GET    /api/firms/my-firm/requests          # Get firm's service requests
POST   /api/firms/my-firm/members           # Add CA to firm
PUT    /api/firms/my-firm/members/:memberId # Update member role/commission
DELETE /api/firms/my-firm/members/:memberId # Remove CA from firm
GET    /api/firms/my-firm/analytics         # Firm analytics
GET    /api/firms/my-firm/earnings          # Firm earnings & payouts
```

#### CA Endpoints (For Joining Firms)
```
GET    /api/ca/firm-invitations             # Get pending firm invitations
POST   /api/ca/join-firm/:firmId            # Request to join a firm
DELETE /api/ca/leave-firm/:firmId           # Leave a firm
```

#### Admin Endpoints
```
GET    /api/admin/firms                     # List all firms (pending, verified, rejected)
GET    /api/admin/firms/:firmId             # Get firm details with full info
PUT    /api/admin/firms/:firmId/verify      # Verify firm
PUT    /api/admin/firms/:firmId/reject      # Reject firm
DELETE /api/admin/firms/:firmId             # Delete firm
```

---

## Frontend Components

### Public Pages

#### 1. Firm Listing Page
**Path**: `/firms`
**Features**:
- Grid/list view of verified firms
- Filters: specialization, location, experience, ratings
- Search by firm name
- Sort by: ratings, experience, price

#### 2. Firm Detail Page
**Path**: `/firms/:firmId`
**Features**:
- Firm profile information
- List of member CAs
- Firm reviews and ratings
- Service offerings
- "Request Service" button
- Statistics (completed projects, average rating, response time)

### Client Pages

#### 3. Enhanced Service Request Page
**Path**: `/client/new-request`
**Features**:
- Option to choose: Individual CA vs Firm
- If firm: Browse and select firm
- If CA: Browse individual CAs (existing flow)
- Specify if want specific CA within firm

### Firm Dashboard (New User Role)

#### 4. Firm Dashboard
**Path**: `/firm/dashboard`
**Features**:
- Overview cards (members, active requests, revenue, ratings)
- Recent service requests
- Quick actions (add member, view analytics)

#### 5. Firm Members Management
**Path**: `/firm/members`
**Features**:
- List of all members with roles
- Add/invite new CAs
- Edit member roles and commission
- Remove members

#### 6. Firm Service Requests
**Path**: `/firm/requests`
**Features**:
- All requests assigned to firm
- Assign requests to specific CAs
- Track request status
- Filter by status, CA, service type

#### 7. Firm Analytics
**Path**: `/firm/analytics`
**Features**:
- Revenue breakdown
- Member performance
- Request completion rates
- Client satisfaction metrics

#### 8. Firm Profile Settings
**Path**: `/firm/settings`
**Features**:
- Edit firm information
- Update specializations
- Manage documents
- Set commission structure

### Admin Pages

#### 9. Firm Verification
**Path**: `/admin/firm-verification`
**Features**:
- List pending firm applications
- Review firm documents
- Approve/reject firms
- View firm details

#### 10. Firm Management
**Path**: `/admin/firms`
**Features**:
- List all firms
- Filter by status
- View firm analytics
- Manage platform fees

---

## Backend Services

### 1. FirmService
**File**: `/backend/src/services/firm.service.ts`

**Methods**:
- `createFirm(data)` - Register new firm
- `getFirm(firmId)` - Get firm details
- `updateFirm(firmId, data)` - Update firm profile
- `listFirms(filters)` - List firms with filters
- `verifyFirm(firmId)` - Admin: Verify firm
- `rejectFirm(firmId, reason)` - Admin: Reject firm
- `getFirmStats(firmId)` - Get firm statistics
- `getFirmMembers(firmId)` - Get all firm members
- `getFirmReviews(firmId)` - Get firm reviews with pagination

### 2. FirmMemberService
**File**: `/backend/src/services/firm-member.service.ts`

**Methods**:
- `addMember(firmId, caId, role, commission)` - Add CA to firm
- `updateMember(memberId, data)` - Update member role/commission
- `removeMember(memberId)` - Remove CA from firm
- `getMembersByFirm(firmId)` - Get all members of firm
- `getFirmsByCA(caId)` - Get all firms a CA belongs to
- `isCAInFirm(caId, firmId)` - Check if CA is member of firm

### 3. FirmRequestService
**File**: `/backend/src/services/firm-request.service.ts`

**Methods**:
- `createFirmRequest(clientId, firmId, data)` - Client requests service from firm
- `assignRequestToCA(requestId, caId)` - Firm assigns request to specific CA
- `getFirmRequests(firmId, filters)` - Get all firm requests
- `getCARequestsInFirm(firmId, caId)` - Get requests assigned to specific CA

### 4. FirmAnalyticsService
**File**: `/backend/src/services/firm-analytics.service.ts`

**Methods**:
- `getFirmDashboard(firmId)` - Get dashboard metrics
- `getFirmRevenue(firmId, dateRange)` - Get revenue breakdown
- `getMemberPerformance(firmId)` - Get performance of each member
- `getClientSatisfaction(firmId)` - Get satisfaction metrics

---

## Implementation Phases

### Phase 1: Database & Core Backend (Week 1)
- [ ] Create Prisma schema additions
- [ ] Run migrations
- [ ] Create FirmService with basic CRUD
- [ ] Create FirmMemberService
- [ ] Create API routes for firms
- [ ] Unit tests for services

### Phase 2: Admin Interface (Week 1)
- [ ] Create admin firm verification page
- [ ] Create admin firm management page
- [ ] Connect to backend APIs
- [ ] Add firm filters and search

### Phase 3: Public Firm Pages (Week 2)
- [ ] Create firm listing page
- [ ] Create firm detail page
- [ ] Add firm search and filters
- [ ] Create firm review display
- [ ] Integration with existing service request flow

### Phase 4: Firm Dashboard (Week 2-3)
- [ ] Create firm registration flow
- [ ] Create firm dashboard
- [ ] Create firm members management
- [ ] Create firm request management
- [ ] Create firm analytics page
- [ ] Create firm settings page

### Phase 5: Integration & Testing (Week 3)
- [ ] Update service request flow to support firms
- [ ] Update payment flow for firms
- [ ] Update review system for firms
- [ ] End-to-end testing
- [ ] Integration tests
- [ ] UI/UX refinements

### Phase 6: Analytics & Polish (Week 4)
- [ ] Firm analytics dashboard
- [ ] Member performance tracking
- [ ] Revenue distribution logic
- [ ] Documentation
- [ ] Seed data for firms
- [ ] Production deployment

---

## Key Considerations

### Business Logic

1. **Request Assignment**:
   - When client requests service from firm, firm admin assigns to specific CA
   - OR system can auto-assign based on availability/expertise
   - Client can request specific CA within firm

2. **Payment Distribution**:
   - Payment goes to firm
   - Platform takes fee from total
   - Firm distributes remaining to assigned CA based on commission %
   - Remaining goes to firm account

3. **Ratings**:
   - Client rates both firm and assigned CA
   - Firm rating is average of all firm-level ratings
   - CA rating includes work done independently + through firm

4. **Availability**:
   - Firm availability = aggregate of all member CAs
   - Individual CA can still accept independent work
   - Firm can set capacity limits

### Authorization

1. **Firm Roles**:
   - PARTNER: Full access to firm management
   - SENIOR_CA: Can view requests, assign to juniors
   - JUNIOR_CA/EMPLOYEE: Can only see assigned requests
   - CONSULTANT: Limited access, time-bound

2. **Permissions**:
   - Only partners can add/remove members
   - Only partners can update firm profile
   - All members can view firm dashboard
   - Revenue details only visible to partners

### Data Integrity

1. **Cascading Deletes**:
   - If CA deleted, remove from all firms
   - If firm deleted, reassign or cancel pending requests
   - Maintain historical records in audit logs

2. **Validation**:
   - Firm registration number must be unique
   - At least one partner required in firm
   - Commission percentages must sum to <= 100%
   - CA can't be assigned to request outside their firm

---

## Questions for User

Before starting implementation, please confirm:

1. **Firm Membership**: Should CAs be able to belong to multiple firms simultaneously?
2. **Request Flow**: Should firms auto-assign requests or require manual assignment?
3. **Payment Split**: Should platform calculate commission split or just track it?
4. **Firm Admin**: Who can create/manage firms - any verified CA or need special approval?
5. **Minimum Members**: Should there be a minimum number of CAs required to form a firm?
6. **Independent Work**: Should CAs in firms still be able to accept independent requests?

---

## Next Steps

1. Review this plan and provide feedback
2. Answer the questions above
3. Approve to start Phase 1 implementation
4. I'll begin with database schema and migrations

