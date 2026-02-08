
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a CA (Chartered Accountant) marketplace platform that connects clients with chartered accountants for various accounting services. The platform is built as a full-stack application with:

- **Frontend**: React application (external port 3001, internal 3000)
- **Backend**: Node.js/Express API with TypeScript and Prisma ORM (external port 8081, internal 5000)
- **Database**: PostgreSQL 15 (external port 54320, internal 5432)
- **Redis**: Cache and session store (external port 63790, internal 6379)
- **Tools**: PGAdmin for database management (external port 5051, internal 80)

**Note**: Non-standard external ports are used for security (avoiding well-known port attacks).

## Architecture

### Core Data Models

The platform uses Prisma ORM with the following key entities:

1. **User System**: Base user model with role-based access (CLIENT, CA, ADMIN)
   - Clients: Company information, documents, service requests
   - CharteredAccountants: License info, specializations (GST, INCOME_TAX, AUDIT), verification status, hourly rates, availability

2. **Service Flow**: ServiceRequest → Message (communication) → Payment → Review
   - Service requests track status: PENDING → ACCEPTED → IN_PROGRESS → COMPLETED/CANCELLED
   - Messages link to service requests for context-aware communication
   - Payments tied to completed requests
   - Reviews created after service completion

3. **Availability System**: Time slot management for CAs (date, time range, booking status)

### Service Relationships

- Clients create ServiceRequests assigned to specific CAs
- Messages are exchanged within the context of a ServiceRequest
- Payments are processed for completed ServiceRequests
- Reviews link Client → CA → ServiceRequest for accountability

## Development Commands

### Docker Environment

Start all services (recommended for development):
```bash
docker-compose up -d
```

Stop all services:
```bash
docker-compose down
```

View logs:
```bash
docker-compose logs -f [service-name]  # backend, frontend, postgres, pgadmin
```

### Backend Development

The backend runs in a container with hot-reload enabled via `npm run dev`.

Access backend shell:
```bash
docker exec -it ca_backend sh
```

Prisma commands (run inside backend container or directory):
```bash
npx prisma migrate dev        # Create and apply migrations
npx prisma migrate reset      # Reset database and reapply migrations
npx prisma studio            # Open Prisma Studio GUI
npx prisma generate          # Generate Prisma Client
```

### Frontend Development

The frontend runs with hot-reload. Changes to files in `./frontend` are automatically reflected.

Access frontend shell:
```bash
docker exec -it ca_frontend sh
```

### Database Access

**Connection Details:**
- Host: localhost
- Port: 54320 (external), 5432 (internal Docker network)
- Database: camarketplace
- User: caadmin
- Password: CaSecure123!

**PGAdmin Access:**
- URL: http://localhost:5051
- Email: admin@caplatform.com
- Password: admin123

**Database Initialization:**
Scripts in `./database-scripts/` are automatically run on first container startup via PostgreSQL's `docker-entrypoint-initdb.d` mechanism.

## Environment Configuration

### Backend Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `NODE_ENV`: development/production
- `JWT_SECRET`: Token signing key (must be changed for production)

### Frontend Environment Variables
- `REACT_APP_API_URL`: Backend API endpoint (http://localhost:8081/api)

## Project Structure

```
ca-marketplace/
├── backend/           # Express + TypeScript + Prisma API
├── frontend/          # React application
├── database-scripts/  # SQL initialization scripts (run on first DB startup)
├── docker/            # Docker-related configurations
└── docker-compose.yml # Multi-service orchestration
```

## Development Workflow

1. Initialize database schema using Prisma migrations in the backend
2. Backend API automatically connects to PostgreSQL via DATABASE_URL
3. Frontend connects to backend via REACT_APP_API_URL
4. All services communicate within Docker network
5. Code changes in mounted volumes trigger hot-reload (backend via nodemon, frontend via React dev server)
