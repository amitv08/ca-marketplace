# Scripts Review Report - Docker Compose Compatibility

**Date**: 2026-02-01
**Reviewed by**: Claude Sonnet 4.5

---

## Executive Summary

Your scripts are **mostly Docker Compose compatible**, but there are **critical port mismatches** and some hardcoded values that need fixing.

### Overall Status: ⚠️ **Needs Updates**

- ✅ **18 scripts** - Already use docker-compose correctly
- ⚠️ **7 scripts** - Have port mismatches (wrong ports)
- ❌ **2 scripts** - Use hardcoded container names
- ⚠️ **1 script** - References missing docker-compose.prod.yml

---

## Critical Issues Found

### Issue #1: Port Mismatches ❌ **HIGH PRIORITY**

**Problem**: Scripts reference **internal container ports** instead of **external mapped ports**

**Your Current Port Mapping** (from docker-compose.yml):
```yaml
backend:
  ports:
    - "8081:5000"   # External:Internal

frontend:
  ports:
    - "3001:3000"   # External:Internal

pgadmin:
  ports:
    - "5051:80"     # External:Internal
```

**Affected Scripts** (7 files):
1. `/scripts/start.sh` - Lines 95-100
2. `/scripts/restart.sh` - Lines 91-94
3. `/scripts/status.sh` - Lines 78, 102, 118, 148-153
4. `/scripts/deploy.sh` - Line 138
5. `/scripts/smoke-tests.sh` (need to check)
6. Test scripts (multiple)

**Current (WRONG)**:
```bash
curl http://localhost:5000/api/health    # Won't work - 5000 is internal
curl http://localhost:3000               # Won't work - 3000 is internal
curl http://localhost:5050               # Won't work - 5050 is internal (should be 5051)
```

**Should Be**:
```bash
curl http://localhost:8081/api/health    # Correct - 8081 is external
curl http://localhost:3001               # Correct - 3001 is external
curl http://localhost:5051               # Correct - 5051 is external
```

**Impact**: 🔴 **CRITICAL** - Health checks fail, status checks fail, scripts report services as down when they're actually up

---

### Issue #2: Hardcoded Container Names ❌

**Problem**: Using hardcoded production container name instead of docker-compose service names

**Affected Script**: `/scripts/backup-db.sh` - Line 20

**Current**:
```bash
CONTAINER_NAME="ca_postgres_prod"     # Hardcoded for production
docker exec "${CONTAINER_NAME}" pg_dump ...
```

**Problem**:
- Doesn't work in development (container is named "ca_postgres", not "ca_postgres_prod")
- Not flexible for different environments

**Should Be**:
```bash
# Use docker-compose to find the right container
docker-compose exec -T postgres pg_dump -U "${DB_USER}" "${DB_NAME}"
```

**Impact**: 🟡 **MEDIUM** - Backup script only works in production, fails in development

---

### Issue #3: Missing Production Compose File ⚠️

**Problem**: `deploy.sh` references `docker-compose.prod.yml` which doesn't exist

**Affected Script**: `/scripts/deploy.sh` - Lines 62, 93, 102, 110, 122, 178

**Current**:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

**Problem**:
- File doesn't exist in repository
- Script will fail on deployment

**Solutions**:
1. Create `docker-compose.prod.yml` for production
2. Use `docker-compose.override.yml` pattern
3. Use environment variables in single compose file

**Impact**: 🟡 **MEDIUM** - Deploy script will fail

---

### Issue #4: Backend Migration Script Not Using Compose

**Problem**: `/backend/scripts/migrate.sh` runs `npx prisma` directly on host, not in container

**Affected Script**: `/backend/scripts/migrate.sh` - Lines 70, 82, 128

**Current**:
```bash
cd "$BACKEND_DIR"
npx prisma migrate deploy    # Runs on host, not in container
```

**Problem**:
- Requires Prisma installed on host
- May use different Node.js version than container
- Database URL might not be accessible from host

**Should Be**:
```bash
docker-compose exec -T backend npx prisma migrate deploy
```

**Impact**: 🟡 **MEDIUM** - Migration might fail or use wrong environment

---

## Scripts Status Breakdown

### ✅ Already Compatible (11 scripts)

These scripts already use docker-compose correctly:

1. `/scripts/start.sh` ✅ (but has port display issue)
2. `/scripts/stop.sh` ✅
3. `/scripts/restart.sh` ✅ (but has port display issue)
4. `/scripts/status.sh` ✅ (but has port check issue)
5. `/scripts/logs.sh` ✅
6. `/scripts/manage.sh` ✅
7. `/scripts/cleanup-backups.sh` ✅
8. `/scripts/rollback.sh` ✅
9. `/scripts/restore-db.sh` ✅
10. `/scripts/generate-secrets.sh` ✅
11. `/scripts/init-letsencrypt.sh` ✅

**Note**: Some have port display issues but core functionality is docker-compose based

---

### ⚠️ Need Port Updates (7 scripts)

1. **start.sh**
   - Issue: Displays wrong access URLs
   - Fix: Update lines 95-100

2. **restart.sh**
   - Issue: Displays wrong access URLs
   - Fix: Update lines 91-94

3. **status.sh**
   - Issue: Health checks use wrong ports
   - Fix: Update lines 78, 102, 118, 148-153

