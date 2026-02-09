# Port Configuration Guide

This document explains the port configuration for the CA Marketplace platform and the security rationale behind using non-standard ports.

## Port Mapping

The platform uses **non-standard external ports** for security purposes (avoiding well-known port attacks).

### External vs Internal Ports

| Service | External Port | Internal Port | Protocol | Access |
|---------|--------------|---------------|----------|---------|
| **Frontend** | 3001 | 3000 | HTTP | Public |
| **Backend API** | 8080 | 5000 | HTTP | Public |
| **PostgreSQL** | 54320 | 5432 | TCP | Private |
| **Redis** | 63790 | 6379 | TCP | Private |
| **PGAdmin** | 5051 | 80 | HTTP | Admin Only |

## Why Non-Standard Ports?

### Security Benefits

1. **Port Scanning Mitigation**: Automated port scanners typically target well-known ports (3000, 5000, 5432, 6379). Using non-standard ports reduces exposure to automated attacks.

2. **Defense in Depth**: Even if an attacker knows the services running, they must first discover the ports, adding another layer of security.

3. **Compliance**: Some security frameworks recommend avoiding standard ports for external-facing services.

4. **Reduced Attack Surface**: Fewer bots and automated tools will attempt connections on non-standard ports.

### Standard Ports Used Previously
- PostgreSQL: 5432 (well-known database port - frequently targeted)
- Redis: 6379 (well-known cache port - vulnerable to exploitation)
- Backend: 5000 (common development port)
- Frontend: 3000 (common React port)
- PGAdmin: 5050 (known PGAdmin port)

## Connection Instructions

### Local Development (Outside Docker)

When connecting from your host machine (outside Docker containers):

**PostgreSQL:**
```bash
psql -h localhost -p 54320 -U caadmin -d camarketplace
```

**Redis:**
```bash
redis-cli -h localhost -p 63790
```

**Backend API:**
```bash
curl http://localhost:8080/api/health
```

**Frontend:**
```
http://localhost:3001
```

**PGAdmin:**
```
http://localhost:5051
```

### Inside Docker Network

When services communicate with each other inside Docker network:

**Backend connecting to PostgreSQL:**
```
DATABASE_URL=postgresql://caadmin:password@postgres:5432/camarketplace
```

**Backend connecting to Redis:**
```
REDIS_URL=redis://redis:6379
```

**Frontend connecting to Backend:**
```
REACT_APP_API_URL=http://backend:5000/api
```

## Configuration Files

### docker-compose.yml

Port mappings are defined as `external:internal`:

```yaml
services:
  postgres:
    ports:
      - "54320:5432"  # Non-standard external port

  redis:
    ports:
      - "63790:6379"  # Non-standard external port

  backend:
    ports:
      - "8080:5000"   # Non-standard external port

  frontend:
    ports:
      - "3001:3000"   # Non-standard external port

  pgadmin:
    ports:
      - "5051:80"     # Non-standard external port
```

### Environment Variables

**Backend `.env`:**
```env
# Internal Docker network - uses standard ports
DATABASE_URL=postgresql://caadmin:password@postgres:5432/camarketplace
REDIS_URL=redis://redis:6379

# Backend listens on internal port
PORT=5000

# CORS allows external frontend port
CORS_ORIGIN=http://localhost:3001
```

**Frontend `.env`:**
```env
# Frontend connects to external backend port
REACT_APP_API_URL=http://localhost:8080/api
```

### VS Code Port Forwarding

`.vscode/settings.json` is configured to properly label and forward ports:

```json
{
  "remote.portsAttributes": {
    "54320": { "label": "PostgreSQL Database" },
    "63790": { "label": "Redis Cache" },
    "8080": { "label": "Backend API" },
    "3001": { "label": "Frontend React App" },
    "5051": { "label": "PGAdmin" }
  }
}
```

## GitHub Actions / CI/CD

In CI/CD environments, tests use standard internal ports because containers communicate directly:

```yaml
services:
  postgres:
    image: postgres:15
    ports:
      - 5432:5432  # Standard port for CI
    env:
      POSTGRES_DB: ca_marketplace_test

  redis:
    image: redis:7
    ports:
      - 6379:6379  # Standard port for CI
```

**Test Environment Variables:**
```yaml
env:
  DATABASE_URL: postgresql://test:test@localhost:5432/ca_marketplace_test
  REDIS_URL: redis://localhost:6379
```

## Production Deployment

### Recommended Configuration

**Option 1: Behind Reverse Proxy (Recommended)**
- Use standard ports internally (5000, 5432, 6379)
- Use Nginx/Traefik as reverse proxy
- Proxy listens on port 443 (HTTPS)
- Internal services not exposed externally

```nginx
server {
  listen 443 ssl;
  server_name api.yourdomain.com;

  location / {
    proxy_pass http://backend:5000;
  }
}
```

**Option 2: Direct Exposure (Less Secure)**
- Use non-standard external ports (as in development)
- Configure firewall rules
- Implement rate limiting
- Use fail2ban for automated blocking

### Security Considerations

1. **Firewall Rules**: Only expose necessary ports
2. **Rate Limiting**: Implement at reverse proxy level
3. **TLS/SSL**: Always use HTTPS in production
4. **Network Segmentation**: Keep database in private network
5. **VPN Access**: Require VPN for database/admin access

## Troubleshooting

### Connection Refused

**Problem**: Cannot connect to database on port 54320
**Solution**:
1. Check Docker containers are running: `docker-compose ps`
2. Verify port mapping: `docker ps | grep postgres`
3. Check firewall rules: `sudo ufw status`

### Port Already in Use

**Problem**: Error: `bind: address already in use`
**Solution**:
```bash
# Find process using the port
lsof -i :54320

# Kill the process
kill -9 <PID>

# Or use a different external port in docker-compose.yml
```

### Wrong Port in Environment Variable

**Problem**: Application can't connect to service
**Solution**: Verify you're using correct port based on context:
- **External access** (from host): Use external port (54320)
- **Internal access** (Docker network): Use internal port (5432)

## Migration from Standard Ports

If migrating from standard ports:

1. **Update docker-compose.yml** with new port mappings
2. **Update .env files** (frontend API URL, CORS origin)
3. **Update documentation** (README.md, CLAUDE.md)
4. **Restart services**: `docker-compose down && docker-compose up -d`
5. **Update any scripts** that hardcode ports
6. **Notify team members** of new URLs

## Best Practices

1. ✅ **Use non-standard external ports** for internet-facing services
2. ✅ **Keep standard internal ports** for simplicity and compatibility
3. ✅ **Document all port mappings** in one central location
4. ✅ **Use environment variables** instead of hardcoding ports
5. ✅ **Implement proper firewall rules**
6. ✅ **Monitor access logs** for suspicious activity
7. ✅ **Use reverse proxy** in production
8. ✅ **Enable TLS/SSL** on all external ports

## References

- [OWASP Port Security](https://owasp.org/www-community/vulnerabilities/Unrestricted_Port_Access)
- [Docker Port Mapping](https://docs.docker.com/config/containers/container-networking/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
