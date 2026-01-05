#!/bin/bash

# Initialize Let's Encrypt SSL certificates
# Usage: ./scripts/init-letsencrypt.sh yourdomain.com admin@yourdomain.com

set -e

# Check if domain and email are provided
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <domain> <email>"
    echo "Example: $0 yourdomain.com admin@yourdomain.com"
    exit 1
fi

DOMAIN=$1
EMAIL=$2
STAGING=${3:-0} # Set to 1 for staging certificates (testing)

echo "==================================="
echo "Initializing Let's Encrypt SSL"
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo "Staging: $STAGING"
echo "==================================="

# Create directories
mkdir -p ./certbot/conf
mkdir -p ./certbot/www

# Download recommended TLS parameters
if [ ! -e "./certbot/conf/options-ssl-nginx.conf" ] || [ ! -e "./certbot/conf/ssl-dhparams.pem" ]; then
    echo "### Downloading recommended TLS parameters ..."
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "./certbot/conf/options-ssl-nginx.conf"
    curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "./certbot/conf/ssl-dhparams.pem"
    echo
fi

# Create dummy certificate
echo "### Creating dummy certificate for $DOMAIN ..."
path="/etc/letsencrypt/live/$DOMAIN"
mkdir -p "./certbot/conf/live/$DOMAIN"
docker-compose -f docker-compose.prod.yml run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:4096 -days 1\
    -keyout '$path/privkey.pem' \
    -out '$path/fullchain.pem' \
    -subj '/CN=localhost'" certbot
echo

# Update nginx config with actual domain
echo "### Updating nginx configuration with domain $DOMAIN ..."
sed -i "s/yourdomain.com/$DOMAIN/g" ./nginx/conf.d/app.conf

# Start nginx
echo "### Starting nginx ..."
docker-compose -f docker-compose.prod.yml up -d nginx
echo

# Delete dummy certificate
echo "### Deleting dummy certificate for $DOMAIN ..."
docker-compose -f docker-compose.prod.yml run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$DOMAIN && \
  rm -Rf /etc/letsencrypt/archive/$DOMAIN && \
  rm -Rf /etc/letsencrypt/renewal/$DOMAIN.conf" certbot
echo

# Request Let's Encrypt certificate
echo "### Requesting Let's Encrypt certificate for $DOMAIN ..."

# Staging or production
if [ $STAGING != "0" ]; then
    STAGING_ARG="--staging"
else
    STAGING_ARG=""
fi

docker-compose -f docker-compose.prod.yml run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $STAGING_ARG \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN \
    -d www.$DOMAIN \
    --rsa-key-size 4096 \
    --force-renewal" certbot
echo

# Reload nginx
echo "### Reloading nginx ..."
docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
echo

echo "==================================="
echo "SSL certificates initialized!"
echo "==================================="
