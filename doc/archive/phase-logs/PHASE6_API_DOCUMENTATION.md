# Phase 6: Client Experience & Provider Selection - API Documentation

## Overview

Phase 6 implements enhanced provider search and selection features that allow clients to choose between individual CAs and CA firms. The system provides intelligent recommendations, side-by-side comparisons, and a unified search interface.

## API Endpoints

### 1. Provider Search

#### `GET /api/providers/search`

Unified search across both individual CAs and firms with advanced filtering and ranking.

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Options | Description |
|-----------|------|---------|-------------|
| `providerType` | string | `INDIVIDUAL`, `FIRM`, `BOTH` | Filter by provider type (default: `BOTH`) |
| `firmSize` | string | `SOLO`, `SMALL`, `MEDIUM`, `LARGE` | Filter firms by size |
| `specializations` | string | Comma-separated | Filter by required specializations |
| `minRating` | number | 0-5 | Minimum average rating |
| `maxHourlyRate` | number | - | Maximum hourly rate for individuals |
| `maxProjectFee` | number | - | Maximum project fee for firms |
| `city` | string | - | Filter by city |
| `state` | string | - | Filter by state |
| `availableNow` | boolean | `true`, `false` | Show only immediately available providers |
| `experienceYears` | number | - | Minimum years of experience |
| `page` | number | - | Page number (default: 1) |
| `limit` | number | - | Results per page (default: 20) |

**Response Example:**
```json
{
  "success": true,
  "message": "Providers retrieved successfully",
  "data": {
    "results": [
      {
        "id": "ca-123",
        "type": "INDIVIDUAL",
        "name": "Rajesh Kumar",
        "rating": 4.8,
        "reviewCount": 45,
        "responseRate": 92,
        "specializations": ["GST", "INCOME_TAX"],
        "hourlyRate": 1500,
        "availability": "WITHIN_WEEK",
        "experienceYears": 8,
        "completionRate": 95,
        "responseTime": "< 2 hours",
        "city": "Mumbai",
        "state": "Maharashtra",
        "rankingScore": 87.5,
        "confidenceScore": 85
      },
      {
        "id": "firm-456",
        "type": "FIRM",
        "name": "Kumar & Associates",
        "rating": 4.6,
        "reviewCount": 120,
        "responseRate": 88,
        "specializations": ["GST", "INCOME_TAX", "AUDIT", "TAX_PLANNING"],
        "projectFeeRange": { "min": 18000, "max": 168000 },
        "availability": "IMMEDIATE",
        "firmSize": 12,
        "completionRate": 92,
        "responseTime": "< 4 hours",
        "city": "Mumbai",
        "state": "Maharashtra",
        "rankingScore": 85.2,
        "confidenceScore": 88,
        "teamCount": 12,
        "seniorCACount": 4,
        "verificationLevel": "VERIFIED",
        "clientRetentionRate": 75
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 42,
      "totalPages": 3
    },
    "facets": {
      "specializations": [...],
      "cities": [...],
      "states": [...],
      "firmSizes": ["SOLO", "SMALL", "MEDIUM", "LARGE"],
      "ratingRanges": [...]
    }
  }
}
```

---

### 2. Provider Details

#### `GET /api/providers/:id`

Get detailed information about a specific provider.

**Authentication:** Required

**Path Parameters:**
- `id` - Provider ID (CA ID or Firm ID)

**Query Parameters:**
- `type` (required) - `INDIVIDUAL` or `FIRM`

**Response:** Detailed provider information including reviews, past projects, team members (for firms), etc.

---

### 3. General Comparison Matrix

#### `GET /api/providers/comparison/general`

Get a general comparison matrix showing differences between individual CAs and firms.

**Authentication:** Required

**Response Example:**
```json
{
  "success": true,
  "data": {
    "factors": [
      {
        "factor": "Pricing",
        "individual": "₹1500/hour (Hourly rate)",
        "firm": "₹50000+ (Project-based, 20-40% premium)",
        "winner": "INDIVIDUAL"
      },
      {
        "factor": "Availability",
        "individual": "Limited by one person (may be unavailable)",
        "firm": "Multiple team members (always someone available)",
        "winner": "FIRM"
      },
      ...
    ],
    "individualsSummary": {
      "averageRating": 4.5,
      "averageResponseTime": "< 2 hours",
      "averageCost": "₹1500/hour",
      "totalProviders": 245,
      "recommendedFor": [
        "Simple, straightforward projects",
        "Urgent deadlines",
        "Tight budgets",
        "One-time engagements",
        "Direct personal attention"
      ]
    },
    "firmsSummary": {
      "averageRating": 4.6,
      "averageResponseTime": "< 4 hours",
      "averageCost": "₹50000+ project fee",
      "totalProviders": 38,
      "recommendedFor": [
        "Complex, multi-faceted projects",
        "Long-term engagements",
        "Need for backup coverage",
        "Multiple specializations required",
        "Established quality processes"
      ]
    }
  }
}
```

