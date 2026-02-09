# Role-Based Help System Implementation

## Overview
Updated the Help page to show only relevant content based on user's role.

## What Changed

### For Non-Authenticated Users (GUEST)
**Visible Sections:**
- ✅ Getting Started
- ✅ FAQs (General only)
- ✅ Support

**What They See:**
- How to create an account
- General platform information
- Contact support

---

### For Clients (CLIENT)
**Visible Sections:**
- ✅ Getting Started
- ✅ Client Guide (Finding CAs, Creating Requests, Payments, Reviews)
- ✅ Payment & Billing
- ✅ FAQs (General + Client-specific)
- ✅ Support

**What They See:**
- How to find and select CAs
- Creating and managing service requests
- Payment process and security
- Client-specific FAQs
- Support information

---

### For CAs (CA)
**Visible Sections:**
- ✅ Getting Started
- ✅ CA Guide (Profile, Requests, Earnings, Verification)
- ✅ CA Firm Guide (Registration, Team Management, Invitations)
- ✅ Payment & Billing
- ✅ FAQs (General + CA-specific + Firm-specific)
- ✅ Support

**What They See:**
- CA profile setup and management
- Managing service requests
- Earnings and withdrawal process
- Firm registration and management
- Independent work policies
- CA and Firm FAQs
- Support information

---

### For Admins (ADMIN, SUPER_ADMIN)
**Visible Sections:**
- ✅ Getting Started
- ✅ FAQs (General only)
- ✅ Support

**What They See:**
- General platform information
- Support contact (for user issues)

---

## Implementation Details

### 1. Role Detection
```typescript
const { user } = useAppSelector((state) => state.auth);
const userRole = user?.role || 'GUEST';
```

### 2. Section Filtering
Each section now has a `roles` array:
```typescript
{
  id: 'for-clients',
  title: 'Client Guide',
  icon: UserCircleIcon,
  content: 'for-clients',
  roles: ['CLIENT'], // Only visible to clients
}
```

Sections are filtered based on role:
```typescript
const sections = useMemo(() => {
  return allSections.filter(section => section.roles.includes(userRole));
}, [userRole]);
```

### 3. FAQ Filtering
FAQs are also filtered by role:
```typescript
{
  category: 'For Clients',
  roles: ['CLIENT'],
  questions: [...]
}
```

### 4. Personalized Header
Dynamic header based on role:
- **Client**: "Client Help Center"
- **CA**: "CA Help Center"
- **Admin**: "Admin Help Center"
- **Guest**: "Help & Support"

### 5. Default Active Section
Automatically sets relevant section:
- Clients → "Client Guide"
- CAs → "CA Guide"
- Others → First available section

---

## User Experience Improvements

### Before (Generic for Everyone)
❌ Clients saw irrelevant CA and Firm sections
❌ CAs saw irrelevant Client sections
❌ Cluttered navigation with 7 sections for everyone
❌ Generic "Help & Support" header

### After (Role-Based)
✅ Clients see only Client-relevant content (4-5 sections)
✅ CAs see only CA-relevant content (6 sections)
✅ Clean, focused navigation
✅ Personalized welcome message
✅ Role-specific header

---

## Section Visibility Matrix

| Section | GUEST | CLIENT | CA | ADMIN |
|---------|-------|--------|-------|-------|
| Getting Started | ✅ | ✅ | ✅ | ✅ |
| Client Guide | ❌ | ✅ | ❌ | ❌ |
| CA Guide | ❌ | ❌ | ✅ | ❌ |
| CA Firm Guide | ❌ | ❌ | ✅ | ❌ |
| Payment & Billing | ❌ | ✅ | ✅ | ❌ |
| FAQs | ✅ (General) | ✅ (General + Client) | ✅ (General + CA + Firm) | ✅ (General) |
| Support | ✅ | ✅ | ✅ | ✅ |

---

## FAQ Visibility

| FAQ Category | GUEST | CLIENT | CA | ADMIN |
|--------------|-------|--------|-------|-------|
| General (3 questions) | ✅ | ✅ | ✅ | ✅ |
| For Clients (4 questions) | ❌ | ✅ | ❌ | ❌ |
| For CAs (4 questions) | ❌ | ❌ | ✅ | ❌ |
| For Firms (3 questions) | ❌ | ❌ | ✅ | ❌ |

---

## Example Scenarios

### Scenario 1: New Client Logs In
1. Navigates to `/help`
2. Sees "Client Help Center" header with personalized welcome
3. Sidebar shows: Getting Started, Client Guide, Payment & Billing, FAQs, Support
4. Default section: "Client Guide"
5. FAQs show: General + Client-specific questions

### Scenario 2: CA Logs In
1. Navigates to `/help`
2. Sees "CA Help Center" header with personalized welcome
3. Sidebar shows: Getting Started, CA Guide, CA Firm Guide, Payment & Billing, FAQs, Support
4. Default section: "CA Guide"
5. FAQs show: General + CA-specific + Firm-specific questions

### Scenario 3: Not Logged In
1. Navigates to `/help`
2. Sees generic "Help & Support" header
3. Sidebar shows: Getting Started, FAQs, Support
4. Default section: "Getting Started"
5. FAQs show: General questions only

---

## Benefits

### For Users
✅ **Focused Content**: See only what's relevant to their role
✅ **Less Clutter**: Fewer sections to navigate
✅ **Faster Navigation**: Find help quickly
✅ **Personalized Experience**: Feels tailored to their needs
✅ **No Confusion**: Don't see options they can't use

### For Platform
✅ **Better UX**: Improved user satisfaction
✅ **Reduced Support**: Users find answers faster
✅ **Professional**: Shows attention to detail
✅ **Scalable**: Easy to add role-specific content

---

## Files Modified

1. `/frontend/src/pages/help/HelpPage.tsx`
   - Added role detection with Redux
   - Added role filtering for sections
   - Added role filtering for FAQs
   - Added personalized headers
   - Added default section logic

---

## Testing Checklist

- [ ] Test as non-authenticated user (GUEST)
- [ ] Test as CLIENT
- [ ] Test as CA
- [ ] Test as ADMIN
- [ ] Verify section visibility matches matrix
- [ ] Verify FAQ visibility matches matrix
- [ ] Verify personalized headers
- [ ] Verify default active sections
- [ ] Test navigation between sections
- [ ] Verify mobile responsiveness

---

**Status**: ✅ Complete
**Date**: January 25, 2026
**Version**: 2.0.0
