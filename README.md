# CA Marketplace

A comprehensive web platform connecting clients with Chartered Accountants (CAs) for professional services. Built with modern technologies and production-ready infrastructure.

## Features

### Core Functionality
- **Dual Role System**: Separate interfaces and workflows for Clients and Chartered Accountants
- **User Authentication**: Secure JWT-based authentication with role-based access control
- **CA Discovery**: Search and filter CAs by specialization, experience, rating, and hourly rate
- **Service Requests**: Complete lifecycle management from creation to completion
- **Real-time Messaging**: Socket.io-powered chat between clients and CAs
- **Payment Integration**: Razorpay payment gateway with automatic platform fee (10%) calculation
- **Review System**: Client feedback and ratings for completed services
- **Availability Management**: CAs can set and manage their availability calendar

### Client Features
- Browse and search for qualified CAs
- Create and manage service requests
- Real-time notifications for request updates
- Secure payment processing
- Review and rate completed services
- Message CAs directly

### CA Features
- Complete profile management with specializations and qualifications
- Service request acceptance/rejection workflow
- Availability calendar management
- Profile completion tracking with progress indicator
- Earnings dashboard
- Client communication tools

## Tech Stack

### Backend
- **Runtime**: Node.js 18
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL 15
- **ORM**: Prisma
- **Authentication**: JWT
- **Real-time**: Socket.io
- **Payment**: Razorpay
- **File Upload**: Multer

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **State Management**: Redux Toolkit
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **Form Handling**: React Hook Form
- **HTTP Client**: Axios

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Web Server**: Nginx (reverse proxy)
- **SSL**: Let's Encrypt (automated)
- **Process Manager**: PM2 / dumb-init
- **Log Management**: JSON file driver with rotation

## Project Structure

```
ca-marketplace/
├── backend/               # Node.js backend application
│   ├── src/
│   │   ├── config/       # Configuration files
│   │   ├── middleware/   # Express middleware
│   │   ├── routes/       # API route handlers
│   │   ├── services/     # Business logic
│   │   └── utils/        # Utility functions
│   ├── prisma/           # Database schema and migrations
│   └── Dockerfile.prod   # Production Docker build
├── frontend/             # React frontend application
│   ├── src/
│   │   ├── components/   # Reusable React components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API service layer
│   │   └── store/        # Redux store and slices
│   └── Dockerfile.prod   # Production Docker build
├── nginx/                # Nginx configuration
│   ├── nginx.conf        # Main Nginx config
│   └── conf.d/           # Site-specific configs
├── scripts/              # Deployment and maintenance scripts
│   ├── deploy.sh         # Main deployment script
│   ├── backup-db.sh      # Database backup
│   ├── restore-db.sh     # Database restore
│   └── init-letsencrypt.sh # SSL certificate setup
├── docs/                 # Additional documentation
│   ├── DEVELOPMENT_LOG.md # Complete development history
│   ├── ROUTES_COMPLETE.md # API routes documentation
│   └── SETUP_COMPLETE.md  # Setup completion status
├── docker-compose.yml    # Development environment
├── docker-compose.prod.yml # Production environment
├── DEPLOYMENT.md         # Deployment guide
└── PRODUCTION_CHECKLIST.md # Go-live checklist

```

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15 (or use Docker)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/amitv08/ca-marketplace.git
   cd ca-marketplace
   ```

2. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

   This will start:
   - PostgreSQL database (external port 54320, internal 5432)
   - Redis cache (external port 63790, internal 6379)
   - Backend API (external port 8080, internal 5000)
   - Frontend app (external port 3001, internal 3000)
   - PGAdmin (external port 5051, internal 80)

   **Note**: Non-standard external ports are used for security (avoiding well-known port attacks).

3. **Access the application**
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:8080/api
   - PGAdmin: http://localhost:5051
   - API Documentation: See [backend/API_ROUTES.md](backend/API_ROUTES.md)

### Manual Setup (Without Docker)

1. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Configure your .env file
   npx prisma migrate dev
   npx prisma generate
   npm run dev
   ```

2. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cp .env.example .env
   # Configure REACT_APP_API_URL
   npm start
   ```

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:54320/ca_marketplace
JWT_SECRET=your-secret-key
RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_KEY_SECRET=your-razorpay-secret
PLATFORM_FEE_PERCENTAGE=10
REDIS_URL=redis://localhost:63790
```

### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:8080/api
```

**Note**: Use external ports (54320, 63790, 8080) when connecting from your local machine. Internal containers use standard ports (5432, 6379, 5000) for inter-container communication.

## Production Deployment

For detailed production deployment instructions, see:
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide for Railway, DigitalOcean, and AWS
- **[PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)** - 150+ item pre-launch checklist

### Quick Production Deploy

1. **Configure production environment**
   ```bash
   cp .env.production.example .env.production
   # Edit .env.production with production values
   ```

2. **Deploy with script**
   ```bash
   chmod +x scripts/*.sh
   ./scripts/deploy.sh
   ```

3. **Setup SSL certificates**
   ```bash
   ./scripts/init-letsencrypt.sh yourdomain.com admin@yourdomain.com
   ```

### Supported Platforms
- **Railway.app** - Easiest, 5-10 minutes setup
- **DigitalOcean** - $12-24/month, full control
- **AWS EC2** - Enterprise-grade, ~$50-60/month

## API Documentation

Complete API documentation is available at [backend/API_ROUTES.md](backend/API_ROUTES.md)

### Key Endpoints
- **Authentication**: `/api/auth/*`
- **CA Management**: `/api/cas/*`
- **Service Requests**: `/api/service-requests/*`
- **Payments**: `/api/payments/*`
- **Messages**: `/api/messages/*`
- **Reviews**: `/api/reviews/*`

## Database Schema

The application uses PostgreSQL with Prisma ORM. Key models:
- **User** - User accounts (CLIENT or CA role)
- **CAProfile** - Chartered Accountant profiles
- **ServiceRequest** - Service requests with lifecycle states
- **Payment** - Payment records with Razorpay integration
- **Message** - Real-time messaging
- **Review** - Service reviews and ratings
- **Availability** - CA availability schedules

Schema definition: [backend/prisma/schema.prisma](backend/prisma/schema.prisma)

## Development

### Running Tests
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Database Migrations
```bash
cd backend

# Create a new migration
npx prisma migrate dev --name migration_name

# Apply migrations in production
npx prisma migrate deploy
```

### Backup & Restore
```bash
# Create backup
./scripts/backup-db.sh

# Restore from backup
./scripts/restore-db.sh ./backups/backup_file.sql.gz
```

## Architecture

For detailed architecture documentation, see:
- [backend/ARCHITECTURE.md](backend/ARCHITECTURE.md) - Backend architecture
- [docs/DEVELOPMENT_LOG.md](docs/DEVELOPMENT_LOG.md) - Development history

## Security

- JWT-based authentication
- Password hashing with bcrypt
- CORS protection
- Rate limiting on sensitive endpoints
- SQL injection protection (Prisma ORM)
- XSS protection
- HTTPS/TLS in production
- Razorpay webhook signature verification

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Open an issue on GitHub
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for deployment help
- Review [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) for go-live preparation

## Quality Assurance & Security

### Recent Testing & Bug Fixes (January 2026)

✅ **Comprehensive Full-Stack Testing Completed**
- **12 Critical Bugs Fixed** - All identified bugs resolved and documented
- **0 Security Vulnerabilities** - All npm security issues patched
- **100% API Endpoint Coverage** - All endpoints tested and verified

For detailed information:
- **[BUG_REPORT.md](BUG_REPORT.md)** - Complete bug analysis and fixes
- **[SECURITY_FIXES.md](SECURITY_FIXES.md)** - Security vulnerability resolutions
- **[backend/TESTING.md](backend/TESTING.md)** - Testing strategies and coverage

### System Health Status

All services operational and verified:
- ✅ **Frontend**: React application running on port 3001 (external) / 3000 (internal)
- ✅ **Backend**: Express API running on port 8080 (external) / 5000 (internal)
- ✅ **PostgreSQL**: Database healthy on port 54320 (external) / 5432 (internal)
- ✅ **Redis**: Cache/session store healthy on port 63790 (external) / 6379 (internal)
- ✅ **Socket.IO**: Real-time messaging active
- ✅ **PGAdmin**: Database management UI on port 5051 (external) / 80 (internal)

### Security Achievements

- **Zero npm audit vulnerabilities** in both frontend and backend
- JWT authentication with secure token management
- RBAC (Role-Based Access Control) implementation complete
- SQL injection protection via Prisma ORM
- XSS and CSRF protection enabled
- Rate limiting on sensitive endpoints
- Razorpay webhook signature verification
- Comprehensive input validation and sanitization

See [SECURITY_IMPLEMENTATION_COMPLETE.md](SECURITY_IMPLEMENTATION_COMPLETE.md) for full security details.

## Project Status

✅ **Production Ready & Quality Assured**

All phases completed:
- Phase 1-2: Database schema and backend setup
- Phase 3-5: Authentication, CA profiles, service requests
- Phase 6-7: Payment integration and messaging
- Phase 8: Complete React frontend
- Phase 9: Enhanced UI with search, notifications, dashboards
- Phase 10: Production Docker configuration and deployment
- **Phase 11: Comprehensive testing, bug fixes, and security hardening** ✨

See [docs/DEVELOPMENT_LOG.md](docs/DEVELOPMENT_LOG.md) for complete development history.

---

**Built with** ❤️ **by** [Amit](https://github.com/amitv08)
