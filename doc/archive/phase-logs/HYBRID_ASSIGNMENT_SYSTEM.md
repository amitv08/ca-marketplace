# Hybrid Assignment System - Complete Documentation

## Overview

The Hybrid Assignment System intelligently assigns client service requests to CA firm members using a combination of automated scoring algorithms and manual override capabilities.

**Key Features:**
- Intelligent auto-assignment based on weighted scoring
- Manual assignment for firms that prefer human oversight
- Override capabilities for firm admins
- Real-time assignment recommendations
- Client variety consideration
- Comprehensive notifications

---

## Assignment Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Client creates service request to firm                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. System checks firm.autoAssignmentEnabled flag            │
└────────────────┬─────────────┬──────────────────────────────┘
                 │             │
        TRUE ────┘             └──── FALSE/No Match
                 │                        │
                 ▼                        ▼
    ┌───────────────────────┐  ┌────────────────────────────┐
    │ 3a. Run Auto-         │  │ 3b. Notify Firm Admin for  │
    │     Assignment        │  │     Manual Assignment      │
    │     Algorithm         │  │                            │
    └──────────┬────────────┘  └──────────┬─────────────────┘
               │                          │
               │ Success                  │
               ▼                          ▼
    ┌───────────────────────┐  ┌────────────────────────────┐
    │ 4a. Auto-Assign to    │  │ 4b. Admin Reviews          │
    │     Best Match        │  │     Recommendations        │
    └──────────┬────────────┘  └──────────┬─────────────────┘
               │                          │
               │                          ▼
               │               ┌────────────────────────────┐
               │               │ 5. Admin Manually Assigns  │
               │               │    or Overrides            │
               │               └──────────┬─────────────────┘
               │                          │
               └──────────────┬───────────┘
                              ▼
               ┌─────────────────────────────────┐
               │ 6. Send Notifications           │
               │    - Client: Assignment notice  │
               │    - CA: New request alert      │
               │    - Admin: Confirmation        │
               └─────────────────────────────────┘
```

---

## Auto-Assignment Algorithm

### Scoring System (0-100 Scale)

The algorithm evaluates each eligible firm member and assigns a score based on four weighted factors:

| Factor | Weight | Description |
|--------|--------|-------------|
| **Availability Match** | 40% | Available hours vs booked hours in next 7 days |
| **Specialization Match** | 30% | Primary (100%), Secondary (70%), or No Match (0%) |
| **Current Workload** | 20% | Active requests (0-2: 90%, 3-5: 60%, 6+: 20%) |
| **Historical Success Rate** | 10% | Completion rate + avg rating for service type |

### Scoring Formula

```typescript
finalScore = (
  availabilityScore * 0.40 +
  specializationScore * 0.30 +
  workloadScore * 0.20 +
  successRateScore * 0.10
) * 100

// Variety Bonus: +5% if CA hasn't worked with this client before
if (!hasWorkedWithClient && finalScore > 50) {
  finalScore *= 1.05;
}
```

### Eligibility Filters

Before scoring, candidates are filtered by:

1. **Verification Status**: Must be VERIFIED
2. **Specialization**: Must have matching service type specialization
3. **Independent Work Permission**: If after-hours, must have `canWorkIndependently = true`
4. **Active Membership**: Must be active member of the firm
5. **PTO/Time-Off**: (Future) Will skip members with upcoming time-off

### Minimum Threshold

- **Minimum Score**: 50/100
- If the highest-scoring candidate scores below 50, the system notifies the firm admin for manual assignment

---

## API Endpoints

### Base URL
```
http://localhost:8081/api/assignments
```

---

### 1. Auto-Assign Request

**Endpoint**: `POST /api/assignments/auto-assign/:requestId`

**Description**: Triggers the hybrid assignment workflow for a service request

**Authentication**: Required (ADMIN or CA role)

**Path Parameters**:
- `requestId` (string): Service request ID

**Response Success (Auto-Assignment)**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "method": "AUTO",
    "assignedTo": {
      "caId": "ca-uuid",
      "firmId": "firm-uuid",
      "caName": "John Doe"
    },
    "score": 87,
    "reasons": [
      "High availability (92%)",
      "Primary specialization match",
      "Low current workload",
      "New CA for this client (variety)"
    ],
    "alternativeCandidates": [
      {
        "caId": "ca-uuid-2",
        "score": 75,
        "reasons": [...],
        "ca": {...}
      }
    ],
    "notificationsSent": {
      "client": true,
      "ca": true,
      "firmAdmin": false
    }
  },
  "message": "Request successfully auto-assigned to John Doe"
}
```

