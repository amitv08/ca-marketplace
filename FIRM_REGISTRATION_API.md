# CA Firm Registration Workflow API Documentation

## Overview

The CA Firm Registration workflow enables verified Chartered Accountants to create and manage CA firms on the platform. The process involves multiple steps with validation, member invitations, document verification, and admin approval.

## Registration Flow

```
DRAFT → PENDING_VERIFICATION → ACTIVE (or REJECTED)
  |            |                   |
  |            |                   └─> Ready to accept service requests
  |            └─> Admin reviews within 7 days
  └─> Invite members, upload documents
```

## Business Rules

1. **CA Eligibility**:
   - Must be a VERIFIED CA
   - Cannot be in another active firm
   - Can only have ONE pending registration at a time

2. **Minimum Requirements**:
   - At least 2 verified CAs (including initiator)
   - All invited CAs must ACCEPT before submission
   - Required documents based on firm type

3. **Document Requirements**:
   - **All Firms**: Registration Certificate, PAN Card, Address Proof
   - **If GST Registered**: GST Certificate
   - **Partnership/LLP**: Partnership Deed
   - **Private Limited**: MOA/AOA

4. **Admin Verification SLA**:
   - Target: Review within 7 days
   - Escalation alert after 7 days
   - Auto-priority sorting (oldest first)

---

## API Endpoints

### Base URL
```
http://localhost:8080/api
```

---

## 1. Initiate Firm Registration

**Endpoint**: `POST /api/firms/initiate`

**Description**: Verified CA starts firm registration process

**Auth Required**: Yes (CA role)

**Request Body**:
```json
{
  "firmName": "ABC & Associates",
  "registrationNumber": "REG123456",
  "firmType": "PARTNERSHIP",
  "email": "contact@abcfirm.com",
  "phone": "+91-9876543210",
  "address": "123 Business Street",
  "city": "Mumbai",
  "state": "Maharashtra",
  "country": "India",
  "pincode": "400001",
  "gstin": "27AABCU9603R1ZX",
  "pan": "AABCU9603R",
  "website": "https://abcfirm.com",
  "establishedYear": 2015,
  "specializations": ["GST", "INCOME_TAX", "AUDIT"],
  "description": "Leading CA firm specializing in tax and audit services",
  "contactPersonName": "John Doe",
  "contactPersonEmail": "john@abcfirm.com",
  "contactPersonPhone": "+91-9876543210"
}
```

**Success Response** (201):
```json
{
  "success": true,
  "data": {
    "firm": {
      "id": "firm-uuid",
      "firmName": "ABC & Associates",
      "status": "DRAFT",
      "verificationLevel": "BASIC",
      "createdAt": "2026-01-23T10:30:00Z"
    },
    "membership": {
      "id": "membership-uuid",
      "role": "FIRM_ADMIN",
      "joinDate": "2026-01-23T10:30:00Z"
    }
  },
  "message": "Firm registration initiated successfully. Please invite at least one more verified CA to continue."
}
```

**Error Responses**:
- `400`: Validation errors (missing required fields)
- `403`: CA not verified / Already has active firm / Already has pending registration
- `409`: Duplicate firm name/registration number/GSTIN/PAN/email

---

## 2. Invite Member

**Endpoint**: `POST /api/firms/:firmId/invite-member`

**Description**: Firm admin invites CA to join the firm

**Auth Required**: Yes (CA role, must be FIRM_ADMIN)

**Request Body**:
```json
{
  "email": "ca2@example.com",
  "caId": "ca-uuid-optional",
  "role": "SENIOR_CA",
  "membershipType": "FULL_TIME",
  "message": "We'd love to have you join our team!"
}
```

**Field Descriptions**:
- `email` (required): Email of CA to invite
- `caId` (optional): If inviting existing platform CA
- `role`: FIRM_ADMIN | SENIOR_CA | JUNIOR_CA (default: JUNIOR_CA)
- `membershipType`: FULL_TIME | PART_TIME | CONSULTANT (default: FULL_TIME)
- `message` (optional): Personal message to invitee

