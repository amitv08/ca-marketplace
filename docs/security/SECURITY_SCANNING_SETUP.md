# Security Scanning Setup Guide

## Overview
This repository uses GitHub Actions for automated security scanning including:
- **TruffleHog**: Secret detection
- **CodeQL**: Code security analysis
- **Dependency Review**: Vulnerability scanning in dependencies

## Current Issues and Fixes

### Issue 1: TruffleHog "BASE and HEAD commits are the same"

**Problem**: TruffleHog cannot scan when there's no commit history to compare.

**Solutions Implemented**:
1. ✅ Added `fetch-depth: 0` to checkout action to fetch full git history
2. ✅ Set `continue-on-error: true` to prevent build failures on initial scans
3. ✅ Configured to run on pull requests where proper base/head comparison exists
4. ✅ Added scheduled runs for periodic full scans

**If the error persists**:
- Ensure your repository has more than one commit
- Check that the workflow runs on pull requests, not just single commits
- Verify git history is accessible in the runner

### Issue 2: CodeQL SARIF Conflict

**Problem**: "CodeQL analyses from advanced configurations cannot be processed when the default setup is enabled"

**Root Cause**: GitHub has TWO CodeQL configurations running:
1. Default setup (enabled in repository settings)
2. Custom workflow (`.github/workflows/security-scan.yml`)

**Fix - Choose ONE option**:

#### Option A: Use Default Setup (Recommended for simplicity)
1. Go to: **Settings** → **Code security and analysis** → **Code scanning**
2. Keep **"Default"** setup enabled
3. **Delete** or disable the CodeQL job in `.github/workflows/security-scan.yml`
4. Comment out lines 27-52 in the workflow file

#### Option B: Use Advanced Configuration (Recommended for customization)
1. Go to: **Settings** → **Code security and analysis** → **Code scanning**
2. Click **"Set up"** → **"Advanced"**
3. This will disable the default setup
4. Keep the `.github/workflows/security-scan.yml` workflow active

## Recommended Configuration

For this project, I recommend **Option A** (Default Setup) because:
- Simpler to manage
- Automatically updates with GitHub's latest security rules
- Less maintenance required

If you choose Option A, edit `.github/workflows/security-scan.yml` and comment out the `codeql` job:

```yaml
  # codeql:
  #   name: CodeQL Analysis
  #   runs-on: ubuntu-latest
  #   ... (comment out entire job)
```

## Testing the Workflow

After fixing the configuration:

1. **Create a test branch**:
   ```bash
   git checkout -b test-security-scan
   git commit --allow-empty -m "Test security scanning"
   git push origin test-security-scan
   ```

2. **Create a pull request** to trigger the workflow

3. **Check Actions tab** to verify:
   - ✅ TruffleHog scan completes
   - ✅ CodeQL analysis completes (if using custom workflow)
   - ✅ No SARIF upload conflicts

## Workflow Triggers

The security scan runs on:
- **Pull Requests**: To main, master, or develop branches
- **Push**: To main, master, or develop branches
- **Schedule**: Daily at 2 AM UTC
- **Manual**: Can be triggered manually from Actions tab

## Customization

### Adjusting TruffleHog Sensitivity
Edit `.github/workflows/security-scan.yml`:
```yaml
extra_args: --only-verified --json  # Only report verified secrets
# OR
extra_args: --json  # Report all potential secrets
```

### Adjusting CodeQL Queries
```yaml
queries: security-and-quality  # Current: Security + Code Quality
# OR
queries: security-extended     # More thorough security checks
```

### Adjusting Dependency Review Severity
```yaml
fail-on-severity: moderate  # Current: Fail on moderate+ vulnerabilities
# Options: low, moderate, high, critical
```

## Troubleshooting

### TruffleHog still failing?
- Ensure git history exists: `git log --oneline | wc -l` should return > 1
- Check workflow logs for specific error messages
- Try running locally: `docker run --rm -v $(pwd):/repo trufflesecurity/trufflehog:latest filesystem /repo`

### CodeQL still conflicting?
- **Double-check** repository settings → Code security → Code scanning
- Ensure only ONE CodeQL configuration is active
- Wait 5 minutes after changing settings for GitHub to sync

### Dependency Review not running?
- Only runs on pull requests (by design)
- Requires `pull-requests: write` permission
- Check package.json/package-lock.json are committed

## Security Best Practices

1. **Never commit secrets** - Use environment variables and GitHub Secrets
2. **Review security alerts** - Check the Security tab regularly
3. **Update dependencies** - Run `npm audit fix` periodically
4. **Use branch protection** - Require security scans to pass before merge
5. **Enable Dependabot** - Automatic dependency update PRs

## Additional Resources

- [GitHub CodeQL Documentation](https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning-with-codeql)
- [TruffleHog Documentation](https://github.com/trufflesecurity/trufflehog)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
