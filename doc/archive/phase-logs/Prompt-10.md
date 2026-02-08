Create production Docker setup for the CA marketplace:

1. **docker-compose.prod.yml** for production:
   - Nginx as reverse proxy
   - PostgreSQL with backup volume
   - Separate containers for backend and frontend
   - Environment variables for production
   - SSL certificate setup (Let's Encrypt)

2. **Nginx configuration** for:
   - Serving frontend static files
   - Proxying API requests to backend
   - SSL/TLS configuration
   - Compression, caching headers

3. **Production Dockerfiles:**
   - Backend: Multi-stage build
   - Frontend: Build static files, serve via Nginx

4. **Environment setup:**
   - .env.production files
   - Database backup strategy
   - Log rotation
   - Health checks

Include deployment instructions for:
- AWS EC2
- DigitalOcean Droplet
- Railway.app (simplest for beginners)