**Success Response** (201):
```json
{
  "success": true,
  "data": {
    "id": "invitation-uuid",
    "firmId": "firm-uuid",
    "email": "ca2@example.com",
    "role": "SENIOR_CA",
    "status": "PENDING",
    "invitationToken": "unique-token",
    "expiresAt": "2026-01-30T10:30:00Z",
    "sentAt": "2026-01-23T10:30:00Z"
  },
  "message": "Invitation sent successfully"
}
```

**Error Responses**:
- `400`: Missing email
- `403`: Not a FIRM_ADMIN / Firm not in DRAFT status
- `404`: Firm not found
- `409`: CA already invited / CA already in another firm

---

## 3. View My Invitations

**Endpoint**: `GET /api/firm-invitations/my-invitations`

**Description**: Get all invitations for authenticated CA

**Auth Required**: Yes (CA role)

**Success Response** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "invitation-uuid",
      "firm": {
        "id": "firm-uuid",
        "firmName": "ABC & Associates",
        "city": "Mumbai",
        "state": "Maharashtra",
        "specializations": ["GST", "INCOME_TAX"]
      },
      "invitedBy": {
        "id": "ca-uuid",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "role": "SENIOR_CA",
      "membershipType": "FULL_TIME",
      "message": "We'd love to have you join our team!",
      "status": "PENDING",
      "expiresAt": "2026-01-30T10:30:00Z",
      "sentAt": "2026-01-23T10:30:00Z"
    }
  ],
  "message": "Your invitations retrieved successfully"
}
```

---

## 4. Accept Invitation

**Endpoint**: `POST /api/firm-invitations/:token/accept`

**Description**: Accept an invitation to join a firm

**Auth Required**: Yes (CA role)

**Path Parameters**:
- `token`: Invitation token from email/invitation link

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "invitation": {
      "id": "invitation-uuid",
      "status": "ACCEPTED",
      "acceptedAt": "2026-01-23T11:00:00Z"
    },
    "membership": {
      "id": "membership-uuid",
      "firmId": "firm-uuid",
      "role": "SENIOR_CA",
      "membershipType": "FULL_TIME",
      "isActive": true
    },
    "firm": {
      "id": "firm-uuid",
      "firmName": "ABC & Associates"
    }
  },
  "message": "Invitation accepted successfully. You are now a member of the firm!"
}
```

**Error Responses**:
- `403`: CA not verified / CA already in active firm
- `404`: Invitation not found
- `410`: Invitation expired or already processed

---

## 5. Reject Invitation

**Endpoint**: `POST /api/firm-invitations/:token/reject`

**Description**: Reject an invitation

**Auth Required**: Yes (CA role)

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "invitation-uuid",
    "status": "REJECTED",
    "rejectedAt": "2026-01-23T11:00:00Z"
  },
  "message": "Invitation rejected"
}
```

---

## 6. Get Registration Status

**Endpoint**: `GET /api/firms/:firmId/registration-status`

**Description**: Check current registration status and requirements

**Auth Required**: Yes (CA/ADMIN role)

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "firmId": "firm-uuid",
    "firmName": "ABC & Associates",
    "status": "DRAFT",
    "verificationLevel": "BASIC",
    "activeMemberCount": 2,
    "pendingInvitationCount": 0,
    "totalMembers": 2,
    "requiredDocuments": [
      "REGISTRATION_CERTIFICATE",
      "PAN_CARD",
      "ADDRESS_PROOF",
      "GST_CERTIFICATE",
      "PARTNERSHIP_DEED"
    ],
    "uploadedDocuments": [
      "REGISTRATION_CERTIFICATE",
      "PAN_CARD"
    ],
    "missingDocuments": [
      "ADDRESS_PROOF",
      "GST_CERTIFICATE",
      "PARTNERSHIP_DEED"
    ],
    "allMembersVerified": true,
    "canSubmit": false,
    "blockers": [
      "Missing required documents: ADDRESS_PROOF, GST_CERTIFICATE, PARTNERSHIP_DEED"
    ],
    "nextSteps": [
      "Upload missing documents",
      "Submit for admin verification"
    ]
  },
  "message": "Registration status retrieved successfully"
}
```

