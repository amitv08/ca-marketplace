# Phase 6: Client Experience & Provider Selection

## Quick Start

Phase 6 adds intelligent provider search, comparison, and recommendation features to help clients choose between individual CAs and CA firms.

## What's New

### 🔍 Unified Provider Search
Search across both individual CAs and firms with advanced filtering:
- Provider type (Individual, Firm, or Both)
- Firm size (Solo, Small, Medium, Large)
- Specializations
- Location (City, State)
- Price range
- Rating
- Availability

### ⚖️ Provider Comparison
- General comparison matrix showing Individual vs Firm differences
- Side-by-side comparison of specific providers
- Strengths and considerations for each provider type
- Detailed factor-by-factor analysis

### 🎯 Intelligent Recommendations
- AI-powered recommendations based on project requirements
- Multi-factor analysis (complexity, urgency, budget, duration)
- Confidence scoring
- Cost comparison
- Detailed reasoning

### 📝 Enhanced Service Requests
- Create requests to individual CAs or firms
- Specify assignment preferences for firms:
  - Best available team member (auto-assignment)
  - Specific CA from firm
  - Senior CA only (premium)
- Dynamic pricing based on provider type

## API Endpoints

All endpoints are available at `http://localhost:8080/api` (or your configured base URL).

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/providers/search` | GET | Search providers with filters |
| `/providers/:id` | GET | Get provider details |
| `/providers/comparison/general` | GET | Get comparison matrix |
| `/providers/comparison` | POST | Compare specific providers |
| `/providers/recommendation` | POST | Get personalized recommendation |
| `/providers/recommendation/quick` | GET | Get quick recommendation |
| `/service-requests` | POST | Create service request (enhanced) |

## Testing

### Using the Test Script

```bash
# Set your authentication token
export AUTH_TOKEN="your-jwt-token-here"

# Run all tests
./test-phase6-apis.sh

# Or with inline token
AUTH_TOKEN="your-token" ./test-phase6-apis.sh
```

### Manual Testing with cURL

#### 1. Search for Providers
```bash
curl -X GET "http://localhost:8080/api/providers/search?providerType=BOTH&specializations=GST&city=Mumbai" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 2. Get General Comparison
```bash
curl -X GET "http://localhost:8080/api/providers/comparison/general" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 3. Get Recommendation
```bash
curl -X POST "http://localhost:8080/api/providers/recommendation" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceType": "AUDIT",
    "complexity": "COMPLEX",
    "urgency": "NORMAL",
    "budget": 100000,
    "duration": "LONG_TERM",
    "estimatedHours": 60
  }'
```

#### 4. Create Service Request to Firm
```bash
curl -X POST "http://localhost:8080/api/service-requests" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "providerType": "FIRM",
    "firmId": "YOUR_FIRM_ID",
    "assignmentPreference": "BEST_AVAILABLE",
    "serviceType": "AUDIT",
    "description": "Annual audit",
    "estimatedHours": 50
  }'
```

## Files Overview

### Services
- `backend/src/services/provider-search.service.ts` - Provider search logic
- `backend/src/services/provider-comparison.service.ts` - Comparison logic
- `backend/src/services/provider-recommendation.service.ts` - Recommendation engine

### Routes
- `backend/src/routes/provider.routes.ts` - Provider endpoints
- `backend/src/routes/serviceRequest.routes.ts` - Enhanced request creation

### Documentation
- `PHASE6_API_DOCUMENTATION.md` - Complete API reference
- `PHASE6_IMPLEMENTATION_SUMMARY.md` - Implementation details
- `PHASE6_README.md` - This file
- `test-phase6-apis.sh` - Test script

## Decision Matrix

Use this to help clients choose:

| Your Situation | Recommended | Why |
|----------------|-------------|-----|
| Simple tax filing, urgent, tight budget | Individual CA | Lower cost, faster response |
| Complex audit, multiple specializations | CA Firm | Team expertise, backup |
| One-time consultation | Individual CA | Direct relationship |
| Ongoing accounting needs | CA Firm | Continuity, backup coverage |
| Need weekend/after-hours support | CA Firm | Multiple team members |
| Specific niche expertise | Individual CA | Deep specialization |

## Common Use Cases

### Use Case 1: Client Needs GST Filing (Simple)
1. Get recommendation → Returns "INDIVIDUAL"
2. Search for individuals with GST specialization
3. Compare top 2-3 CAs
4. Create request to selected CA

### Use Case 2: Company Needs Annual Audit (Complex)
1. Get recommendation → Returns "FIRM"
2. Search for firms with AUDIT specialization
3. View general comparison matrix
4. Compare specific firms
5. Create request to selected firm with "BEST_AVAILABLE" preference

### Use Case 3: Startup Needs Ongoing Tax Planning
1. Get recommendation → Returns "FIRM" or "EITHER"
2. Search both types
3. Compare top individual vs top firm
4. Make decision based on:
   - Budget constraints
   - Need for backup
   - Preference for direct relationship

## Ranking Algorithm

Providers are ranked using a weighted algorithm:

```
Total Score =
  (Rating/5 × 30) +
  (Response Rate × 20) +
  (Completion Rate × 20) +
  (Confidence Score/100 × 15) +
  (min(Reviews/20, 1) × 10) +
  (min(Experience/15, 1) × 5)