**Response Success (Manual Required)**:
```json
{
  "success": true,
  "data": {
    "success": false,
    "method": "MANUAL_REQUIRED",
    "reasons": [
      "Firm has auto-assignment disabled",
      "Notification sent to firm admin"
    ],
    "notificationsSent": {
      "client": false,
      "ca": false,
      "firmAdmin": true
    }
  },
  "message": "Auto-assignment not possible. Firm admin has been notified."
}
```

**Error Responses**:
- `400`: Request already assigned
- `404`: Request not found
- `500`: Internal error

---

### 2. Manual Assignment

**Endpoint**: `POST /api/assignments/manual`

**Description**: Manually assign a request to a specific CA (firm admin only)

**Authentication**: Required (ADMIN or CA role with FIRM_ADMIN permission)

**Request Body**:
```json
{
  "requestId": "request-uuid",
  "caId": "ca-uuid",
  "reason": "CA has specific expertise in this area",
  "overrideAutoAssignment": false
}
```

**Fields**:
- `requestId` (required): Service request ID
- `caId` (required): CA to assign to
- `reason` (optional): Reason for manual assignment
- `overrideAutoAssignment` (optional): Set `true` to bypass specialization check

**Response Success**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "method": "MANUAL",
    "assignedTo": {
      "caId": "ca-uuid",
      "firmId": "firm-uuid",
      "caName": "Jane Smith"
    },
    "reasons": ["CA has specific expertise in this area"],
    "notificationsSent": {
      "client": true,
      "ca": true,
      "firmAdmin": false
    }
  },
  "message": "Request manually assigned to Jane Smith"
}
```

**Error Responses**:
- `400`: Missing required fields
- `403`: Not a firm admin / CA not specialized (without override)
- `404`: Request or CA not found

---

### 3. Override Assignment

**Endpoint**: `POST /api/assignments/override/:requestId`

**Description**: Override an existing assignment with a new CA

**Authentication**: Required (ADMIN or CA role with FIRM_ADMIN permission)

**Path Parameters**:
- `requestId` (string): Service request ID

**Request Body**:
```json
{
  "newCaId": "ca-uuid",
  "reason": "Original CA unavailable due to emergency"
}
```

**Response Success**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "method": "MANUAL",
    "assignedTo": {
      "caId": "new-ca-uuid",
      "firmId": "firm-uuid",
      "caName": "Sarah Johnson"
    },
    "reasons": ["Original CA unavailable due to emergency"],
    "notificationsSent": {
      "client": true,
      "ca": true,
      "firmAdmin": false
    }
  },
  "message": "Assignment overridden. Request reassigned to Sarah Johnson"
}
```

---

### 4. Get Assignment Recommendations

**Endpoint**: `GET /api/assignments/recommendations/:requestId`

**Description**: Get scored recommendations for a service request without assigning

**Authentication**: Required (ADMIN or CA role)

**Path Parameters**:
- `requestId` (string): Service request ID

**Query Parameters**:
- `limit` (number, default: 5): Number of recommendations to return

