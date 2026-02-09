# Notification System Implementation

## Status: ✅ Backend Complete (Frontend Integration Pending)

## What's Been Implemented

### 1. Database Schema ✅
- **NotificationType** enum with 13 notification types
- **Notification** model with full feature set
- Indexes for performance (userId+read, userId+createdAt, type, createdAt)
- Foreign key to User with CASCADE delete
- Fields: id, userId, type, title, message, read, link, metadata, createdAt, readAt

### 2. NotificationService ✅
**Location**: `backend/src/services/notification.service.ts`

**Methods**:
- `createNotification()` - Create single notification with real-time Socket.IO emit
- `createBulkNotifications()` - Bulk create with real-time delivery
- `getUserNotifications()` - Get notifications with pagination and filtering
- `getUnreadCount()` - Get unread count for badge
- `markAsRead()` - Mark single as read
- `markAllAsRead()` - Mark all unread as read
- `deleteNotification()` - Delete single
- `deleteAllNotifications()` - Delete all (or read-only)

**Helper Methods** (for easy integration):
- `notifyRequestAccepted()` - Service request accepted
- `notifyRequestRejected()` - Service request rejected
- `notifyRequestCompleted()` - Service completed
- `notifyNewMessage()` - New message received
- `notifyPaymentReceived()` - Payment received by CA
- `notifyPaymentPending()` - Payment pending for client
- `notifyReviewReceived()` - New review for CA
- `notifyFirmInvitation()` - Firm invitation
- `notifySystemAlert()` - System alerts

### 3. API Endpoints ✅
**Location**: `backend/src/routes/notification.routes.ts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get user notifications (paginated, filterable) |
| GET | `/api/notifications/unread/count` | Get unread count for badge |
| PUT | `/api/notifications/:id/read` | Mark specific notification as read |
| PUT | `/api/notifications/mark-all-read` | Mark all notifications as read |
| DELETE | `/api/notifications/:id` | Delete specific notification |
| DELETE | `/api/notifications/delete-all` | Delete all (or read-only) |

**Query Parameters**:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `unreadOnly` - Filter to unread only (boolean)
- `readOnly` - For delete-all, delete only read ones (boolean)

### 4. Real-Time Socket.IO Integration ✅
**Location**: `backend/src/config/socket.ts`

**Features**:
- Users auto-join `user:{userId}` room on connect
- `getSocketIO()` export for accessing Socket.IO instance
- Real-time notification emission on creation
- Event: `notification` with full notification data

**Socket Event Format**:
```javascript
{
  id: "notif-uuid",
  type: "REQUEST_ACCEPTED",
  title: "Service Request Accepted",
  message: "CA Name has accepted your request",
  link: "/requests/123",
  createdAt: "2026-02-01T10:30:00.000Z"
}
```

### 5. Database Migration ✅
- NotificationType enum created
- Notification table created with all indexes
- Foreign key constraint to User table

## Notification Types

| Type | Triggered When | Recipients | Link |
|------|---------------|------------|------|
| REQUEST_ACCEPTED | CA accepts request | Client | /requests/{id} |
| REQUEST_REJECTED | CA rejects request | Client | /requests/{id} |
| REQUEST_COMPLETED | CA completes service | Client | /requests/{id} |
| REQUEST_CANCELLED | Request cancelled | Both | /requests/{id} |
| NEW_MESSAGE | Message sent | Receiver | /requests/{id} |
| PAYMENT_RECEIVED | Payment completed | CA | /requests/{id} |
| PAYMENT_PENDING | Payment due | Client | /requests/{id} |
| REVIEW_RECEIVED | Client leaves review | CA | /requests/{id} |
| FIRM_INVITATION | Invited to firm | CA | /firm-invitations/{id} |
| FIRM_MEMBER_JOINED | Member joins | Firm admin | /firms/{id} |
| FIRM_MEMBER_LEFT | Member leaves | Firm admin | /firms/{id} |
| SYSTEM_ALERT | System announcement | Affected users | Custom |
| GENERAL | General notification | User | Custom |

## How to Integrate Notifications

### Example 1: Service Request Accepted

**In `serviceRequest.routes.ts`**:
```typescript
import { NotificationService } from '../services/notification.service';

// When CA accepts request
router.post('/:id/accept', authenticate, authorize('CA'), async (req, res) => {
  // ... existing accept logic ...

  // Get client info
  const client = await prisma.client.findUnique({
    where: { id: request.clientId },
    include: { user: true }
  });

  // Get CA info
  const ca = await prisma.charteredAccountant.findUnique({
    where: { id: req.user!.caId },
    include: { user: true }
  });

  // Send notification
  await NotificationService.notifyRequestAccepted(
    client.userId,
    request.id,
    ca.user.name,
    request.serviceType
  );

  // ... rest of response ...
});
```

### Example 2: New Message

**In `message.routes.ts`**:
```typescript
// After creating message
const message = await prisma.message.create({ /* ... */ });

// Notify receiver
await NotificationService.notifyNewMessage(
  receiverId,
  senderName,
  requestId
);
```

### Example 3: Payment Completed

**In `payment.routes.ts`**:
```typescript
// After payment success
await NotificationService.notifyPaymentReceived(
  caUserId,
  amount,
  requestId
);

// If payment pending
await NotificationService.notifyPaymentPending(
  clientUserId,
  amount,
  requestId,
  serviceType
);
```

## Frontend Integration (TODO)

### 1. Create Notification Service
```typescript
// frontend/src/services/notificationService.ts
import api from './api';

