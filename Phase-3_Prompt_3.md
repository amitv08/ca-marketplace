Create a basic Express.js server with TypeScript for the CA marketplace backend.

Structure:
- src/
  - server.ts (main entry point)
  - config/ (configuration)
  - middleware/ (auth, validation, error handling)
  - utils/ (helpers, constants)

Requirements:
1. Express server on port 5000
2. CORS enabled
3. JSON body parsing
4. Basic error handling middleware
5. Health check endpoint at /api/health
6. Connect to PostgreSQL using Prisma
7. Environment variables for DB connection and JWT secret

Create all necessary files with proper TypeScript types.