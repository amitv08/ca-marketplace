/**
 * Test Data Factories Index
 * Central export for all test data factories
 */

const soloPractitioner = require('./solo-practitioner.factory');
const smallFirm = require('./small-firm.factory');
const mediumFirm = require('./medium-firm.factory');
const largeFirm = require('./large-firm.factory');

module.exports = {
  // Solo Practitioner
  createSoloPractitioner: soloPractitioner.createSoloPractitioner,
  createMultipleSoloPractitioners: soloPractitioner.createMultipleSoloPractitioners,
  deleteSoloPractitioner: soloPractitioner.deleteSoloPractitioner,

  // Small Firm (3 members)
  createSmallFirm: smallFirm.createSmallFirm,
  deleteSmallFirm: smallFirm.deleteSmallFirm,

  // Medium Firm (15 members)
  createMediumFirm: mediumFirm.createMediumFirm,
  deleteMediumFirm: mediumFirm.deleteMediumFirm,

  // Large Firm (50+ members)
  createLargeFirm: largeFirm.createLargeFirm,
  createMultipleLargeFirms: largeFirm.createMultipleLargeFirms,
  deleteLargeFirm: largeFirm.deleteLargeFirm
};
