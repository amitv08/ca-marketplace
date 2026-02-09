# CI/CD Documentation

Complete guide to the CI/CD pipeline configuration, fixes, and troubleshooting.

## Overview

The CA Marketplace uses GitHub Actions for continuous integration and deployment with three main workflows:

1. **Build & Scan** - Docker image builds and security scanning
2. **Test Suite** - Unit, integration, security, and E2E tests
3. **Security Scanning** - Comprehensive security analysis

## Quick Reference

- **Build Status**: All workflows passing ✅
- **Security Vulnerabilities**: 0 production vulnerabilities
- **Test Coverage**: 168+ test scenarios
- **Last Updated**: January 2026

## Documentation Files

- [CI/CD Fixes Summary](./CI_CD_FIXES.md) - Complete timeline of all CI/CD fixes
- [Database Configuration](./DATABASE_SETUP.md) - Prisma and PostgreSQL configuration
- [Workflow Configuration](../../.github/workflows/) - GitHub Actions YAML files

## Common Issues & Solutions

### Build Failures

**Issue**: npm ci fails with peer dependency conflicts
**Solution**: Use legacy-peer-deps flag (configured in .npmrc)

**Issue**: Prisma DATABASE_URL not found during build
**Solution**: Set dummy DATABASE_URL for build-time (see DATABASE_SETUP.md)

### Test Failures

**Issue**: Tests fail with authentication errors
**Solution**: Ensure all JWT environment variables are set

**Issue**: Database connection errors in tests
**Solution**: Verify PostgreSQL service is configured with correct ports

## Environment Variables

Required for all test workflows:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing key
- `JWT_REFRESH_SECRET` - Refresh token signing key
- `NODE_ENV=test`

## Verification Commands

```bash
# Check workflow status
gh run list --limit 5

# View specific workflow
gh run view <run-id>

# Re-run failed workflow
gh run rerun <run-id>
```

## Security Scanning

All security scans configured:
- ✅ Snyk - Dependency vulnerabilities
- ✅ OWASP Dependency Check
- ✅ NPM Audit
- ✅ TruffleHog - Secret scanning
- ✅ Trivy - Docker image scanning

## Performance

- Build time: ~3-5 minutes
- Test execution: ~5-8 minutes
- Security scans: ~5-10 minutes
- Total pipeline: ~15-20 minutes