**Response Success**:
```json
{
  "success": true,
  "data": {
    "requestId": "request-uuid",
    "recommendations": [
      {
        "caId": "ca-uuid",
        "firmId": "firm-uuid",
        "score": 87,
        "reasons": [
          "High availability (92%)",
          "Primary specialization match",
          "Low current workload"
        ],
        "breakdown": {
          "availabilityMatch": 92,
          "specializationMatch": 100,
          "workloadScore": 90,
          "successRate": 85
        },
        "ca": {
          "id": "ca-uuid",
          "name": "John Doe",
          "email": "john@example.com",
          "specialization": ["GST", "INCOME_TAX"],
          "experienceYears": 8,
          "hourlyRate": 2500
        }
      }
    ],
    "count": 5
  },
  "message": "Assignment recommendations retrieved successfully"
}
```

---

### 5. Get Pending Requests

**Endpoint**: `GET /api/assignments/firm/:firmId/pending`

**Description**: Get all unassigned requests for a firm

**Authentication**: Required (ADMIN or CA role)

**Path Parameters**:
- `firmId` (string): Firm ID

**Query Parameters**:
- `page` (number, default: 1)
- `limit` (number, default: 20)

**Response Success**:
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": "request-uuid",
        "serviceType": "GST",
        "status": "PENDING",
        "createdAt": "2026-01-23T10:00:00Z",
        "client": {
          "user": {
            "name": "Client Name",
            "email": "client@example.com"
          }
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
  "message": "Pending requests retrieved successfully"
}
```

---

### 6. Get CA Assigned Requests

**Endpoint**: `GET /api/assignments/ca/:caId/assigned`

**Description**: Get all assigned requests for a specific CA

**Authentication**: Required (ADMIN or CA role)

**Path Parameters**:
- `caId` (string): CA ID

**Query Parameters**:
- `status` (optional): Filter by status (ACCEPTED, IN_PROGRESS, COMPLETED)
- `page` (number, default: 1)
- `limit` (number, default: 20)

---

### 7. Get Assignment Statistics

**Endpoint**: `GET /api/assignments/stats/firm/:firmId`

**Description**: Get assignment statistics for a firm

**Authentication**: Required (ADMIN or CA role)

**Path Parameters**:
- `firmId` (string): Firm ID

**Query Parameters**:
- `period` (string): 'day' | 'week' | 'month' (default: 'week')

**Response Success**:
```json
{
  "success": true,
  "data": {
    "period": "week",
    "firmId": "firm-uuid",
    "stats": {
      "totalAssignments": 45,
      "autoAssignments": 38,
      "manualAssignments": 7,
      "pendingAssignments": 3,
      "autoAssignmentRate": 84,
      "averageAutoScore": 78
    }
  },
  "message": "Assignment statistics retrieved successfully"
}
```

---

## Scoring Details

### 1. Availability Match (40%)

Calculated based on available vs booked time slots in the next 7 days:

```typescript
workloadRatio = bookedSlots / totalSlots
availabilityScore = 1.0 - workloadRatio

// Examples:
// 0% booked  → 1.0 (100% available)
// 50% booked → 0.5 (50% available)
// 100% booked → 0.0 (0% available)
```

**Threshold**: Availability > 70% adds "High availability" to reasons

---

### 2. Specialization Match (30%)

Based on position in CA's specialization array:

```typescript
if (specialization[0] === serviceType) {
  score = 1.0  // Primary specialization
  reason = "Primary specialization match"
} else if (specialization.includes(serviceType)) {
  score = 0.7  // Secondary specialization
  reason = "Secondary specialization match"
} else {
  score = 0.0  // No match (filtered out)
}
```

---

### 3. Workload Score (20%)

Based on count of active (ACCEPTED or IN_PROGRESS) requests:

| Active Requests | Score | Quality |
|----------------|-------|---------|
| 0 | 1.0 (100%) | Excellent |
| 1-2 | 0.9 (90%) | Very Good |
| 3-5 | 0.6 (60%) | Moderate |
| 6+ | 0.2 (20%) | High Load |

**Threshold**: Workload score > 80% adds "Low current workload" to reasons

---

### 4. Historical Success Rate (10%)

Based on completed requests of the same service type:

```typescript
// Get completed requests of same service type
completedRequests = getCompleted(caId, serviceType)

