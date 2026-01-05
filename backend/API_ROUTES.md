# API Routes Documentation

Complete list of all available API endpoints in the CA Marketplace backend.

## Base URL
`http://localhost:5000/api`

## Authentication Routes (`/api/auth`)

### Register User
```
POST /api/auth/register
Content-Type: application/json

Body:
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "phone": "1234567890",  // optional
  "role": "CLIENT"        // or "CA"
}

Response:
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "JWT_TOKEN"
  },
  "message": "User registered successfully"
}
```

### Login
```
POST /api/auth/login
Content-Type: application/json

Body:
{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "JWT_TOKEN"
  },
  "message": "Login successful"
}
```

### Get Current User
```
GET /api/auth/me
Authorization: Bearer JWT_TOKEN

Response:
{
  "success": true,
  "data": { user with client/ca profile }
}
```

### Logout
```
POST /api/auth/logout
Authorization: Bearer JWT_TOKEN

Response:
{
  "success": true,
  "message": "Logout successful"
}
```

## User Routes (`/api/users`)

### Get User Profile
```
GET /api/users/profile
Authorization: Bearer JWT_TOKEN

Response includes user data with client or CA profile and average rating for CAs
```

### Update User Profile
```
PATCH /api/users/profile
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

Body:
{
  "name": "Updated Name",
  "phone": "9876543210",
  "profileImage": "image-url"
}
```

### Change Password
```
POST /api/users/change-password
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

Body:
{
  "currentPassword": "oldPassword",
  "newPassword": "newPassword"
}
```

### Update Client Profile
```
PATCH /api/users/client-profile
Authorization: Bearer JWT_TOKEN (CLIENT role)
Content-Type: application/json

Body:
{
  "companyName": "Company Inc.",
  "address": "123 Street",
  "taxNumber": "TAX123",
  "documents": { ... }
}
```

### Update CA Profile
```
PATCH /api/users/ca-profile
Authorization: Bearer JWT_TOKEN (CA role)
Content-Type: application/json

Body:
{
  "caLicenseNumber": "CA12345",  // required for first-time setup
  "specialization": ["GST", "INCOME_TAX"],
  "experienceYears": 5,
  "qualifications": ["CA", "MBA"],
  "hourlyRate": 1500,
  "description": "Experienced CA...",
  "languages": ["English", "Hindi"]
}
```

### Get All CAs
```
GET /api/users/chartered-accountants
Authorization: Bearer JWT_TOKEN
Query params:
  - specialization: filter by specialization
  - minRating: minimum average rating
  - maxRate: maximum hourly rate

Response includes CA profiles with average ratings
```

### Get Specific CA
```
GET /api/users/chartered-accountants/:id
Authorization: Bearer JWT_TOKEN

Response includes full CA profile with reviews and available slots
```

## Service Request Routes (`/api/service-requests`)

### Create Service Request
```
POST /api/service-requests
Authorization: Bearer JWT_TOKEN (CLIENT role)
Content-Type: application/json

Body:
{
  "caId": "uuid",                // optional
  "serviceType": "GST_FILING",
  "description": "Need help with GST filing",
  "deadline": "2026-02-01",      // optional
  "estimatedHours": 10,          // optional
  "documents": { ... }           // optional
}
```

### Get All Service Requests
```
GET /api/service-requests
Authorization: Bearer JWT_TOKEN
Query params:
  - page: page number (default: 1)
  - limit: items per page (default: 10)
  - status: filter by status

Returns requests based on user role:
  - CLIENT: only their requests
  - CA: only requests assigned to them
```

### Get Service Request by ID
```
GET /api/service-requests/:id
Authorization: Bearer JWT_TOKEN

Includes messages, payments, and reviews
```

### Update Service Request
```
PATCH /api/service-requests/:id
Authorization: Bearer JWT_TOKEN (CLIENT role, owner only)
Content-Type: application/json

Body:
{
  "caId": "uuid",
  "description": "Updated description",
  "deadline": "2026-02-15",
  "estimatedHours": 15,
  "documents": { ... }
}

Note: Can only update PENDING requests
```

### Accept Service Request
```
POST /api/service-requests/:id/accept
Authorization: Bearer JWT_TOKEN (CA role)

CA accepts the request (status: PENDING → ACCEPTED)
```

### Start Work on Request
```
POST /api/service-requests/:id/start
Authorization: Bearer JWT_TOKEN (CA role)

Start working on request (status: ACCEPTED → IN_PROGRESS)
```

### Complete Service Request
```
POST /api/service-requests/:id/complete
Authorization: Bearer JWT_TOKEN (CA role)

Mark request as complete (status: IN_PROGRESS → COMPLETED)
```

