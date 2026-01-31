// ***********************************************************
// This file is processed and loaded automatically before your test files.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Hide fetch/XHR requests in command log for cleaner output
const app = window.top;

if (!app.document.head.querySelector('[data-hide-command-log-request]')) {
  const style = app.document.createElement('style');
  style.innerHTML =
    '.command-name-request, .command-name-xhr { display: none }';
  style.setAttribute('data-hide-command-log-request', '');
  app.document.head.appendChild(style);
}

// Preserve cookies between tests
Cypress.Cookies.debug(true);

// Ignore uncaught exceptions from the application
Cypress.on('uncaught:exception', (err, runnable) => {
  // Returning false here prevents Cypress from failing the test
  // Log the error but don't fail
  console.error('Uncaught exception:', err.message);
  return false;
});

// Add custom timestamp for logs
beforeEach(() => {
  cy.log(`Starting test: ${Cypress.currentTest.title}`);
});

afterEach(() => {
  cy.log(`Completed test: ${Cypress.currentTest.title}`);
});