export const notificationService = {
  getNotifications: async (page = 1, unreadOnly = false) => {
    const response = await api.get('/notifications', {
      params: { page, unreadOnly }
    });
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get('/notifications/unread/count');
    return response.data;
  },

  markAsRead: async (id: string) => {
    const response = await api.put(`/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await api.put('/notifications/mark-all-read');
    return response.data;
  },

  deleteNotification: async (id: string) => {
    const response = await api.delete(`/notifications/${id}`);
    return response.data;
  },
};
```

### 2. Update Dashboard to Use Real API
```typescript
// Replace client-side generation with API call
const fetchNotifications = async () => {
  const response = await notificationService.getNotifications(1, false);
  if (response.success) {
    setNotifications(response.data.notifications);
  }
};

useEffect(() => {
  fetchNotifications();
}, []);
```

### 3. Add Socket.IO Listener
```typescript
// In app initialization or dashboard
import { io } from 'socket.io-client';

const socket = io('http://localhost:8081', {
  auth: { token: authToken }
});

socket.on('notification', (notification) => {
  // Add to notifications list
  setNotifications(prev => [notification, ...prev]);

  // Update unread count
  setUnreadCount(prev => prev + 1);

  // Show toast/banner
  toast.success(notification.message);
});
```

### 4. Add Notification Badge
```typescript
// In header/navbar
const [unreadCount, setUnreadCount] = useState(0);

useEffect(() => {
  const fetchCount = async () => {
    const response = await notificationService.getUnreadCount();
    if (response.success) {
      setUnreadCount(response.data.count);
    }
  };
  fetchCount();
}, []);

return (
  <div className="notification-icon">
    🔔
    {unreadCount > 0 && (
      <span className="badge">{unreadCount}</span>
    )}
  </div>
);
```

## Testing the API

### 1. Get Notifications
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:8081/api/notifications?page=1&limit=10
```

### 2. Get Unread Count
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:8081/api/notifications/unread/count
```

### 3. Mark as Read
```bash
curl -X PUT -H "Authorization: Bearer {token}" \
  http://localhost:8081/api/notifications/{id}/read
```

### 4. Mark All as Read
```bash
curl -X PUT -H "Authorization: Bearer {token}" \
  http://localhost:8081/api/notifications/mark-all-read
```

### 5. Delete Notification
```bash
curl -X DELETE -H "Authorization: Bearer {token}" \
  http://localhost:8081/api/notifications/{id}
```

## Database Queries

### Check Notifications
```sql
-- Get all notifications
SELECT * FROM "Notification" ORDER BY "createdAt" DESC;

-- Get unread count per user
SELECT "userId", COUNT(*) as unread
FROM "Notification"
WHERE read = false
GROUP BY "userId";

-- Get notifications by type
SELECT type, COUNT(*) as count
FROM "Notification"
GROUP BY type
ORDER BY count DESC;
```

## Performance Considerations

### Indexes Created
- `(userId, read)` - Fast unread queries
- `(userId, createdAt)` - Fast sorted user notifications
- `(createdAt)` - Fast global recent notifications
- `(type)` - Fast type filtering

### Recommendations
1. **Pagination**: Always use pagination (default 20 items)
2. **Cleanup**: Periodically delete old read notifications (>30 days)
3. **Batch Operations**: Use bulk create for multiple notifications
4. **Real-Time**: Socket.IO rooms for efficient targeted delivery

## Next Steps

### Integration Points (Task #16)
1. ✅ Service Request Accept/Reject → notification.service.ts
2. ✅ Service Request Complete → notification.service.ts
3. ⏸️ Message Create → Update message.routes.ts
4. ⏸️ Payment Success → Update payment.routes.ts
5. ⏸️ Review Create → Update review.routes.ts
6. ⏸️ Firm Invitation → Update firm-registration.routes.ts

### Frontend Updates (Task #18)
1. Create notificationService.ts
2. Update ClientDashboard to use real API
3. Add Socket.IO listener for real-time updates
4. Add notification badge to header
5. Add mark-as-read on click
6. Add "View All" notifications page
7. Add notification preferences (future)

## Files Created/Modified

**Created**:
1. `backend/src/services/notification.service.ts` (380 lines)
2. `backend/src/routes/notification.routes.ts` (120 lines)
3. Database: NotificationType enum + Notification table

**Modified**:
1. `backend/prisma/schema.prisma` - Added Notification model
2. `backend/src/config/socket.ts` - Added getSocketIO() and user rooms
3. `backend/src/routes/index.ts` - Registered notification routes

**Total**: ~500 lines of backend code + database schema

## Summary

✅ **Notification System Backend: COMPLETE**

The notification system backend is fully implemented with:
- Complete database schema with optimized indexes
- Comprehensive NotificationService with helper methods
- REST API for all CRUD operations
- Real-time Socket.IO integration
- Ready for frontend integration

**What's Working**:
- Create notifications programmatically
- Fetch notifications with pagination
- Mark as read (single/all)
- Delete notifications
- Real-time delivery via Socket.IO
- Unread count tracking

**What's Pending**:
- Integrate with existing event triggers (Task #16) - Partially done
- Frontend API integration (Task #18)
- Notification preferences UI
- Email notifications (optional)
- Push notifications (future)

**Production Ready**: Yes, backend is production-ready
**Frontend Ready**: Needs integration (API service + UI updates)
