# Cron Job Setup for Auto-Release Escrow

This guide explains how to set up the auto-release escrow cron job to automatically release payments when the auto-release period expires.

## Overview

The `auto-release-escrow.ts` script checks for payments that have passed their auto-release date and automatically releases them to the CA.

**Script Location:** `backend/src/scripts/auto-release-escrow.ts`

## Prerequisites

- Backend server must have access to the database
- `ts-node` must be installed (already included in package.json)
- Proper environment variables configured (DATABASE_URL, email settings)

## Option 1: Docker Container Cron (Recommended for Production)

### 1. Add cron package to backend container

Edit `backend/Dockerfile` to install cron:

```dockerfile
RUN apk add --no-cache dcron
```

### 2. Create crontab file

Create `backend/crontab` file:

```cron
# Auto-release escrow payments every hour
0 * * * * cd /app && npx ts-node src/scripts/auto-release-escrow.ts >> /var/log/auto-release.log 2>&1

# Or run every 30 minutes for faster processing
# */30 * * * * cd /app && npx ts-node src/scripts/auto-release-escrow.ts >> /var/log/auto-release.log 2>&1
```

### 3. Update docker-compose.yml

Add cron service or update backend service:

```yaml
services:
  backend:
    # ... existing configuration
    volumes:
      - ./backend:/app
      - ./backend/crontab:/etc/crontabs/root
    command: sh -c "crond && npm run dev"
```

## Option 2: System Cron (Development/Bare Metal)

### 1. Edit crontab

```bash
crontab -e
```

### 2. Add cron job

```cron
# Auto-release escrow payments every hour
0 * * * * cd /path/to/ca-marketplace/backend && npx ts-node src/scripts/auto-release-escrow.ts >> /var/log/auto-release.log 2>&1
```

### 3. Verify cron job

```bash
crontab -l
```

## Option 3: Manual Execution (Testing)

Run the script manually:

```bash
cd backend
npx ts-node src/scripts/auto-release-escrow.ts
```

## Option 4: Node.js Scheduler (Alternative)

Create a scheduler service within the backend application:

### Create `backend/src/services/scheduler.service.ts`

```typescript
import cron from 'node-cron';
import { autoReleaseEscrowPayments } from '../scripts/auto-release-escrow';

export class SchedulerService {
  static start() {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
      console.log('[Scheduler] Running auto-release escrow job...');
      try {
        await autoReleaseEscrowPayments();
      } catch (error) {
        console.error('[Scheduler] Auto-release job failed:', error);
      }
    });

    console.log('[Scheduler] Auto-release escrow job scheduled (every hour)');
  }
}
```

### Update `backend/src/index.ts`

```typescript
import { SchedulerService } from './services/scheduler.service';

// After server starts
SchedulerService.start();
```

### Install dependencies

```bash
npm install node-cron
npm install --save-dev @types/node-cron
```

## Recommended Schedule

| Frequency | Cron Expression | Use Case |
|-----------|-----------------|----------|
| Every hour | `0 * * * *` | Production (recommended) |
| Every 30 min | `*/30 * * * *` | High-volume platforms |
| Every 15 min | `*/15 * * * *` | Real-time requirements |
| Daily at 2 AM | `0 2 * * *` | Low-volume platforms |

## Monitoring

### View Logs

**Docker:**
```bash
docker exec -it ca_backend cat /var/log/auto-release.log
```

**System:**
```bash
tail -f /var/log/auto-release.log
```

### Check Last Run

The script outputs:
- Number of payments processed
- Number successfully released
- Number failed
- Detailed error messages

### Example Output

```
[Auto-Release Escrow] Starting auto-release job...
[Auto-Release Escrow] Current time: 2026-02-06T10:00:00.000Z
[Auto-Release Escrow] Found 3 payment(s) due for auto-release
[Auto-Release Escrow] Processing payment abc123 (Request: req456)
  - Amount: ₹50000
  - Auto-release date: 2026-02-05T10:00:00.000Z
  - Days overdue: 1
  ✓ Payment abc123 released successfully
  ✓ Email sent to CA: ca@example.com
  ✓ Email sent to Client: client@example.com
...
[Auto-Release Escrow] Job completed
  - Processed: 3
  - Released: 3
  - Failed: 0
[Auto-Release Escrow] ✓ Script finished successfully
```

## Troubleshooting

### Script not running

1. Check cron service is running: `service cron status`
2. Check crontab syntax: `crontab -l`
3. Check script permissions: `chmod +x backend/src/scripts/auto-release-escrow.ts`
4. Check logs for errors

### Database connection errors

1. Verify DATABASE_URL in environment
2. Check database is accessible from cron environment
3. Ensure Prisma client is generated: `npx prisma generate`

### Email failures

- Emails failures are logged but don't prevent payment release
- Check email service configuration (SMTP, SendGrid, etc.)
- Verify EMAIL_FROM, EMAIL_SERVICE environment variables

## Testing

### Create test payment due for release

```sql
-- Make a payment due for release (set autoReleaseAt to past date)
UPDATE "Payment"
SET "autoReleaseAt" = NOW() - INTERVAL '1 hour',
    "status" = 'ESCROW_HELD'
WHERE id = 'your-payment-id';
```

### Run script

```bash
cd backend
npx ts-node src/scripts/auto-release-escrow.ts
```

### Verify

```sql
-- Check payment was released
SELECT id, status, "escrowReleasedAt", "releasedToCA"
FROM "Payment"
WHERE id = 'your-payment-id';
```

## Best Practices

1. **Run every hour** - Balance between timely releases and server load
2. **Monitor logs** - Set up alerts for failed releases
3. **Test thoroughly** - Test with real data before production
4. **Backup database** - Before deploying to production
5. **Email notifications** - Ensure email service is reliable

## Security Notes

- Script uses Prisma transactions for data integrity
- Failed emails don't prevent payment release
- All operations are logged for audit trail
- Script exits with error code if any releases fail

---

**Status:** Ready for deployment
**Last Updated:** 2026-02-06