---

## 7. Submit for Verification

**Endpoint**: `POST /api/firms/:firmId/submit-for-verification`

**Description**: Submit firm for admin verification after all requirements met

**Auth Required**: Yes (CA role, must be FIRM_ADMIN)

**Request Body**:
```json
{
  "requiredDocumentIds": [
    "doc-uuid-1",
    "doc-uuid-2",
    "doc-uuid-3"
  ]
}
```

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "id": "firm-uuid",
    "firmName": "ABC & Associates",
    "status": "PENDING_VERIFICATION",
    "verificationSubmittedAt": "2026-01-23T12:00:00Z",
    "estimatedReviewDate": "2026-01-30T12:00:00Z"
  },
  "message": "Firm submitted for verification successfully. An admin will review within 7 days."
}
```

**Error Responses**:
- `400`: Missing required documents / Less than 2 members / Pending invitations
- `403`: Not a FIRM_ADMIN / Firm not in DRAFT status
- `404`: Firm not found

**Pre-submission Validations**:
1. ✓ Minimum 2 active members
2. ✓ No pending invitations
3. ✓ All required documents uploaded
4. ✓ All members are verified CAs

---

## 8. Get Pending Firms (Admin)

**Endpoint**: `GET /api/admin/firms/pending`

**Description**: List firms awaiting admin verification with SLA tracking

**Auth Required**: Yes (ADMIN/SUPER_ADMIN role)

**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "firms": [
      {
        "id": "firm-uuid",
        "firmName": "ABC & Associates",
        "firmType": "PARTNERSHIP",
        "email": "contact@abcfirm.com",
        "city": "Mumbai",
        "state": "Maharashtra",
        "status": "PENDING_VERIFICATION",
        "verificationSubmittedAt": "2026-01-16T12:00:00Z",
        "daysPending": 7,
        "needsEscalation": false,
        "members": [
          {
            "role": "FIRM_ADMIN",
            "ca": {
              "user": {
                "name": "John Doe",
                "email": "john@example.com"
              },
              "caLicenseNumber": "CA12345",
              "experienceYears": 10
            }
          }
        ],
        "documents": [
          {
            "documentType": "REGISTRATION_CERTIFICATE",
            "isVerified": false,
            "uploadedAt": "2026-01-20T10:00:00Z"
          }
        ],
        "_count": {
          "members": 2,
          "documents": 4
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  },
  "message": "Pending firms retrieved successfully"
}
```

**Notes**:
- Firms sorted by `updatedAt` ASC (oldest first)
- `needsEscalation: true` if pending > 7 days
- Priority flag helps admins focus on urgent reviews

---

## 9. Verify Firm (Admin)

**Endpoint**: `POST /api/admin/firms/:firmId/verify`

**Description**: Approve or reject firm verification

**Auth Required**: Yes (ADMIN/SUPER_ADMIN role)

**Request Body**:
```json
{
  "approved": true,
  "verificationLevel": "VERIFIED",
  "verificationNotes": "All documents verified. Firm meets all requirements."
}
```

**Field Descriptions**:
- `approved` (required): true to approve, false to reject
- `verificationLevel` (optional): BASIC | VERIFIED | PREMIUM (default: VERIFIED if approved)
- `verificationNotes` (optional): Admin comments/feedback

**Success Response (Approved)** (200):
```json
{
  "success": true,
  "data": {
    "id": "firm-uuid",
    "firmName": "ABC & Associates",
    "status": "ACTIVE",
    "verificationLevel": "VERIFIED",
    "verifiedAt": "2026-01-23T14:00:00Z",
    "verifiedBy": "admin-user-id",
    "verificationNotes": "All documents verified. Firm meets all requirements."
  },
  "message": "Firm approved and activated successfully"
}
```

