# Quick Validation Guide

## ✅ System Status Check

### Current Running Services:
```bash
# Check what's running
docker-compose ps

# Expected output:
ca_backend    Up      0.0.0.0:8081->5000/tcp
ca_postgres   Up      0.0.0.0:54320->5432/tcp
ca_redis      Up      0.0.0.0:63790->6379/tcp
```

### Database Schema Validation

**Note:** There's a Prisma CLI version mismatch (v7.3.0 installed vs v6.x schema format).

**Option 1: Use Docker (Recommended)**
```bash
# Run Prisma commands inside the backend container
docker-compose exec backend npx prisma db push
docker-compose exec backend npx prisma generate
```

**Option 2: Downgrade Prisma CLI (If needed)**
```bash
cd backend
npm install -g prisma@6
npx prisma db push
npx prisma generate
```

**Option 3: Skip CLI validation (App still works)**
- The running backend uses compiled code with correct Prisma client
- Schema is already in database
- No action needed unless you modify schema.prisma

---

## 🧪 Feature Validation Commands

### 1. Platform Settings

**Test Endpoint:**
```bash
# Without auth (should return 401)
curl -X GET http://localhost:8081/api/admin/platform-settings

# With admin token
curl -X GET http://localhost:8081/api/admin/platform-settings \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Check Database:**
```bash
docker-compose exec postgres psql -U caadmin -d camarketplace \
  -c "SELECT * FROM platform_config;"
```

**Expected:** Platform config record with default values

---

### 2. Email Notifications

**Check Templates:**
```bash
ls -la backend/src/templates/emails/

# Should show:
# - request-accepted.hbs
# - payment-required.hbs
# - new-message.hbs
# - verification-approved.hbs
# + 5 more
```

**Check SMTP Config:**
```bash
docker-compose exec backend sh -c 'echo $SMTP_HOST'

# If empty: Emails will be logged only (dev mode)
# If set: Emails will be sent via SMTP
```

**View Email Logs:**
```bash
docker-compose logs backend | grep -i "email"

# Should show:
# [INFO] Email would be sent (dev mode) ...
# OR
# [INFO] Email sent successfully ...
```

---

### 3. Disputes System

**Test Endpoint:**
```bash
# Create dispute (requires client token)
curl -X POST http://localhost:8081/api/disputes \
  -H "Authorization: Bearer YOUR_CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req_123",
    "reason": "SERVICE_NOT_DELIVERED",
    "amount": 5000
  }'

# Expected: 201 Created (if request exists) or 404 (if not)
```

**Check Database:**
```bash
docker-compose exec postgres psql -U caadmin -d camarketplace \
  -c "SELECT id, status, reason FROM disputes LIMIT 5;"
```

---

### 4. Escrow System

**Check Schema:**
```bash
docker-compose exec postgres psql -U caadmin -d camarketplace \
  -c "\d ServiceRequest" | grep escrow

# Should show:
# escrowStatus | EscrowStatus
# escrowAmount | double precision
# escrowPaidAt | timestamp
```

**Check Enum:**
```bash
docker-compose exec postgres psql -U caadmin -d camarketplace \
  -c "\dT+ EscrowStatus"

# Should show: NOT_REQUIRED, PENDING_PAYMENT, ESCROW_HELD, etc.
```

---

## 🔍 Common Issues & Fixes

### Issue: "Cannot connect to database"
```bash
# Restart PostgreSQL
docker-compose restart postgres

# Check if it's healthy
docker-compose ps postgres
```

### Issue: "Backend not responding"
```bash
# Check backend logs
docker-compose logs backend --tail=50

# Restart backend
docker-compose restart backend
```

### Issue: "Prisma CLI errors"
```bash
# Use Docker instead
docker-compose exec backend npx prisma db push
docker-compose exec backend npx prisma generate

# OR downgrade Prisma globally
npm install -g prisma@6.19.1
```

### Issue: "Frontend not running"
```bash
# If frontend is not in docker-compose, start it manually
cd frontend
npm install
npm start

# OR add to docker-compose and run
docker-compose up -d frontend
```

---

## 📊 Health Check Summary

### ✅ What's Working:
1. **Backend API:** Running on port 8081
2. **Database:** PostgreSQL healthy on port 54320
3. **Redis:** Running on port 63790
4. **Platform Settings:** Schema + Service + API + UI complete
5. **Email System:** Templates + Services + Integration complete
6. **Disputes:** Schema + API + UI complete
7. **Escrow:** Schema + Services complete

### ⚠️ Known Issues:
1. **Prisma CLI Version:** v7.3.0 installed but schema is v6.x format
   - **Impact:** CLI commands fail
   - **Fix:** Use Docker exec or downgrade CLI
   - **Status:** App still works (uses compiled code)

2. **Frontend Service:** Not running in docker-compose
   - **Impact:** Need to run manually or add to compose
   - **Fix:** See docker-compose.yml
   - **Status:** Can run standalone

---

## 🚀 Quick Start After Validation

### If Everything Passes:
```bash
# You're good to go!
# Access the app:
# - Backend API: http://localhost:8081/api
# - Frontend: http://localhost:3001 (if running)
# - PGAdmin: http://localhost:5051 (if running)
```

### If Schema Validation Fails:
```bash
# Use Docker to sync schema
docker-compose exec backend npx prisma db push
docker-compose exec backend npx prisma generate
docker-compose restart backend
```

### If Services Are Down:
```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f backend
```

---

## 📝 Testing Workflows

### Test Client Flow:
```bash
# If test script exists
./test-client-flows.sh

# Manual test:
# 1. Register client
# 2. Create service request
# 3. CA accepts request
# 4. Complete & pay
# 5. Leave review
```

### Test Platform Settings:
```bash
./test-platform-settings.sh

# OR manual:
# 1. Login as ADMIN
# 2. Go to /admin/platform-settings
# 3. Change fee from 10% to 12%
# 4. See live preview update
# 5. Click Save
```

### Test Email System:
```bash
./test-email-system.sh

# OR check logs:
docker-compose logs backend | grep "email"
```

---

## 🎯 Production Readiness

### Before Deploying:

1. **Fix Prisma Version:**
   ```bash
   cd backend
   npm install prisma@6.19.1 --save-dev
   npm install @prisma/client@6.19.1
   ```

2. **Configure SMTP:**
   ```bash
   # Add to backend/.env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   ```

3. **Set Production Environment:**
   ```bash
   NODE_ENV=production
   DATABASE_URL=your-production-db-url
   JWT_SECRET=generate-a-secure-secret
   ```

4. **Run Migrations:**
   ```bash
   npx prisma migrate deploy
   ```

5. **Build Frontend:**
   ```bash
   cd frontend
   npm run build
   ```

---

## 📞 Support

If you encounter issues:

1. **Check Logs:**
   ```bash
   docker-compose logs backend --tail=100
   docker-compose logs postgres --tail=50
   ```

2. **Database Issues:**
   ```bash
   docker-compose exec postgres psql -U caadmin -d camarketplace
   ```

3. **Reset Everything:**
   ```bash
   docker-compose down -v
   docker-compose up -d
   cd backend && npx prisma db push
   ```

---

## ✅ Validation Checklist

- [ ] Docker services running (backend, postgres, redis)
- [ ] Database schema in sync
- [ ] Platform config table exists
- [ ] Email templates exist (9 files)
- [ ] Disputes table exists
- [ ] Escrow fields in ServiceRequest
- [ ] API endpoints responding (401/200)
- [ ] No critical errors in logs
- [ ] Frontend accessible (if running)
- [ ] SMTP configured (optional, for production)

**Status:** 🎉 All critical systems operational!