---

### 4. Compare Specific Providers

#### `POST /api/providers/comparison`

Compare two specific providers side-by-side.

**Authentication:** Required

**Request Body:**
```json
{
  "provider1Id": "ca-123",
  "provider1Type": "INDIVIDUAL",
  "provider2Id": "firm-456",
  "provider2Type": "FIRM"
}
```

**Response Example:**
```json
{
  "success": true,
  "data": {
    "provider1": {
      "id": "ca-123",
      "type": "INDIVIDUAL",
      "name": "Rajesh Kumar",
      "rating": 4.8,
      ...
      "strengths": [
        "Excellent client ratings",
        "Very high completion rate",
        "Highly experienced professional"
      ],
      "considerations": [
        "Limited availability (one person)",
        "No backup if unavailable"
      ]
    },
    "provider2": {
      "id": "firm-456",
      "type": "FIRM",
      "name": "Kumar & Associates",
      ...
      "strengths": [
        "Large, experienced team",
        "Comprehensive expertise",
        "Always someone available"
      ],
      "considerations": [
        "20-40% cost premium over individuals",
        "May involve internal routing delays"
      ]
    },
    "sideBySide": [
      {
        "factor": "Average Rating",
        "provider1Value": "4.8 ⭐ (45 reviews)",
        "provider2Value": "4.6 ⭐ (120 reviews)",
        "better": 1
      },
      ...
    ],
    "recommendation": "Choose Kumar & Associates (firm) for complex projects requiring multiple specializations and backup coverage. Choose Rajesh Kumar (individual) for simpler projects requiring direct attention and faster response times."
  }
}
```

---

### 5. Get Recommendation

#### `POST /api/providers/recommendation`

Get intelligent recommendation for individual vs firm based on project requirements.

**Authentication:** Required

**Request Body:**
```json
{
  "serviceType": "AUDIT",
  "description": "Annual audit for manufacturing company",
  "budget": 80000,
  "urgency": "NORMAL",
  "duration": "LONG_TERM",
  "complexity": "COMPLEX",
  "requiresMultipleSpecializations": true,
  "estimatedHours": 50
}
```

**Request Parameters:**
| Field | Type | Required | Options |
|-------|------|----------|---------|
| `serviceType` | string | Yes | Any valid `ServiceType` |
| `description` | string | No | - |
| `budget` | number | No | - |
| `urgency` | string | No | `IMMEDIATE`, `URGENT`, `NORMAL`, `FLEXIBLE` |
| `duration` | string | No | `ONE_TIME`, `SHORT_TERM`, `LONG_TERM`, `ONGOING` |
| `complexity` | string | No | `SIMPLE`, `MODERATE`, `COMPLEX`, `VERY_COMPLEX` |
| `requiresMultipleSpecializations` | boolean | No | - |
| `preferredStartDate` | date | No | ISO 8601 format |
| `estimatedHours` | number | No | - |

**Response Example:**
```json
{
  "success": true,
  "data": {
    "recommendedType": "FIRM",
    "confidence": 85,
    "reasoning": [
      "High project complexity suggests a team-based approach with multiple experts",
      "Long-term engagement benefits from firm continuity and backup support",
      "Budget accommodates firm premium for enhanced service and support"
    ],
    "individualAdvantages": [
      "Typically 20-40% lower cost than firms",
      "Direct communication with your CA",
      "Personal attention throughout the project",
      "Faster response times (< 2 hours average)"
    ],
    "firmAdvantages": [
      "Multiple team members with diverse specializations",
      "Always someone available (backup coverage)",
      "Established processes and quality controls",
      "Better for complex, multi-faceted projects",
      "Continuity if primary CA unavailable"
    ],
    "estimatedCostComparison": {
      "individual": { "min": 62400, "max": 93600 },
      "firm": { "min": 83200, "max": 124800 }
    },
    "factors": {
      "complexity": { "score": 70, "favors": "FIRM" },
      "urgency": { "score": 50, "favors": "NEUTRAL" },
      "budget": { "score": 35, "favors": "FIRM" },
      "duration": { "score": 35, "favors": "FIRM" }
    }
  }
}
```