### Cancel Service Request
```
POST /api/service-requests/:id/cancel
Authorization: Bearer JWT_TOKEN (CLIENT or CA)

Cancel request (any status except COMPLETED)
```

## Message Routes (`/api/messages`)

### Send Message
```
POST /api/messages
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

Body:
{
  "receiverId": "user-uuid",
  "requestId": "request-uuid",  // optional
  "content": "Message text",
  "attachments": { ... }        // optional
}
```

### Get Conversations
```
GET /api/messages/conversations
Authorization: Bearer JWT_TOKEN

Returns list of all conversation partners with last message and unread count
```

### Get Messages with Specific User
```
GET /api/messages/with/:userId
Authorization: Bearer JWT_TOKEN

Returns all messages between current user and specified user
Marks received messages as read automatically
```

### Get Messages for Service Request
```
GET /api/messages/request/:requestId
Authorization: Bearer JWT_TOKEN

Returns all messages related to a specific service request
```

### Mark Message as Read
```
PATCH /api/messages/:id/read
Authorization: Bearer JWT_TOKEN
```

### Get Unread Count
```
GET /api/messages/unread/count
Authorization: Bearer JWT_TOKEN

Returns: { "count": 5 }
```

## Review Routes (`/api/reviews`)

### Create Review
```
POST /api/reviews
Authorization: Bearer JWT_TOKEN (CLIENT role)
Content-Type: application/json

Body:
{
  "requestId": "uuid",
  "rating": 5,              // 1-5
  "comment": "Great service!"  // optional
}

Note: Can only review COMPLETED requests
```

### Get Reviews for CA
```
GET /api/reviews/ca/:caId
Authorization: Bearer JWT_TOKEN
Query params:
  - page: page number
  - limit: items per page

Returns reviews with average rating
```

### Get My Reviews (as Client)
```
GET /api/reviews/client/my-reviews
Authorization: Bearer JWT_TOKEN (CLIENT role)

Returns all reviews written by the client
```

### Update Review
```
PATCH /api/reviews/:id
Authorization: Bearer JWT_TOKEN (CLIENT role, owner only)
Content-Type: application/json

Body:
{
  "rating": 4,
  "comment": "Updated comment"
}
```

### Delete Review
```
DELETE /api/reviews/:id
Authorization: Bearer JWT_TOKEN (CLIENT role, owner only)
```

## Payment Routes (`/api/payments`)

### Create Payment
```
POST /api/payments
Authorization: Bearer JWT_TOKEN (CLIENT role)
Content-Type: application/json

Body:
{
  "requestId": "uuid",
  "amount": 5000,
  "paymentMethod": "UPI"  // CREDIT_CARD, DEBIT_CARD, NET_BANKING, UPI, WALLET, CASH
}

Note: Can only pay for COMPLETED requests
```

### Update Payment Status
```
PATCH /api/payments/:id/status
Authorization: Bearer JWT_TOKEN (CLIENT role, owner only)
Content-Type: application/json

Body:
{
  "status": "COMPLETED",  // PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED
  "transactionId": "TXN123"  // optional
}
```

### Get Payment History
```
GET /api/payments/history
Authorization: Bearer JWT_TOKEN

Returns:
  - CLIENT: payments made by client
  - CA: payments received by CA
```

### Get Payment by ID
```
GET /api/payments/:id
Authorization: Bearer JWT_TOKEN

Must be client or CA involved in the payment
```

## Availability Routes (`/api/availability`)

### Create Availability Slot
```
POST /api/availability
Authorization: Bearer JWT_TOKEN (CA role)
Content-Type: application/json

Body:
{
  "date": "2026-02-01",
  "startTime": "09:00",
  "endTime": "12:00"
}

Note: Cannot overlap with existing slots
```

### Get My Availability (CA)
```
GET /api/availability/my-availability
Authorization: Bearer JWT_TOKEN (CA role)
Query params:
  - from: start date filter
  - to: end date filter
```

### Get Availability for Specific CA
```
GET /api/availability/ca/:caId
Authorization: Bearer JWT_TOKEN
Query params:
  - from: start date filter
  - to: end date filter
  - availableOnly: "true" to show only unbooked slots
```

### Update Availability Slot
```
PATCH /api/availability/:id
Authorization: Bearer JWT_TOKEN (CA role, owner only)
Content-Type: application/json

Body:
{
  "startTime": "10:00",
  "endTime": "13:00",
  "isBooked": true
}
```

### Delete Availability Slot
```
DELETE /api/availability/:id
Authorization: Bearer JWT_TOKEN (CA role, owner only)

Note: Cannot delete booked slots
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "stack": "..." // only in development
  }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": {
    "data": [ ... ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "totalPages": 10,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

## Authentication

All protected routes require JWT token in header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

## Error Codes

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error
