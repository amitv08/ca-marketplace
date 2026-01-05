# Backend Architecture

This document describes the architecture and structure of the CA Marketplace backend API.

## Project Structure

```
backend/src/
├── server.ts              # Main entry point
├── config/                # Configuration modules
│   ├── env.ts            # Environment variables management
│   ├── database.ts       # Prisma client & database connections
│   ├── cors.ts           # CORS configuration
│   └── index.ts          # Barrel export
├── middleware/            # Express middleware
│   ├── auth.ts           # JWT authentication & authorization
│   ├── errorHandler.ts   # Error handling & async wrapper
│   ├── validator.ts      # Request validation
│   └── index.ts          # Barrel export
└── utils/                 # Utility functions
    ├── constants.ts      # Application constants & enums
    ├── helpers.ts        # Helper functions (password, pagination, etc.)
    ├── response.ts       # Standardized API responses
    └── index.ts          # Barrel export
```

## Architecture Patterns

### 1. Configuration Layer (`config/`)

**Purpose**: Centralized configuration management

- **env.ts**: Environment variable validation and type-safe access
- **database.ts**: Prisma client singleton with connection management
- **cors.ts**: CORS configuration for API security

**Example Usage**:
```typescript
import { env, prisma, corsOptions } from './config';
```

### 2. Middleware Layer (`middleware/`)

**Purpose**: Request/response processing pipeline

#### Error Handler (`errorHandler.ts`)
- Global error handling middleware
- Prisma error transformation
- 404 handler for unknown routes
- `asyncHandler` wrapper for async route handlers
- Development vs. production error responses

**Key Features**:
- Custom `AppError` class for operational errors
- Automatic Prisma error code translation
- Stack trace in development mode only

#### Authentication (`auth.ts`)
- JWT-based authentication
- Role-based authorization
- Token generation and verification helpers

**Available Middleware**:
- `authenticate`: Verify JWT token
- `authorize(...roles)`: Check user roles
- `generateToken(payload)`: Create JWT
- `verifyToken(token)`: Validate JWT

**Example Usage**:
```typescript
router.get('/profile', authenticate, getProfile);
router.delete('/users/:id', authenticate, authorize('ADMIN'), deleteUser);
```

#### Validator (`validator.ts`)
- Request body validation
- Schema-based validation rules
- Type checking, min/max constraints, regex patterns
- Custom validation functions

**Example Usage**:
```typescript
const loginSchema = {
  email: { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  password: { required: true, type: 'string', min: 8 },
};

router.post('/login', validateBody(loginSchema), login);
```

### 3. Utils Layer (`utils/`)

**Purpose**: Reusable utility functions and constants

#### Constants (`constants.ts`)
Defines all application-level constants:
- User roles (CLIENT, CA, ADMIN)
- Service types and statuses
- Payment methods and statuses
- Verification statuses
- API messages
- Pagination defaults

#### Helpers (`helpers.ts`)
Common utility functions:
- Password hashing and comparison
- Pagination helpers
- Data sanitization
- UUID validation
- Object manipulation (pick, omit)
- Rating calculations

#### Response (`response.ts`)
Standardized API response helpers:
- `sendSuccess(res, data, message, statusCode)`
- `sendCreated(res, data, message)`
- `sendError(res, message, statusCode, details)`
- `sendNotFound(res, message)`
- `sendUnauthorized(res, message)`
- `sendForbidden(res, message)`
- `sendBadRequest(res, message, details)`

**All responses follow this structure**:
```typescript
{
  success: boolean,
  data?: any,
  message?: string,
  error?: {
    message: string,
    details?: any
  }
}
```

### 4. Server Entry Point (`server.ts`)

**Purpose**: Application initialization and configuration

**Responsibilities**:
1. Initialize Express application
2. Configure middleware (CORS, JSON parsing, logging)
3. Define health check and API info endpoints
4. Mount API routes (to be added)
5. Register error handlers (404, global error handler)
6. Database connection management
7. Graceful shutdown handling

**Startup Flow**:
1. Load environment variables
2. Connect to PostgreSQL database
3. Start Express server on configured port
4. Register shutdown handlers (SIGINT, SIGTERM)

## API Standards

### Request Flow

1. **Request arrives** → CORS check
2. **Body parsing** → JSON/URL-encoded
3. **Route matching** → Find handler
4. **Authentication** (if required) → Verify JWT
5. **Authorization** (if required) → Check roles
6. **Validation** (if required) → Validate request body
7. **Business logic** → Route handler
8. **Response** → Standardized format
9. **Error handling** → Catch and format errors

### Response Format

**Success Response**:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "details": { ... }  // Optional, dev mode only
  }
}
```

### Error Handling

All route handlers should use `asyncHandler` wrapper:

```typescript
import { asyncHandler } from './middleware';

export const getUsers = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany();
  sendSuccess(res, users);
});
```

Errors are automatically caught and formatted by the global error handler.

## Environment Variables

Required environment variables (see `.env.example`):

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT signing
- `JWT_EXPIRES_IN`: Token expiration time (e.g., "7d")
- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment (development/production/test)
- `CORS_ORIGIN`: Allowed CORS origin

## Database Access

Use the Prisma client singleton:

```typescript
import { prisma } from './config';

// Query example
const users = await prisma.user.findMany({
  where: { role: 'CLIENT' },
  include: { client: true },
});
```

## Adding New Features

### 1. Create a Route Handler

```typescript
// src/routes/users.ts
import { Router } from 'express';
import { asyncHandler, authenticate } from '../middleware';
import { sendSuccess } from '../utils';
import { prisma } from '../config';

const router = Router();

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany();
  sendSuccess(res, users);
}));

export default router;
```

### 2. Register Route in server.ts

```typescript
import userRoutes from './routes/users';

// ... existing code ...

app.use('/api/users', userRoutes);
```

### 3. Add Validation Schema

```typescript
const createUserSchema = {
  email: { required: true, type: 'string', custom: isValidEmail },
  password: { required: true, type: 'string', min: 8 },
  name: { required: true, type: 'string', min: 2, max: 100 },
};

router.post('/', validateBody(createUserSchema), createUser);
```

## Security Best Practices

1. **Authentication**: Always use `authenticate` middleware for protected routes
2. **Authorization**: Use `authorize(...roles)` to restrict access by role
3. **Validation**: Validate all user inputs with `validateBody`
4. **Password Hashing**: Use `hashPassword` helper, never store plain passwords
5. **Error Messages**: Don't leak sensitive information in error messages
6. **CORS**: Configure allowed origins properly
7. **Environment Variables**: Never commit `.env` files

## Development Workflow

1. **Make changes** to files in `src/`
2. **Nodemon auto-reloads** on file changes
3. **Check logs**: `docker-compose logs -f backend`
4. **Test endpoints**: Use curl, Postman, or the frontend

## Next Steps

1. Create route modules in `src/routes/`
2. Implement authentication endpoints (register, login)
3. Add CRUD operations for each entity
4. Implement business logic for service requests
5. Add file upload handling
6. Integrate payment gateway
7. Add API documentation (Swagger)

## Resources

- [Express Documentation](https://expressjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [JWT Documentation](https://jwt.io/)
