# SSL Certificate Setup Guide

This guide explains how to set up SSL certificates for the CA Marketplace production deployment.

## Table of Contents
1. [Option 1: Let's Encrypt (Recommended)](#option-1-lets-encrypt-recommended)
2. [Option 2: Self-Signed Certificate (Development/Testing)](#option-2-self-signed-certificate-developmenttesting)
3. [Option 3: Custom Certificate](#option-3-custom-certificate)
4. [Verification](#verification)
5. [Troubleshooting](#troubleshooting)

---

## Option 1: Let's Encrypt (Recommended)

Let's Encrypt provides free, automated SSL certificates with auto-renewal.

### Prerequisites
- Domain name pointing to your server (DNS configured)
- Ports 80 and 443 open on your firewall
- Docker and Docker Compose installed

### Step 1: Prepare Environment

Create directories for Let's Encrypt:
```bash
mkdir -p certbot/conf certbot/www
```

### Step 2: Update Nginx Configuration

Edit `docker/nginx/nginx.prod.conf` and update the domain name:
```nginx
# Replace 'yourdomain.com' with your actual domain
server_name yourdomain.com www.yourdomain.com;

# Update certificate paths
ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
```

### Step 3: Initial Certificate Generation

Before starting the full stack, get the certificate:

```bash
# Start only nginx (temporarily with HTTP only)
docker-compose -f docker-compose.prod.yml up -d nginx

# Request certificate
docker run --rm \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  -v $(pwd)/certbot/www:/var/www/certbot \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email admin@yourdomain.com \
  --agree-tos \
  --no-eff-email \
  -d yourdomain.com \
  -d www.yourdomain.com
```

### Step 4: Start Full Stack

```bash
# Stop nginx
docker-compose -f docker-compose.prod.yml down nginx

# Start all services (nginx will now use SSL)
docker-compose -f docker-compose.prod.yml up -d
```

### Step 5: Set Up Auto-Renewal

The certbot container in `docker-compose.prod.yml` automatically renews certificates.

To test renewal:
```bash
docker exec ca_certbot certbot renew --dry-run
```

### Step 6: Reload Nginx After Renewal

Add a cron job to reload nginx after renewal:
```bash
crontab -e

# Add this line (runs daily at 3 AM)
0 3 * * * docker exec ca_nginx_prod nginx -s reload
```

---

## Option 2: Self-Signed Certificate (Development/Testing)

**WARNING**: Self-signed certificates are NOT recommended for production. Use only for development/testing.

### Generate Self-Signed Certificate

```bash
# Create SSL directory
mkdir -p ssl

# Generate certificate (valid for 365 days)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/nginx-selfsigned.key \
  -out ssl/nginx-selfsigned.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Set proper permissions
chmod 600 ssl/nginx-selfsigned.key
chmod 644 ssl/nginx-selfsigned.crt
```

### Update Nginx Configuration

Edit `docker/nginx/nginx.prod.conf`:
```nginx
# Comment out Let's Encrypt paths
# ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

# Uncomment self-signed paths
ssl_certificate /etc/nginx/ssl/nginx-selfsigned.crt;
ssl_certificate_key /etc/nginx/ssl/nginx-selfsigned.key;
```

### Start Services

```bash
docker-compose -f docker-compose.prod.yml up -d
```

**Note**: Browsers will show a security warning. This is expected for self-signed certificates.

---

## Option 3: Custom Certificate

If you have a certificate from another provider (GoDaddy, Namecheap, etc.):

### Step 1: Place Certificate Files

```bash
mkdir -p ssl
# Copy your certificate files
cp /path/to/certificate.crt ssl/
cp /path/to/private.key ssl/
cp /path/to/ca_bundle.crt ssl/  # If applicable
```

### Step 2: Update Nginx Configuration

Edit `docker/nginx/nginx.prod.conf`:
```nginx
ssl_certificate /etc/nginx/ssl/certificate.crt;
ssl_certificate_key /etc/nginx/ssl/private.key;

# If you have a CA bundle
# ssl_trusted_certificate /etc/nginx/ssl/ca_bundle.crt;
```

### Step 3: Set Permissions

```bash
chmod 600 ssl/private.key
chmod 644 ssl/certificate.crt
```

### Step 4: Start Services

```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## Verification

### 1. Test HTTPS Connection

```bash
# Should return HTTP 200
curl -I https://yourdomain.com/api/health

# HTTP should redirect to HTTPS
curl -I http://yourdomain.com/api/health
# Look for: HTTP/1.1 301 Moved Permanently
```

### 2. Test SSL Certificate

```bash
# Check certificate details
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Should show certificate chain and validity
```

### 3. Online SSL Test

Check your SSL configuration:
- [SSL Labs](https://www.ssllabs.com/ssltest/) - Aim for A or A+ rating
- [SSL Checker](https://www.sslshopper.com/ssl-checker.html)

### 4. Browser Test

1. Open https://yourdomain.com in a browser
2. Click the padlock icon in the address bar
3. Verify certificate is valid and trusted

---

## Troubleshooting

### Certificate Not Found Error

```
nginx: [emerg] cannot load certificate "/etc/letsencrypt/live/...": No such file or directory
```

**Solution**:
- Ensure certificate was generated successfully
- Check certificate path in nginx.prod.conf
- Verify volume mounts in docker-compose.prod.yml

### Port 80/443 Already in Use

```
Error: bind: address already in use
```

**Solution**:
```bash
# Find process using port
sudo lsof -i :80
sudo lsof -i :443

# Stop the process or change nginx ports
```

### Domain Not Resolving

```
certbot: challenge failed for domain
```

**Solution**:
- Verify DNS is configured correctly
- Wait for DNS propagation (can take up to 48 hours)
- Check domain with: `nslookup yourdomain.com`

### Certificate Expired

```
SSL certificate problem: certificate has expired
```

**Solution**:
```bash
# Manually renew
docker exec ca_certbot certbot renew --force-renewal

# Reload nginx
docker exec ca_nginx_prod nginx -s reload
```

### Mixed Content Warnings

Browser console shows:
```
Mixed Content: The page at 'https://...' was loaded over HTTPS, but requested an insecure resource
```

**Solution**:
- Update frontend to use HTTPS for all API calls
- Set `REACT_APP_API_URL=https://yourdomain.com/api` in environment
- Enable `upgrade-insecure-requests` CSP header (already in nginx config)

---

## Best Practices

1. **Use Let's Encrypt** for production (free, automated, trusted)
2. **Enable Auto-Renewal** to prevent certificate expiration
3. **Test Renewal** regularly with `--dry-run`
4. **Monitor Expiration** - certificates expire every 90 days
5. **Use Strong Ciphers** (already configured in nginx.prod.conf)
6. **Enable HSTS** (already configured)
7. **Test Configuration** with SSL Labs after setup
8. **Keep Backups** of certificate private keys

---

## Certificate Renewal Timeline

Let's Encrypt certificates:
- **Validity**: 90 days
- **Auto-renewal**: Attempts every 12 hours (certbot container)
- **Renewal Window**: 30 days before expiration
- **Recommended**: Test renewal monthly with `--dry-run`

---

## Emergency Certificate Revocation

If your private key is compromised:

```bash
# Revoke certificate
docker run --rm \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  certbot/certbot revoke \
  --cert-path /etc/letsencrypt/live/yourdomain.com/cert.pem

# Request new certificate
docker run --rm \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  -v $(pwd)/certbot/www:/var/www/certbot \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email admin@yourdomain.com \
  --agree-tos \
  -d yourdomain.com

# Reload nginx
docker exec ca_nginx_prod nginx -s reload
```

---

## Additional Resources

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Certbot Documentation](https://certbot.eff.org/docs/)
- [Nginx SSL Configuration](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [SSL Labs Best Practices](https://github.com/ssllabs/research/wiki/SSL-and-TLS-Deployment-Best-Practices)
