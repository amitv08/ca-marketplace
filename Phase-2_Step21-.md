# Navigate to backend folder
cd backend

# Initialize Node.js project
npm init -y

# Install dependencies
npm install express typescript ts-node prisma @prisma/client cors dotenv bcrypt jsonwebtoken
npm install -D @types/node @types/express @types/cors @types/bcrypt @types/jsonwebtoken nodemon

# Initialize TypeScript
npx tsc --init

# Initialize Prisma
npx prisma init