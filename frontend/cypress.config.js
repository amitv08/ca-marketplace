const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3001',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,

    // API configuration
    env: {
      apiUrl: 'http://localhost:8081/api',
      // Demo credentials — must match prisma/seed-e2e.ts
      clientEmail: 'client1@demo.com',
      clientPassword: 'Demo@123',
      caEmail: 'ca1@demo.com',
      caPassword: 'Demo@123',
      adminEmail: 'admin@caplatform.com',
      adminPassword: 'Admin@123!',
      firmAdminEmail: 'shahandassociates.1@demo.com',
      firmAdminPassword: 'Demo@123',
      // Alternative client with fewer pending requests
      client2Email: 'client5@demo.com',
      client2Password: 'Demo@123',
    },

    // Test retry configuration
    retries: {
      runMode: 2,
      openMode: 0,
    },

    // Timeouts
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,

    setupNodeEvents(on, config) {
      // implement node event listeners here
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
      });
    },

    // Spec pattern
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.js',
  },

  component: {
    devServer: {
      framework: 'react',
      bundler: 'webpack',
    },
  },
});
