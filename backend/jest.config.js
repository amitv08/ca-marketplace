module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      isolatedModules: true,
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/__tests__/**',
    '!src/types/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 0.5,
      functions: 2,
      lines: 1,
      statements: 1,
    },
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,  // Required: prevents hanging from Redis/Prisma connections
  detectOpenHandles: false,  // Disabled: adds overhead and not needed with forceExit
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Note: The "Force exiting Jest" warning with forceExit: true is EXPECTED and harmless.
  // It simply means Jest is forcefully terminating instead of waiting for connections to close.
  // We minimize open handles via cleanup hooks, but some (Redis, Prisma internal pools)
  // are difficult to fully close, so forceExit is the pragmatic solution.
};
