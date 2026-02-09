# Test Data Factories

This directory contains test data factories for creating different types of CAs and firms for testing purposes.

## Available Factories

### 1. Solo Practitioner Factory
Creates individual CA (Chartered Accountant) for baseline testing.

**Usage**:
```javascript
const { createSoloPractitioner } = require('./factories');

// Create default solo CA
const { user, ca } = await createSoloPractitioner();

// Create with custom data
const seniorCA = await createSoloPractitioner({
  user: {
    name: 'CA Senior Expert',
    email: 'senior@test.com'
  },
  ca: {
    experienceYears: 15,
    hourlyRate: 3000,
    specialization: ['AUDIT', 'TAX'],
    rating: 4.9
  }
});

// Create multiple CAs
const practitioners = await createMultipleSoloPractitioners(10);
```

### 2. Small Firm Factory (3 members)
Creates a small CA firm with 3 team members for testing firm dynamics.

**Members**:
- 1 Managing Partner (EQUITY_PARTNER)
- 1 Partner (EQUITY_PARTNER)
- 1 Associate (SALARIED_PARTNER)

**Usage**:
```javascript
const { createSmallFirm } = require('./factories');

// Create small firm
const {
  firm,
  members,
  managingPartner,
  partner,
  associate
} = await createSmallFirm();

// Create with custom data
const customFirm = await createSmallFirm({
  firm: {
    firmName: 'Custom Associates',
    city: 'Delhi'
  },
  managingPartner: {
    ca: { hourlyRate: 3500 }
  }
});
```

### 3. Medium Firm Factory (15 members)
Creates a medium-sized firm with 15 members for testing scaling and distribution.

**Members**:
- 1 Managing Partner
- 3 Partners
- 5 Senior CAs
- 4 Junior CAs
- 2 Associates

**Usage**:
```javascript
const { createMediumFirm } = require('./factories');

// Create medium firm
const {
  firm,
  members,
  membersByRole,
  totalMembers
} = await createMediumFirm();

// Access specific roles
console.log(membersByRole.managingPartner); // Array of 1
console.log(membersByRole.partners); // Array of 3
console.log(membersByRole.seniorCAs); // Array of 5
```

### 4. Large Firm Factory (50+ members)
Creates a large enterprise firm for performance testing.

**Usage**:
```javascript
const { createLargeFirm } = require('./factories');

// Create firm with 50 members (default)
const { firm, members, stats } = await createLargeFirm();

// Create firm with 100 members
const largeFirm = await createLargeFirm(100);

// Create multiple large firms
const firms = await createMultipleLargeFirms(3, 50); // 3 firms, 50 members each
```

**Role Distribution**:
- 2% Managing Partners
- 10% Partners
- 30% Senior CAs
- 40% Junior CAs
- 18% Associates

## Cleanup

Always clean up test data after tests:

```javascript
// Delete solo practitioner
await deleteSoloPractitioner(userId);

// Delete small firm
await deleteSmallFirm(firmId);

// Delete medium firm
await deleteMediumFirm(firmId);

// Delete large firm
await deleteLargeFirm(firmId);
```

## Factory Configuration

### Solo Practitioner Defaults
```javascript
{
  user: {
    name: 'CA Amit Sharma <random>',
    email: 'solo_<timestamp>@test.com',
    password: 'Test@1234',
    role: 'CA',
    isVerified: true
  },
  ca: {
    caLicenseNumber: 'ICAI<random>',
    verificationStatus: 'VERIFIED',
    specialization: ['GST', 'TAX_FILING'],
    experienceYears: 5,
    hourlyRate: 1500,
    rating: 4.7,
    totalReviews: 45,
    completedProjects: 120
  }
}
```

### Small Firm Defaults
```javascript
{
  firmName: 'Test & Associates <random>',
  firmType: 'PARTNERSHIP',
  status: 'ACTIVE',
  verificationLevel: 'VERIFIED',
  establishedYear: 2018,
  city: 'Mumbai',
  state: 'Maharashtra'
}
```

### Medium Firm Defaults
```javascript
{
  firmName: 'Professional Tax Consultants LLP <random>',
  firmType: 'LLP',
  status: 'ACTIVE',
  verificationLevel: 'VERIFIED',
  establishedYear: 2015,
  city: 'Bangalore',
  state: 'Karnataka'
}
```

### Large Firm Defaults
```javascript
{
  firmName: 'Enterprise Tax & Audit Corporation <random>',
  firmType: 'CORPORATE',
  status: 'ACTIVE',
  verificationLevel: 'PREMIUM',
  establishedYear: 2010,
  city: 'Delhi',
  state: 'Delhi'
}
```

## Performance Considerations

### Large Firm Creation
- 50 members: ~25-30 seconds
- 100 members: ~50-60 seconds
- Database operations are batched for better performance
- Progress updates every 10 members

### Recommendations
- Use small/medium firms for unit and integration tests
- Use large firms only for performance and load testing
- Clean up test data after each test suite
- Consider using database transactions for faster cleanup

## Example Test Suite

```javascript
const {
  createSoloPractitioner,
  createSmallFirm,
  createMediumFirm,
  deleteSmallFirm
} = require('./factories');

describe('Firm Management Tests', () => {
  let firm;

  beforeAll(async () => {
    // Create test data
    firm = await createSmallFirm();
  });

  afterAll(async () => {
    // Cleanup
    await deleteSmallFirm(firm.firm.id);
  });

  test('should have 3 members', () => {
    expect(firm.members).toHaveLength(3);
  });

  test('should have managing partner', () => {
    expect(firm.managingPartner).toBeDefined();
    expect(firm.managingPartner.membership.role).toBe('MANAGING_PARTNER');
  });
});
```

## Tips

1. **Unique Data**: All factories generate unique emails and license numbers using timestamps and random IDs
2. **Realistic Data**: Factories create realistic ratings, reviews, and project counts
3. **Relationships**: All FK relationships are properly maintained
4. **Cleanup**: Always use cleanup functions to avoid database bloat
5. **Performance**: For large datasets, factories show progress and timing information

## Troubleshooting

### "Email already exists" error
- Factories use timestamps + random IDs to ensure uniqueness
- If error persists, check for concurrent factory calls

### Slow factory execution
- Large firm creation is intentionally slow (creates many records)
- Use smaller firms for faster tests
- Consider database seeding for one-time setup

### Foreign key constraint errors
- Always delete in correct order (use provided cleanup functions)
- Ensure Prisma schema migrations are up to date

## Future Enhancements

- [ ] Client factory
- [ ] Service request factory
- [ ] Payment factory
- [ ] Review factory
- [ ] Message factory
- [ ] Availability factory