× Availability Multiplier
× Type-Specific Bonuses
```

### Factors:
- **Rating (30%)**: Average client rating
- **Response Rate (20%)**: How quickly provider responds
- **Completion Rate (20%)**: % of projects completed successfully
- **Confidence (15%)**: Based on reviews, experience, team size
- **Reviews (10%)**: Social proof
- **Experience (5%)**: Years of experience

## Recommendation Logic

The system analyzes four key factors:

### 1. Complexity (30% weight)
- Simple projects → Individual
- Complex projects → Firm

### 2. Urgency (25% weight)
- Urgent deadline → Individual (faster)
- Flexible timeline → Firm (thorough)

### 3. Budget (25% weight)
- Tight budget → Individual (lower cost)
- Flexible budget → Firm (premium service)

### 4. Duration (20% weight)
- One-time/Short → Individual
- Long-term/Ongoing → Firm (continuity)

## Pricing

### Individual CAs
- **Hourly Rate**: ₹1,000 - ₹3,000/hour
- **Structure**: Hourly billing
- **Estimation**: Rate × Hours

### CA Firms
- **Structure**: Project-based or hourly
- **Premium**: 20-40% over individual rates
- **Hourly Rate**: ₹1,500 - ₹4,000/hour
- **Project Fee**: Based on scope and team size

## Next Steps

### For Backend Developers
1. Review implementation in services and routes
2. Run test script to verify endpoints
3. Check database for test data
4. Monitor API performance

### For Frontend Developers
1. Review API documentation
2. Implement provider search UI
3. Create comparison matrix component
4. Build recommendation display
5. Update service request form

### For Product Managers
1. Review decision matrix
2. Plan user flows
3. Design A/B tests for recommendations
4. Define success metrics

## Support & Documentation

- **API Docs**: `PHASE6_API_DOCUMENTATION.md`
- **Implementation**: `PHASE6_IMPLEMENTATION_SUMMARY.md`
- **Test Script**: `test-phase6-apis.sh`
- **Schema**: `backend/prisma/schema.prisma`

## Troubleshooting

### "Provider not found" Error
- Ensure you're using valid provider IDs from the database
- Check provider type matches (INDIVIDUAL vs FIRM)

### "Firm has no active members" Error
- Verify firm has active members in FirmMembership table
- Check member `isActive` status

### Empty Search Results
- Verify database has providers matching filters
- Check verification status (only VERIFIED CAs and ACTIVE firms shown)
- Try broader search criteria

### Recommendation Returns "EITHER"
- Project factors are balanced
- Both options are equally suitable
- Client should use personal preference

## Performance Tips

1. **Use Pagination**: Always specify page and limit
2. **Cache Results**: Consider caching search results client-side
3. **Specific Filters**: Use specific filters to reduce result set
4. **Index Usage**: Database is optimized with proper indexes

## Security Notes

- All endpoints require authentication
- CLIENT role required for creating requests
- Rate limiting applies (100 req/min per user)
- Input validation on all parameters

## Future Enhancements

Planned for future phases:
- [ ] Machine learning for better recommendations
- [ ] Saved searches and preferences
- [ ] Provider comparison history
- [ ] Favorite providers
- [ ] Request templates
- [ ] Real-time availability checking
- [ ] Video consultations
- [ ] Provider profiles with portfolios

## Feedback

Have feedback or found a bug? Please report issues with:
- API endpoint used
- Request payload
- Expected vs actual response
- Error messages (if any)

---

**Version**: 1.0.0
**Last Updated**: 2026-01-24
**Status**: ✅ Backend Complete, ⏳ Frontend Pending