if (completedRequests.length === 0) {
  return 0.5  // Default middle score for new CAs
}

// Calculate average rating
avgRating = sum(ratings) / count(ratings)
ratingScore = avgRating / 5  // Normalize to 0-1

// Confidence boost based on experience
if (completedRequests >= 10) {
  finalScore = min(ratingScore * 1.1, 1.0)  // +10% boost
} else if (completedRequests < 3) {
  finalScore = ratingScore * 0.9  // -10% penalty
}
```

**Threshold**: Success rate > 80% adds "High success rate with similar requests" to reasons

---

### 5. Client Variety Bonus (5%)

Preference for CAs who haven't worked with the client before:

```typescript
hasWorkedWithClient = count(completedRequests(caId, clientId)) > 0

if (!hasWorkedWithClient && totalScore > 0.5) {
  finalScore = min(totalScore * 1.05, 1.0)  // +5% boost
  reason = "New CA for this client (variety)"
}
```

---

## Business Rules

### Auto-Assignment Conditions

1. **Firm Must Enable**: `firm.autoAssignmentEnabled = true`
2. **Eligible Candidates**: At least one CA meeting all criteria
3. **Minimum Score**: Highest score must be ≥ 50
4. **Request State**: Request must not already be assigned

### Manual Assignment Required When:

1. Firm has `autoAssignmentEnabled = false`
2. No eligible candidates found
3. Highest score below threshold (< 50)
4. Auto-assignment fails for any reason

### After-Hours Rules

Business hours: 9 AM - 6 PM, Monday-Friday

**After hours or weekends**:
- Only CAs with `canWorkIndependently = true` are eligible
- Other CAs are filtered out before scoring

### Firm Admin Permissions

Only CAs with `role = FIRM_ADMIN` can:
- Manually assign requests
- Override auto-assignments
- View assignment recommendations
- Access assignment statistics

---

## Email Notifications

### Client Notification (Assignment Complete)
```
Subject: Your Service Request Has Been Assigned
Content:
- CA name and contact
- Firm name
- Assignment method (Auto/Manual)
- Request ID
```

### CA Notification (New Assignment)
```
Subject: New Service Request Assigned to You
Content:
- Client name
- Firm name
- Assignment method
- Request ID
- Call to action: Review request
```

### Firm Admin Notification (Manual Required)
```
Subject: Manual Assignment Required - [Firm Name]
Content:
- Request ID
- Reason (auto-assignment disabled, no match, etc.)
- Link to assignment interface
```

---

## Integration with Service Request Creation

When a client creates a service request to a firm:

```typescript
// 1. Create service request
const request = await createServiceRequest({
  clientId,
  firmId,
  serviceType,
  ...otherFields
});

// 2. Trigger hybrid assignment
const assignmentResult = await HybridAssignmentService.assignServiceRequest(
  request.id
);

// 3. Return combined result to client
return {
  request,
  assignment: assignmentResult
};
```

---

## Testing the System

### Prerequisites
```bash
# 1. Ensure backend is running
docker ps | grep ca_backend

# 2. Have test data:
# - 1 Firm with autoAssignmentEnabled = true
# - 3+ Verified CAs as members
# - 1 Client account
```

### Test Scenarios

#### Scenario 1: Successful Auto-Assignment
```bash
# 1. Create firm with auto-assignment enabled
curl -X POST http://localhost:8081/api/firms/initiate \
  -H "Authorization: Bearer $CA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'

# 2. Update firm to enable auto-assignment
curl -X PATCH http://localhost:8081/api/firms/$FIRM_ID \
  -H "Authorization: Bearer $CA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"autoAssignmentEnabled": true}'

# 3. Create service request
curl -X POST http://localhost:8081/api/service-requests \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firmId": "$FIRM_ID",
    "serviceType": "GST",
    "description": "GST filing assistance"
  }'

# 4. Trigger auto-assignment
curl -X POST http://localhost:8081/api/assignments/auto-assign/$REQUEST_ID \
  -H "Authorization: Bearer $CA_ADMIN_TOKEN"
