# CA Marketplace Frontend

React-based frontend application for the Chartered Accountant Marketplace platform.

## Tech Stack

- **Framework**: React 19
- **Language**: TypeScript
- **HTTP Client**: Axios
- **Routing**: React Router DOM
- **Build Tool**: React Scripts (Create React App)

## Getting Started

### Using Docker (Recommended)

From the project root directory:

```bash
# Start all services including frontend
docker-compose up -d

# View frontend logs
docker-compose logs -f frontend

# Access frontend container shell
docker exec -it ca_frontend sh
```

The frontend will be available at `http://localhost:3000`

### Local Development

If running locally without Docker:

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test
```

## Environment Variables

The frontend uses the following environment variables:

- `REACT_APP_API_URL`: Backend API endpoint (default: http://localhost:5000/api)

Create a `.env.local` file for local overrides:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

## Project Structure

```
frontend/
├── public/
│   └── index.html       # HTML template
├── src/
│   ├── index.tsx        # Application entry point
│   ├── App.tsx          # Main App component
│   ├── App.css          # App styles
│   ├── index.css        # Global styles
│   └── react-app-env.d.ts
├── Dockerfile           # Docker configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies and scripts
```

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm build` - Builds the app for production
- `npm test` - Runs the test suite
- `npm eject` - Ejects from Create React App (one-way operation)

## Features

The application will include:

- User authentication (Client, CA, Admin)
- Client dashboard for managing service requests
- CA dashboard for managing availability and requests
- Real-time messaging system
- Payment integration
- Review and rating system
- Profile management

## Development

The application uses:
- **TypeScript strict mode** for type safety
- **React 19** with the latest features
- **Functional components** with hooks
- **CSS** for styling (can be extended with CSS-in-JS or Tailwind)

## API Integration

The frontend communicates with the backend API at the URL specified in `REACT_APP_API_URL`.

Example API call:
```typescript
const response = await fetch(`${process.env.REACT_APP_API_URL}/endpoint`);
const data = await response.json();
```

## Building for Production

```bash
npm run build
```

This creates an optimized production build in the `build/` directory.
