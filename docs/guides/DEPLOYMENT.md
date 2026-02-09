# CA Marketplace - Production Deployment Guide

This guide provides step-by-step instructions for deploying the CA Marketplace application to production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Deployment Options](#deployment-options)
   - [Railway.app (Easiest)](#railwayapp-easiest-for-beginners)
   - [DigitalOcean Droplet](#digitalocean-droplet)
   - [AWS EC2](#aws-ec2)
4. [SSL Certificate Setup](#ssl-certificate-setup)
5. [Database Backups](#database-backups)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required
- Domain name (e.g., yourdomain.com)
- Git installed
- Docker and Docker Compose installed
- Basic knowledge of Linux command line

### Recommended
- SSH key pair for server access
- GitHub/GitLab account for code repository
- Email service (for notifications)

---

## Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/ca-marketplace.git
cd ca-marketplace
```

### 2. Configure Environment
```bash
# Copy example environment file
cp .env.production.example .env.production

# Edit configuration (use nano, vim, or any editor)
nano .env.production
```

**Required Changes:**
- `POSTGRES_PASSWORD` - Strong database password
- `JWT_SECRET` - Generate with: `openssl rand -base64 32`
- `CORS_ORIGIN` - Your production domain (https://yourdomain.com)
- `RAZORPAY_KEY_ID` - Your Razorpay live key
- `RAZORPAY_KEY_SECRET` - Your Razorpay secret
- `REACT_APP_API_URL` - API URL (https://yourdomain.com/api)

### 3. Update Domain in Nginx Config
```bash
# Replace 'yourdomain.com' with your actual domain
sed -i 's/yourdomain.com/your-actual-domain.com/g' nginx/conf.d/app.conf
```

### 4. Deploy
```bash
chmod +x scripts/*.sh
./scripts/deploy.sh
```

---

## Deployment Options

## Railway.app (Easiest for Beginners)

Railway is the simplest option with automatic deployments and built-in PostgreSQL.

### Step 1: Create Railway Account
1. Go to [Railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project"

### Step 2: Deploy from GitHub
```bash
# Push your code to GitHub first
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/ca-marketplace.git
git push -u origin main
```

1. In Railway, click "Deploy from GitHub repo"
2. Select your repository
3. Railway will detect Dockerfile automatically

### Step 3: Add PostgreSQL
1. Click "New" → "Database" → "Add PostgreSQL"
2. Railway automatically creates DATABASE_URL

### Step 4: Configure Environment Variables
In Railway dashboard, add:
```
NODE_ENV=production
JWT_SECRET=your-jwt-secret
RAZORPAY_KEY_ID=your-key
RAZORPAY_KEY_SECRET=your-secret
PLATFORM_FEE_PERCENTAGE=10
```

### Step 5: Deploy Frontend
1. Click "New" → "GitHub Repo"
2. Select your repository
3. In settings, set:
   - Root Directory: `/frontend`
   - Build Command: `npm run build`
   - Start Command: `npx serve -s build`

### Step 6: Custom Domain
1. Go to Settings → Domains
2. Click "Generate Domain" or add custom domain
3. Update DNS records as shown

**Railway Advantages:**
- ✅ Easiest setup (5-10 minutes)
- ✅ Auto-deployment from GitHub
- ✅ Built-in PostgreSQL
- ✅ Free SSL certificates
- ✅ Free tier available ($5/month credit)

**Railway Limitations:**
- Limited to Railway infrastructure
- Less control over server configuration
- Costs scale with usage

---

## DigitalOcean Droplet

DigitalOcean provides good balance between simplicity and control.

### Step 1: Create Droplet
1. Go to [DigitalOcean](https://www.digitalocean.com)
2. Create → Droplets
3. Choose:
   - **Image:** Ubuntu 22.04 LTS
   - **Plan:** Basic ($12/month or higher)
   - **CPU:** 2 vCPUs, 2GB RAM minimum
   - **Datacenter:** Closest to your users
   - **Authentication:** SSH Key (recommended)

### Step 2: Initial Server Setup
```bash
# SSH into your droplet
ssh root@your_droplet_ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Create non-root user
adduser deploy
usermod -aG docker deploy
usermod -aG sudo deploy

# Switch to deploy user
su - deploy
```

### Step 3: Setup Firewall
```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Step 4: Clone and Deploy
```bash
# Clone repository
git clone https://github.com/yourusername/ca-marketplace.git
cd ca-marketplace

# Configure environment
cp .env.production.example .env.production
nano .env.production

# Deploy
./scripts/deploy.sh
```

### Step 5: Setup SSL with Let's Encrypt
```bash
# Run SSL initialization script
./scripts/init-letsencrypt.sh yourdomain.com admin@yourdomain.com
```

### Step 6: Setup Automatic Backups
```bash
# Add to crontab
crontab -e

# Add this line (daily backup at 2 AM)
0 2 * * * /home/deploy/ca-marketplace/scripts/backup-db.sh
```

### Step 7: Point Domain to Droplet
1. Go to your domain registrar
2. Add A record:
   - **Name:** @ (or subdomain)
   - **Value:** Your droplet IP
   - **TTL:** 3600
3. Add CNAME for www:
   - **Name:** www
   - **Value:** yourdomain.com

**DigitalOcean Advantages:**
- ✅ Full server control
- ✅ Predictable pricing ($12-24/month)
- ✅ Good documentation
- ✅ Scalable resources
- ✅ Built-in monitoring

**DigitalOcean Considerations:**
- Requires Linux knowledge
- Manual SSL setup
- You manage backups and updates

---

## AWS EC2

AWS provides maximum scalability and integration with other services.

### Step 1: Launch EC2 Instance
1. Go to [AWS Console](https://console.aws.amazon.com)
2. Navigate to EC2
3. Click "Launch Instance"
4. Configure:
   - **Name:** ca-marketplace-prod
   - **AMI:** Ubuntu Server 22.04 LTS
   - **Instance Type:** t3.medium (2 vCPU, 4GB RAM)
   - **Key Pair:** Create new or use existing
   - **Security Group:**
     - SSH (22) - Your IP only
     - HTTP (80) - Anywhere
     - HTTPS (443) - Anywhere
   - **Storage:** 30GB gp3

### Step 2: Allocate Elastic IP
1. EC2 → Elastic IPs
2. Allocate new address
3. Associate with your instance
4. Note the IP address

### Step 3: Connect and Setup
```bash
# SSH into instance
ssh -i your-key.pem ubuntu@your-elastic-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo apt install docker-compose -y

# Logout and login again for group changes
exit
ssh -i your-key.pem ubuntu@your-elastic-ip
```

### Step 4: Setup RDS (Optional but Recommended)
1. Go to RDS in AWS Console
2. Create Database
3. Choose PostgreSQL 15
4. Configure:
   - **Template:** Production
   - **DB Instance:** db.t3.micro
   - **Storage:** 20GB
   - **VPC:** Same as EC2
   - **Public Access:** No
5. Note connection details
6. Update security group to allow EC2

### Step 5: Deploy Application
```bash
# Clone repository
git clone https://github.com/yourusername/ca-marketplace.git
cd ca-marketplace

# Configure environment
cp .env.production.example .env.production
nano .env.production

# If using RDS, update DATABASE_URL
# DATABASE_URL=postgresql://username:password@rds-endpoint:5432/dbname

# Deploy
./scripts/deploy.sh
```

### Step 6: Setup Route 53 (AWS DNS)
1. Route 53 → Hosted Zones
2. Create hosted zone for your domain
3. Create A record pointing to Elastic IP
4. Update nameservers at domain registrar

### Step 7: Setup SSL Certificate
```bash
./scripts/init-letsencrypt.sh yourdomain.com admin@yourdomain.com
```

### Step 8: Setup CloudWatch (Monitoring)
1. CloudWatch → Logs
2. Create log group: `/aws/ca-marketplace`
3. Install CloudWatch agent on EC2
4. Configure log streaming

### Step 9: Setup Automated Backups
```bash
# For local database backups
crontab -e
0 2 * * * /home/ubuntu/ca-marketplace/scripts/backup-db.sh

# For RDS - enable automated backups in console
```

**AWS Advantages:**
- ✅ Maximum scalability
- ✅ Integration with AWS services
- ✅ RDS for managed PostgreSQL
- ✅ CloudWatch for monitoring
- ✅ Auto-scaling capabilities
- ✅ S3 for file storage

**AWS Considerations:**
- More complex setup
- Higher costs if not optimized
- Requires AWS knowledge
- Many configuration options

**Estimated AWS Costs:**
- EC2 t3.medium: ~$30/month
- RDS db.t3.micro: ~$15/month
- Data transfer: ~$5-10/month
- **Total:** ~$50-60/month

---

## SSL Certificate Setup

### Automatic with Let's Encrypt

```bash
# Initialize SSL certificates
./scripts/init-letsencrypt.sh yourdomain.com admin@yourdomain.com

# For testing (staging certificates)
./scripts/init-letsencrypt.sh yourdomain.com admin@yourdomain.com 1
```

### Manual Certificate
If you have your own SSL certificate:

1. Place files in `./certbot/conf/live/yourdomain.com/`:
   - `fullchain.pem`
   - `privkey.pem`

2. Update nginx config to use them

3. Restart nginx:
```bash
docker-compose -f docker-compose.prod.yml restart nginx
```

---

## Database Backups

### Automated Daily Backups

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /path/to/ca-marketplace/scripts/backup-db.sh
```

### Manual Backup
```bash
./scripts/backup-db.sh
```

Backups are stored in `./backups/` directory.

### Restore from Backup
```bash
# List available backups
ls -lh ./backups/

# Restore specific backup
./scripts/restore-db.sh ./backups/ca_marketplace_20260104_120000.sql.gz
```

### Off-site Backup (Recommended)

**Option 1: AWS S3**
```bash
# Install AWS CLI
apt install awscli

# Configure
aws configure

# Upload backup
aws s3 cp ./backups/ s3://your-bucket/backups/ --recursive
```

**Option 2: Automated with Cron**
```bash
# Add to crontab after backup
0 3 * * * aws s3 sync /path/to/backups/ s3://your-bucket/backups/
```

---

## Monitoring & Maintenance

### View Logs
```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100
```

### Check Service Status
```bash
docker-compose -f docker-compose.prod.yml ps
```

### Restart Services
```bash
# Restart all
docker-compose -f docker-compose.prod.yml restart

# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend
```

### Update Application
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### Monitor Resources
```bash
# CPU and memory usage
docker stats

# Disk usage
df -h

# Nginx access logs
tail -f ./nginx/logs/access.log
```

### Health Checks

The application includes automatic health checks:
- Backend: http://yourdomain.com/api
- Nginx: http://yourdomain.com/health
- PostgreSQL: Built-in Docker health check

### Log Rotation

Logs are automatically rotated with Docker's json-file driver:
- Max size: 10MB per file
- Max files: 3
- Total max: 30MB per container

---

## Troubleshooting

### Services Won't Start

```bash
# Check container logs
docker-compose -f docker-compose.prod.yml logs

# Check individual service
docker logs ca_backend_prod

# Restart all services
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check database logs
docker logs ca_postgres_prod

# Verify connection string
docker-compose -f docker-compose.prod.yml exec backend printenv DATABASE_URL
```

### SSL Certificate Issues

```bash
# Check certificate status
docker-compose -f docker-compose.prod.yml exec certbot certbot certificates

# Renew certificate manually
docker-compose -f docker-compose.prod.yml run --rm certbot certbot renew

# Check nginx config
docker-compose -f docker-compose.prod.yml exec nginx nginx -t
```

### High Memory Usage

```bash
# Check container stats
docker stats

# Restart services to free memory
docker-compose -f docker-compose.prod.yml restart

# Prune unused Docker resources
docker system prune -a
```

### Application Not Accessible

```bash
# Check nginx is running
docker ps | grep nginx

# Check nginx logs
docker logs ca_nginx_prod

# Check firewall
sudo ufw status

# Test local access
curl http://localhost/health
```

### Database Backup Failed

```bash
# Check disk space
df -h

# Check permissions
ls -la ./backups/

# Run manual backup with verbose output
./scripts/backup-db.sh
```

---

## Security Best Practices

### 1. Environment Variables
- Never commit `.env.production` to git
- Use strong passwords (minimum 16 characters)
- Rotate secrets regularly

### 2. Firewall Configuration
```bash
# Only allow necessary ports
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3. SSH Hardening
```bash
# Disable password authentication
sudo nano /etc/ssh/sshd_config

# Set:
PasswordAuthentication no
PermitRootLogin no

# Restart SSH
sudo systemctl restart sshd
```

### 4. Regular Updates
```bash
# System updates (monthly)
sudo apt update && sudo apt upgrade -y

# Docker images (monthly)
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### 5. Monitoring
- Set up uptime monitoring (UptimeRobot, Pingdom)
- Configure error tracking (Sentry)
- Enable access logs review

---

## Support & Resources

### Documentation
- Docker: https://docs.docker.com
- Nginx: https://nginx.org/en/docs
- PostgreSQL: https://www.postgresql.org/docs
- Let's Encrypt: https://letsencrypt.org/docs

### Community
- GitHub Issues: [Your repo]/issues
- Stack Overflow: Tag with `ca-marketplace`

---

## Checklist for Go-Live

- [ ] Domain name configured and propagated
- [ ] SSL certificate installed and working
- [ ] Environment variables configured
- [ ] Database backups automated
- [ ] Firewall configured
- [ ] Monitoring setup
- [ ] Error tracking configured
- [ ] Load testing completed
- [ ] Security scan performed
- [ ] Razorpay live mode configured
- [ ] Admin account created
- [ ] Documentation reviewed

---

**Ready for Production! 🚀**

For issues or questions, please open an issue on GitHub or contact support.