**Success Response (Rejected)** (200):
```json
{
  "success": true,
  "data": {
    "id": "firm-uuid",
    "firmName": "ABC & Associates",
    "status": "DRAFT",
    "verificationLevel": "BASIC",
    "verificationNotes": "PAN card details do not match. Please reupload correct document."
  },
  "message": "Firm verification rejected"
}
```

**Post-Verification Actions**:
- **If Approved**:
  - Status → ACTIVE
  - Firm can now accept service requests
  - Email notification to all members
  - Cache invalidation

- **If Rejected**:
  - Status → DRAFT
  - Firm admin can fix issues and resubmit
  - Email notification with rejection reason
  - Members can leave/admin can fix and resubmit

---

## 10. Cancel Registration

**Endpoint**: `DELETE /api/firms/:firmId/cancel-registration`

**Description**: Cancel firm registration (DRAFT status only)

**Auth Required**: Yes (CA role, must be FIRM_ADMIN)

**Success Response** (200):
```json
{
  "success": true,
  "data": {
    "message": "Firm registration cancelled",
    "firmId": "firm-uuid"
  },
  "message": "Firm registration cancelled successfully"
}
```

**Error Responses**:
- `403`: Not the firm admin / Firm not in DRAFT status
- `404`: Firm not found

**Notes**:
- Only FIRM_ADMIN can cancel
- Only DRAFT firms can be cancelled
- All invitations will be cancelled
- Firm record soft-deleted

---

## Complete Registration Flow Example

### Step 1: CA Initiates Firm
```bash
POST /api/firms/initiate
{
  "firmName": "Tax Experts LLP",
  "registrationNumber": "REG789",
  "firmType": "LLP",
  ...
}
# Response: firm created with status DRAFT
```

### Step 2: Upload Documents
```bash
# Use document upload endpoints (separate API)
POST /api/firm-documents
{
  "firmId": "firm-uuid",
  "documentType": "REGISTRATION_CERTIFICATE",
  "documentUrl": "https://...",
  ...
}
```

### Step 3: Invite Member
```bash
POST /api/firms/{firmId}/invite-member
{
  "email": "ca2@example.com",
  "role": "SENIOR_CA"
}
# Response: invitation sent with token
```

### Step 4: Member Accepts
```bash
# CA 2 logs in and accepts
POST /api/firm-invitations/{token}/accept
# Response: CA 2 now member of firm
```

### Step 5: Check Registration Status
```bash
GET /api/firms/{firmId}/registration-status
# Response: canSubmit = true if all requirements met
```

### Step 6: Submit for Verification
```bash
POST /api/firms/{firmId}/submit-for-verification
{
  "requiredDocumentIds": ["doc1", "doc2", "doc3"]
}
# Response: status changed to PENDING_VERIFICATION
```

### Step 7: Admin Reviews
```bash
GET /api/admin/firms/pending
# Admin sees firm in pending list
```

### Step 8: Admin Approves
```bash
POST /api/admin/firms/{firmId}/verify
{
  "approved": true,
  "verificationLevel": "VERIFIED",
  "verificationNotes": "Approved"
}
# Response: firm status changed to ACTIVE
```

### Step 9: Firm is Active!
```
Firm can now:
- Accept service requests
- Assign work to members
- Receive payments
- Manage team
```

---

## Error Codes Reference

| Code | Description |
|------|-------------|
| 400 | Bad Request - Validation failed |
| 401 | Unauthorized - Auth token missing/invalid |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Duplicate entry |
| 410 | Gone - Resource expired |
| 500 | Internal Server Error |

---

## Email Notifications

The system sends automated emails at key stages:

1. **Invitation Sent**: Email to invited CA with acceptance link
2. **Invitation Accepted**: Notification to firm admin
3. **Submission**: Confirmation to firm admin
4. **Verification Complete**: All members notified of approval/rejection
5. **Escalation Alert**: Admin notified if review > 7 days

---

## Testing

See `FIRM_REGISTRATION_TESTS.md` for:
- Postman collection
- cURL examples
- Test scenarios
- Edge cases

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourrepo/issues
- Email: support@camarketplace.com
