# CA Marketplace Backend

Backend API for the Chartered Accountant Marketplace platform built with Node.js, Express, TypeScript, and Prisma.

## Tech Stack

- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL 15
- **Authentication**: JWT + bcrypt

## Getting Started

### Using Docker (Recommended)

From the project root directory:

```bash
# Start all services including backend
docker-compose up -d

# View backend logs
docker-compose logs -f backend

# Access backend container shell
docker exec -it ca_backend sh
```

The backend will be available at `http://localhost:5000`

### Local Development

If running locally without Docker:

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start development server
npm run dev
```

## Prisma Commands

```bash
# Generate Prisma Client (after schema changes)
npm run prisma:generate

# Create and apply a new migration
npm run prisma:migrate

# Open Prisma Studio (Database GUI)
npm run prisma:studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

## Project Structure

```
backend/
├── src/
│   ├── server.ts            # Express server entry point
│   ├── config/              # Configuration (env, database, cors)
│   ├── middleware/          # Middleware (auth, validation, error handling)
│   ├── utils/               # Utilities (constants, helpers, response)
│   └── routes/              # API routes (to be added)
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── migrations/          # Database migrations
├── dist/                    # Compiled TypeScript output
├── .env                     # Environment variables (not in git)
├── .env.example             # Example environment variables
├── tsconfig.json            # TypeScript configuration
├── nodemon.json             # Nodemon configuration
├── Dockerfile               # Docker configuration
├── ARCHITECTURE.md          # Architecture documentation
└── package.json             # Dependencies and scripts
```

## Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT token signing
- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment mode (development/production)

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Base API
- `GET /api` - API information

More endpoints will be added as development progresses.

## Database Schema

The application uses the following main models:

- **User**: Base user model with role-based access (CLIENT, CA, ADMIN)
- **Client**: Client-specific profile information
- **CharteredAccountant**: CA-specific profile with license, specializations, and verification
- **ServiceRequest**: Service requests from clients to CAs
- **Message**: Communication between users
- **Review**: Client reviews for completed services
- **Payment**: Transaction records
- **Availability**: CA availability schedule

See `prisma/schema.prisma` for complete schema details.

## Development

The application uses:
- **nodemon** for auto-reloading during development
- **ts-node** for running TypeScript directly
- **TypeScript strict mode** for type safety

## Building for Production

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```
