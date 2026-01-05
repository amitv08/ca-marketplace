# Deployment Scripts

This directory contains scripts for managing the CA Marketplace production deployment.

## Available Scripts

### deploy.sh
Main deployment script that builds and starts all services.

```bash
./scripts/deploy.sh
```

**What it does:**
- Pulls latest code from git (if available)
- Builds Docker images
- Starts all services
- Runs database migrations
- Checks service health
- Displays status

### init-letsencrypt.sh
Initializes SSL certificates using Let's Encrypt.

```bash
# Production certificates
./scripts/init-letsencrypt.sh yourdomain.com admin@yourdomain.com

# Staging certificates (for testing)
./scripts/init-letsencrypt.sh yourdomain.com admin@yourdomain.com 1
```

**What it does:**
- Downloads TLS parameters
- Creates temporary certificates
- Requests real certificates from Let's Encrypt
- Configures Nginx
- Sets up auto-renewal

### backup-db.sh
Creates a compressed backup of the PostgreSQL database.

```bash
./scripts/backup-db.sh
```

**What it does:**
- Creates SQL dump of database
- Compresses backup with gzip
- Stores in ./backups directory
- Removes backups older than 30 days
- Shows backup size and count

**Automated backups:**
```bash
# Add to crontab for daily backups at 2 AM
crontab -e
0 2 * * * /path/to/ca-marketplace/scripts/backup-db.sh
```

### restore-db.sh
Restores database from a backup file.

```bash
./scripts/restore-db.sh ./backups/ca_marketplace_20260104_120000.sql.gz
```

**What it does:**
- Validates backup file exists
- Asks for confirmation
- Decompresses backup if needed
- Drops existing connections
- Restores database
- Cleans up temporary files

**⚠️ Warning:** This will overwrite the current database!

## Script Permissions

All scripts should be executable. If needed, run:
```bash
chmod +x scripts/*.sh
```

## Environment Variables

Scripts use variables from `.env.production`:
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `CORS_ORIGIN`

Make sure this file exists and is configured before running scripts.

## Troubleshooting

### Script won't execute
```bash
# Make sure it's executable
chmod +x scripts/script-name.sh

# Check for Windows line endings
dos2unix scripts/script-name.sh
```

### Database container not found
```bash
# Check container name
docker ps | grep postgres

# Update POSTGRES_CONTAINER in script if needed
```

### SSL initialization fails
```bash
# Check domain DNS is configured
dig yourdomain.com

# Verify ports 80 and 443 are accessible
sudo ufw status

# Try staging mode first
./scripts/init-letsencrypt.sh yourdomain.com email@domain.com 1
```

## Best Practices

1. **Test scripts locally first** before using in production
2. **Backup before major changes** using backup-db.sh
3. **Monitor logs** during deployment
4. **Keep backups offsite** (AWS S3, DigitalOcean Spaces, etc.)
5. **Schedule regular backups** using cron
6. **Test restore process** periodically

## Additional Scripts

You can add custom scripts to this directory:

### Example: Health Check Script
```bash
#!/bin/bash
# scripts/health-check.sh

curl -f http://localhost/api || exit 1
curl -f http://localhost/health || exit 1
echo "Health check passed"
```

### Example: Update Script
```bash
#!/bin/bash
# scripts/update.sh

git pull
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

## Support

For issues with scripts, check:
1. Script logs and error messages
2. Docker container logs
3. System logs (/var/log/syslog)
4. DEPLOYMENT.md for detailed instructions
