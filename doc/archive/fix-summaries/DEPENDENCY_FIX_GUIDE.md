# Dependency Security Fix Guide

**Issue**: CI/CD dependency-check failing due to security vulnerabilities
**Status**: ⚠️ Action Required
**Priority**: HIGH

---

## Security Vulnerabilities Identified

### Backend (2 vulnerabilities)
1. **lodash 4.0.0-4.17.21** (MODERATE)
   - Issue: Prototype Pollution in _.unset and _.omit
   - CVE: GHSA-xxjr-mmjv-4gpg
   - CVSS Score: 6.5

2. **diff <4.0.4** (LOW)
   - Issue: Denial of Service in parsePatch/applyPatch
   - CVE: GHSA-73rr-hh4g-fpgx

### Frontend (4 vulnerabilities)
1. **lodash 4.0.0-4.17.21** (MODERATE) - Same as backend

2. **webpack-dev-server <=5.2.0** (MODERATE)
   - Issue: Source code theft vulnerability
   - CVE: GHSA-9jgg-88mc-972h, GHSA-4v9v-hfq4-rm2v
   - **Note**: Development dependency only, not in production build

---

## Fix Options

### Option 1: Docker Environment Fix (RECOMMENDED)

Since you're using Docker, fix dependencies inside the containers:

#### Backend Fix:
```bash
# Enter backend container
docker exec -it ca_backend sh

# Inside container, run:
npm audit fix
npm install lodash@latest --save-exact
npm install diff@latest --save-exact

# Exit container
exit

# Copy updated package-lock.json from container to host
docker cp ca_backend:/app/package-lock.json backend/package-lock.json
```

#### Frontend Fix:
```bash
# Enter frontend container
docker exec -it ca_frontend sh

# Inside container, run:
npm audit fix
npm install lodash@latest --save-exact

# Exit container
exit

# Copy updated package-lock.json from container to host
docker cp ca_frontend:/app/package-lock.json frontend/package-lock.json
```

#### Commit Changes:
```bash
git add backend/package-lock.json frontend/package-lock.json
git commit -m "fix: resolve security vulnerabilities in dependencies

- Update lodash to 4.17.22+ (fixes prototype pollution)
- Update diff to 4.0.4+ (fixes DoS vulnerability)
- Fixes CI/CD dependency-check errors"
git push
```

---

### Option 2: Manual Package.json Update (ALTERNATIVE)

If Docker containers aren't running, manually update package.json:

#### Backend (backend/package.json):
```json
{
  "dependencies": {
    "lodash": "^4.17.22",
    "diff": "^5.0.0"
  }
}
```

Then run:
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

#### Frontend (frontend/package.json):
```json
{
  "dependencies": {
    "lodash": "^4.17.22"
  }
}
```

Then run:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

### Option 3: Override Resolutions (NPM 8.3+)

Add to package.json to force specific versions:

#### Backend (backend/package.json):
```json
{
  "overrides": {
    "lodash": "^4.17.22",
    "diff": "^5.0.0"
  }
}
```

#### Frontend (frontend/package.json):
```json
{
  "overrides": {
    "lodash": "^4.17.22"
  }
}
```

---

## Webpack-dev-server Issue

**Status**: ⚠️ Development-only vulnerability
**Risk**: LOW (not in production)
**Action**: Can be deferred

The webpack-dev-server vulnerability only affects development environment. Options:

### Option A: Accept Risk (RECOMMENDED)
- Vulnerability: Only affects dev server
- Production Impact: NONE (not included in production build)
- Action: Add to .npmauditrc to suppress warning:

```json
{
  "exceptions": [
    "https://github.com/advisories/GHSA-9jgg-88mc-972h",
    "https://github.com/advisories/GHSA-4v9v-hfq4-rm2v"
  ]
}
```

### Option B: Upgrade react-scripts
**Warning**: This may cause breaking changes

```bash
cd frontend
npm install react-scripts@latest
```

May require updating React and other dependencies.

---

## Verification Steps

### 1. Run Audit After Fix:
```bash
# Backend
cd backend
npm audit

# Expected output: "found 0 vulnerabilities"

# Frontend
cd frontend
npm audit --production

# Expected output: "0 vulnerabilities" (production only)
```

### 2. Test Application:
```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

### 3. Build Verification:
```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

### 4. CI/CD Check:
Push changes and verify GitHub Actions passes:
```bash
git push
# Check: https://github.com/your-repo/actions
```

---

## Quick Fix Script (WSL-Compatible)

If you want to run fixes directly in WSL without Docker:

```bash
#!/bin/bash
# Run this inside WSL (not Windows terminal)

echo "Fixing backend dependencies..."
cd /home/amit/ca-marketplace/backend
npm audit fix
npm install lodash@latest --save-exact
npm install diff@latest --save-exact

echo "Fixing frontend dependencies..."
cd /home/amit/ca-marketplace/frontend
npm audit fix
npm install lodash@latest --save-exact

echo "Done! Verify with: npm audit"
```

Save as `fix-deps-wsl.sh` and run:
```bash
chmod +x fix-deps-wsl.sh
./fix-deps-wsl.sh
```

---

## Expected Results After Fix

### Backend npm audit:
```
found 0 vulnerabilities
```

### Frontend npm audit (production):
```
found 0 vulnerabilities
```

### Frontend npm audit (dev):
```
found 3 vulnerabilities (webpack-dev-server - dev only)
```

### CI/CD Status:
✅ dependency-check PASS

---

## Troubleshooting

### Issue: "EPERM: operation not permitted"
**Cause**: Running Windows npm on WSL files
**Solution**: Use Option 1 (Docker) or run npm inside WSL terminal

### Issue: "package-lock.json merge conflicts"
**Solution**:
```bash
# Delete and regenerate
rm package-lock.json
npm install
```

### Issue: "Tests failing after update"
**Cause**: Breaking changes in dependencies
**Solution**:
```bash
# Restore backup
git checkout package-lock.json
npm install

# Update one package at a time
npm install lodash@latest --save-exact
npm test
```

### Issue: "Module not found after fix"
**Solution**:
```bash
# Clear caches and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

---

## Prevention

### Add to CI/CD (.github/workflows/):

```yaml
name: Security Audit

on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Audit Backend
        run: |
          cd backend
          npm audit --production

      - name: Audit Frontend
        run: |
          cd frontend
          npm audit --production --audit-level=high
```

### Add to package.json scripts:

```json
{
  "scripts": {
    "audit": "npm audit --production",
    "audit:fix": "npm audit fix"
  }
}
```

---

## Recommendation

**Best Approach**: Use **Option 1 (Docker)** if containers are running, otherwise use **Quick Fix Script (WSL)**.

**Steps**:
1. ✅ Fix lodash and diff vulnerabilities
2. ✅ Commit changes
3. ⏳ Accept webpack-dev-server risk (dev only)
4. ✅ Verify CI/CD passes

**Time Estimate**: 10-15 minutes

---

**Created**: 2026-01-24
**Updated**: 2026-01-24
**Status**: Ready for execution