---

### 6. Quick Recommendation

#### `GET /api/providers/recommendation/quick`

Get quick recommendation based on simplified criteria.

**Authentication:** Required

**Query Parameters:**
- `complexity` - `SIMPLE` or `COMPLEX`
- `urgency` - `URGENT` or `NORMAL`
- `budget` - `TIGHT` or `FLEXIBLE`
- `duration` - `SHORT` or `LONG`

**Response Example:**
```json
{
  "success": true,
  "data": {
    "recommendedType": "FIRM"
  }
}
```

---

### 7. Create Service Request (Enhanced)

#### `POST /api/service-requests`

Create a service request with support for both individual CAs and firms.

**Authentication:** Required (CLIENT role)

**Request Body Examples:**

**Individual CA Request:**
```json
{
  "providerType": "INDIVIDUAL",
  "caId": "ca-123",
  "serviceType": "INCOME_TAX_RETURN",
  "description": "Personal income tax filing for FY 2025-26",
  "deadline": "2026-07-31",
  "estimatedHours": 5,
  "documents": {}
}
```

**Firm Request - Best Available:**
```json
{
  "providerType": "FIRM",
  "firmId": "firm-456",
  "assignmentPreference": "BEST_AVAILABLE",
  "serviceType": "AUDIT",
  "description": "Annual audit for manufacturing company",
  "deadline": "2026-06-30",
  "estimatedHours": 50,
  "documents": {}
}
```

**Firm Request - Specific CA:**
```json
{
  "providerType": "FIRM",
  "firmId": "firm-456",
  "caId": "ca-789",
  "assignmentPreference": "SPECIFIC_CA",
  "serviceType": "TAX_PLANNING",
  "description": "Tax planning consultation",
  "deadline": "2026-03-31",
  "estimatedHours": 20,
  "documents": {}
}
```

**Firm Request - Senior CA Only:**
```json
{
  "providerType": "FIRM",
  "firmId": "firm-456",
  "assignmentPreference": "SENIOR_ONLY",
  "serviceType": "FINANCIAL_CONSULTING",
  "description": "Financial restructuring consultation",
  "deadline": "2026-04-15",
  "estimatedHours": 30,
  "documents": {}
}
```

**Response:** Service request details with pricing information.

---

## Comparison Matrix

### Individual CA vs CA Firm

| Factor | Individual CA | CA Firm | Winner |
|--------|---------------|---------|--------|
| **Pricing** | ₹1,500/hour (Hourly rate) | ₹50,000+ (Project-based, 20-40% premium) | Individual |
| **Availability** | Limited by one person | Multiple team members (always available) | Firm |
| **Expertise** | Specialized in 1-2 areas | Broad coverage across specializations | Tie |
| **Backup** | No backup if unavailable | Always someone available | Firm |
| **Response Time** | Personal, fast (< 2 hours) | May have delays (< 4 hours) | Individual |
| **Cost** | Typically lower | 20-40% premium | Individual |
| **Communication** | Direct, personal relationship | May involve multiple team members | Individual |
| **Scalability** | Limited by one person's capacity | Can handle larger, complex projects | Firm |
| **Quality Control** | Personal responsibility | Established processes, senior review | Firm |
| **Long-term Continuity** | Dependent on individual availability | Better continuity with team structure | Firm |

---

## Client Request Flow

### 1. Provider Selection Page

**Step 1:** Client views side-by-side comparison matrix
- GET `/api/providers/comparison/general`

**Step 2:** Client enters project requirements to get recommendation
- POST `/api/providers/recommendation`

**Step 3:** Client searches for providers
- GET `/api/providers/search?providerType=BOTH&specializations=AUDIT&city=Mumbai`

**Step 4:** Client compares specific providers
- POST `/api/providers/comparison`

### 2. Request Form

**If Individual Selected:**
- Client directly assigns to that CA
- Hourly rate pricing displayed
- Estimated cost = hourly rate × estimated hours

**If Firm Selected:**
- Client chooses assignment preference:
  - "Assign to best available team member" (AUTO)
  - "I want to work with specific CA: [dropdown]" (CLIENT_SPECIFIED)
  - "Senior CA only" (MANUAL with premium pricing)
- Project-based pricing displayed
- Premium percentage shown (20-40%)

### 3. Submit Request

- POST `/api/service-requests` with appropriate payload

---

## Ranking Algorithm

The provider search uses a weighted ranking algorithm:

### Scoring Factors:
- **Rating Score (30%)**: Provider's average rating
- **Response Rate (20%)**: Historical response rate
- **Completion Rate (20%)**: Percentage of completed projects
- **Confidence Score (15%)**: Based on review count, experience, team size
- **Review Count Bonus (10%)**: More reviews = higher trust
- **Experience Bonus (5%)**: Years of experience

### Availability Multiplier:
- IMMEDIATE: 1.1×
- WITHIN_WEEK: 1.05×
- WITHIN_MONTH: 1.0×
- BUSY: 0.9×

### Type-Specific Adjustments:
- **Firms:** Bonus for team size and client retention rate
- **Individuals:** Bonus for response rate and specialization focus

---

## Confidence Indicators

### Individual CA Confidence Score (0-100):
- Review count: up to 40 points
- Completion rate: up to 40 points
- Experience: up to 20 points

### Firm Confidence Score (0-100):
- Review count: up to 30 points
- Completion rate: up to 30 points
- Team size: up to 20 points
- Client retention rate: up to 20 points

---

## Recommendation Engine Logic

The recommendation engine analyzes four key factors:

### 1. Complexity (30% weight)
- **High Complexity** → Recommends Firms
- **Low Complexity** → Recommends Individuals

### 2. Urgency (25% weight)
- **Urgent** → Recommends Individuals (faster response)
- **Flexible** → Recommends Firms (thorough process)

### 3. Budget (25% weight)
- **Tight Budget** → Recommends Individuals (lower cost)
- **Flexible Budget** → Recommends Firms (premium service)

### 4. Duration (20% weight)
- **Short-term/One-time** → Recommends Individuals
- **Long-term/Ongoing** → Recommends Firms (continuity, backup)

**Decision Threshold:**
- Score difference < 10: Recommend "EITHER"
- Score difference ≥ 10: Recommend winning type

---

## Error Handling

All endpoints follow standard error response format:

```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

Common error codes:
- `PROVIDER_NOT_FOUND` - Provider doesn't exist
- `INVALID_PROVIDER_TYPE` - Invalid provider type specified
- `FIRM_NOT_ACTIVE` - Selected firm is not active
- `CA_NOT_VERIFIED` - Selected CA is not verified
- `NO_ACTIVE_MEMBERS` - Firm has no active team members
- `VALIDATION_ERROR` - Request validation failed

---

## Rate Limiting

All endpoints are subject to standard rate limiting:
- 100 requests per minute per user
- 1000 requests per hour per user

---

## Testing Examples

### Example 1: Find Individual CAs in Mumbai for GST Filing

```bash
GET /api/providers/search?providerType=INDIVIDUAL&specializations=GST&city=Mumbai&maxHourlyRate=2000&page=1&limit=10
```

### Example 2: Find Medium-sized Firms with Audit Expertise

```bash
GET /api/providers/search?providerType=FIRM&firmSize=MEDIUM&specializations=AUDIT&minRating=4.0
```

### Example 3: Get Recommendation for Complex Audit Project

```bash
POST /api/providers/recommendation
{
  "serviceType": "AUDIT",
  "complexity": "COMPLEX",
  "urgency": "NORMAL",
  "budget": 100000,
  "duration": "LONG_TERM",
  "estimatedHours": 60
}
```

### Example 4: Compare Top Individual vs Top Firm

```bash
POST /api/providers/comparison
{
  "provider1Id": "ca-top-individual",
  "provider1Type": "INDIVIDUAL",
  "provider2Id": "firm-top-rated",
  "provider2Type": "FIRM"
}
```

---

## Implementation Status

✅ **Completed:**
- Provider Search Service
- Provider Comparison Service
- Provider Recommendation Service
- Provider Routes
- Enhanced Service Request Creation
- Ranking Algorithm
- Confidence Score Calculation
- Faceted Search Support

📋 **Documentation:**
- API Documentation (this file)
- Service architecture documented
- Request/response examples provided

🔄 **Integration Points:**
- Frontend components needed for:
  - Provider search interface
  - Comparison matrix display
  - Recommendation display
  - Dynamic request form

---

## Next Steps

1. **Frontend Development:**
   - Build provider search page with filters
   - Create comparison matrix UI component
   - Implement dynamic request form
   - Add recommendation display

2. **Testing:**
   - Integration tests for all endpoints
   - Load testing for search performance
   - User acceptance testing

3. **Optimization:**
   - Add caching for frequently accessed data
   - Optimize search queries with proper indexing
   - Implement search result caching

4. **Monitoring:**
   - Track search queries and patterns
   - Monitor recommendation accuracy
   - Measure conversion rates (search → request)