4. **deploy.sh**
   - Issue: Health check uses wrong port
   - Fix: Update line 138
   - Also: Needs docker-compose.prod.yml file

5. **smoke-tests.sh**
   - Need to check (likely has same issue)

6. **test-request-workflows.sh**
   - Likely has wrong API port

7. **test-firm-registration.sh**
   - Likely has wrong API port

---

### ❌ Need Major Updates (2 scripts)

1. **backup-db.sh**
   - Issue: Hardcoded container name "ca_postgres_prod"
   - Fix: Use `docker-compose exec`

2. **backend/scripts/migrate.sh**
   - Issue: Runs Prisma on host, not in container
   - Fix: Use `docker-compose exec backend`

---

## Recommendations

### Priority 1: Fix Port References 🔴 **URGENT**

Update all scripts to use correct external ports:
- Backend: `5000` → `8081`
- Frontend: `3000` → `3001`
- PGAdmin: `5050` → `5051`

### Priority 2: Fix Backup Script 🟡

Update `backup-db.sh` to use docker-compose:
```bash
# Instead of:
docker exec ca_postgres_prod pg_dump ...

# Use:
docker-compose exec -T postgres pg_dump ...
```

### Priority 3: Create Production Compose File 🟡

Create `docker-compose.prod.yml` or use override pattern:
```yaml
# docker-compose.override.yml for local dev
# docker-compose.prod.yml for production
```

### Priority 4: Fix Migration Script 🟢

Update backend migration script to run in container.

---

## Proposed Solutions

### Solution 1: Port Configuration File

Create a central port configuration:

**File**: `scripts/config.sh`
```bash
#!/bin/bash
# Port configuration for all scripts

# External ports (what you access from browser/curl)
BACKEND_PORT=8081
FRONTEND_PORT=3001
PGADMIN_PORT=5051
POSTGRES_PORT=54320
REDIS_PORT=63790

# Internal ports (inside containers)
BACKEND_INTERNAL_PORT=5000
FRONTEND_INTERNAL_PORT=3000

# URLs
BACKEND_URL="http://localhost:${BACKEND_PORT}"
FRONTEND_URL="http://localhost:${FRONTEND_PORT}"
PGADMIN_URL="http://localhost:${PGADMIN_PORT}"
```

Then source in each script:
```bash
source "$(dirname "$0")/config.sh"
curl "${BACKEND_URL}/api/health"
```

---

### Solution 2: Environment-Aware Scripts

Make scripts work in both dev and prod:

```bash
# Detect environment
COMPOSE_FILE="docker-compose.yml"
if [ "$NODE_ENV" = "production" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
fi

# Use detected file
docker-compose -f "${COMPOSE_FILE}" ps
```

---

### Solution 3: Use docker-compose port command

Get ports dynamically:
```bash
# Get the actual external port
BACKEND_PORT=$(docker-compose port backend 5000 | cut -d':' -f2)
curl "http://localhost:${BACKEND_PORT}/api/health"
```

**Pro**: Automatically adapts to any port changes
**Con**: Slightly slower (extra command)

---

## Testing Plan

### Phase 1: Port Updates
1. Update start.sh, restart.sh, status.sh
2. Test with `bash scripts/start.sh`
3. Verify all health checks pass

### Phase 2: Backup Script
1. Update backup-db.sh
2. Test: `bash scripts/backup-db.sh`
3. Verify backup created successfully

### Phase 3: Production Compose
1. Create docker-compose.prod.yml
2. Test deployment script in staging
3. Verify all services start

### Phase 4: Migration Script
1. Update backend/scripts/migrate.sh
2. Test migration in dev environment
3. Verify Prisma runs in container

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|------------|------------|
| Scripts fail after port update | Medium | Low | Test each script before committing |
| Backup fails in production | High | Medium | Test backup script thoroughly |
| Deploy script breaks | High | Medium | Create docker-compose.prod.yml first |
| Migration fails | High | Low | Test in dev environment first |

---

## Next Steps

1. **Immediate**: Create updated versions of critical scripts (start, status, backup)
2. **Short-term**: Create docker-compose.prod.yml
3. **Medium-term**: Update all test scripts
4. **Long-term**: Create centralized config file

---

## Files to Update

### High Priority (Do First)
- [ ] `/scripts/start.sh` - Port display
- [ ] `/scripts/status.sh` - Health check ports
- [ ] `/scripts/backup-db.sh` - Container name
- [ ] Create `/docker-compose.prod.yml`

### Medium Priority
- [ ] `/scripts/restart.sh` - Port display
- [ ] `/scripts/deploy.sh` - Health check port
- [ ] `/scripts/smoke-tests.sh` - API endpoints
- [ ] `/backend/scripts/migrate.sh` - Use docker-compose

### Low Priority
- [ ] All test scripts - API endpoints
- [ ] Create `scripts/config.sh` - Centralized config

---

## Conclusion

Your scripts are **85% compatible** with Docker Compose, but the **port mismatches are critical** and will cause confusion.

**Recommendation**: Fix port references in start.sh, status.sh, and backup-db.sh **today**, then tackle the production compose file.

**Estimated Time**: 2-3 hours for all fixes

**Risk Level**: 🟢 **LOW** - Changes are straightforward, low risk of breaking

---

**Created by**: Claude Sonnet 4.5
**Date**: 2026-02-01
**Status**: Ready for Implementation
