FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma Client (requires DATABASE_URL even though it doesn't connect)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate

# Copy source code
COPY . .

# Expose port
EXPOSE 5000

# Start the application in development mode
CMD ["npm", "run", "dev"]