```

#### Scenario 2: Manual Assignment Required
```bash
# 1. Disable auto-assignment
curl -X PATCH http://localhost:8081/api/firms/$FIRM_ID \
  -H "Authorization: Bearer $CA_TOKEN" \
  -d '{"autoAssignmentEnabled": false}'

# 2. Create request (will notify admin)
curl -X POST http://localhost:8081/api/assignments/auto-assign/$REQUEST_ID \
  -H "Authorization: Bearer $CA_ADMIN_TOKEN"

# 3. Get recommendations
curl -X GET http://localhost:8081/api/assignments/recommendations/$REQUEST_ID \
  -H "Authorization: Bearer $CA_ADMIN_TOKEN"

# 4. Manually assign
curl -X POST http://localhost:8081/api/assignments/manual \
  -H "Authorization: Bearer $CA_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "$REQUEST_ID",
    "caId": "$CA_ID",
    "reason": "CA has best expertise"
  }'
```

#### Scenario 3: Override Assignment
```bash
# 1. Override existing assignment
curl -X POST http://localhost:8081/api/assignments/override/$REQUEST_ID \
  -H "Authorization: Bearer $CA_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "newCaId": "$NEW_CA_ID",
    "reason": "Original CA is unavailable"
  }'
```

---

## Performance Considerations

### Caching Strategy
- Cache firm member lists for 5 minutes
- Cache availability data for 1 minute
- Invalidate on assignment changes

### Database Optimization
- Index on `serviceRequest.firmId` and `serviceRequest.caId`
- Index on `availability.caId` and `availability.date`
- Index on `serviceRequest.status` for pending queries

### Async Operations
- Email notifications sent asynchronously
- Score calculations can be parallelized
- Background jobs for statistics aggregation

---

## Future Enhancements

1. **PTO/Time-Off Integration**
   - Add PTO model
   - Filter out CAs with upcoming time-off
   - Consider time-off in availability scoring

2. **Machine Learning**
   - Learn from successful assignments
   - Adjust weights based on firm performance
   - Predict client-CA compatibility

3. **Advanced Filters**
   - Language preferences
   - Location proximity
   - Industry expertise matching

4. **Real-time Updates**
   - WebSocket notifications
   - Live assignment status
   - Real-time workload updates

5. **Analytics Dashboard**
   - Assignment success metrics
   - CA performance tracking
   - Client satisfaction correlation

---

## Troubleshooting

### Issue: No eligible candidates found
**Cause**: All CAs filtered out by eligibility checks
**Solution**:
1. Check CA verification status
2. Verify specializations match service type
3. Check `canWorkIndependently` for after-hours requests
4. Review firm membership status

### Issue: All scores below threshold
**Cause**: Low availability, high workload, or poor match
**Solution**:
1. Review CA availability schedules
2. Redistribute workload
3. Add more CAs to firm
4. Use manual assignment

### Issue: Notifications not sent
**Cause**: Email service not configured
**Solution**:
- Check console logs for email data
- Configure SMTP/SendGrid/SES in production
- Verify email addresses are valid

---

## API Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| 400 | Bad Request | Check required fields |
| 401 | Unauthorized | Verify JWT token |
| 403 | Forbidden | Check role permissions |
| 404 | Not Found | Verify resource IDs |
| 500 | Server Error | Check logs, contact support |

---

## Summary

The Hybrid Assignment System provides:
- ✅ Intelligent auto-assignment with 4-factor scoring
- ✅ Manual override capabilities
- ✅ Real-time recommendations
- ✅ Comprehensive notifications
- ✅ Client variety consideration
- ✅ After-hours support
- ✅ Performance tracking

**Status**: ✅ **Ready for Testing**

---

**Related Documentation**:
- [Firm Registration API](./FIRM_REGISTRATION_API.md)
- [Firm Management](./FIRM_MANAGEMENT.md)
- [Service Request Flow](./SERVICE_REQUEST_FLOW.md)
