import { prisma } from '../config';
import { ServiceType } from '@prisma/client';

interface PlatformConfigUpdate {
  // Platform Fees
  individualPlatformFeePercent?: number;
  firmPlatformFeePercent?: number;

  // Service Types
  enabledServiceTypes?: ServiceType[];

  // Verification Rules
  autoVerifyCAAfterDays?: number;
  requireDocumentUpload?: boolean;
  minimumExperienceYears?: number;
  requirePhoneVerification?: boolean;
  requireEmailVerification?: boolean;

  // Payment & Escrow Settings
  escrowAutoReleaseDays?: number;
  allowInstantPayments?: boolean;
  minimumPaymentAmount?: number;
  maximumPaymentAmount?: number | null;

  // Refund Settings
  allowClientRefunds?: boolean;
  refundProcessingDays?: number;
  partialRefundMinPercent?: number;
  partialRefundMaxPercent?: number;

  // Dispute Settings
  disputeAutoCloseDays?: number;
  requireDisputeEvidence?: boolean;
  allowCAResponse?: boolean;

  // Business Rules
  maxActiveRequestsPerClient?: number;
  maxActiveRequestsPerCA?: number;
  requestCancellationHours?: number;

  // Maintenance
  isMaintenanceMode?: boolean;
  maintenanceMessage?: string | null;

  // Metadata
  updatedBy?: string;
}

class PlatformConfigService {
  /**
   * Get platform configuration (singleton)
   * Creates default if doesn't exist
   */
  static async getConfig() {
    let config = await prisma.platformConfig.findFirst();

    if (!config) {
      // Create default configuration
      config = await prisma.platformConfig.create({
        data: {
          individualPlatformFeePercent: 10.0,
          firmPlatformFeePercent: 15.0,
          enabledServiceTypes: [
            ServiceType.GST_FILING,
            ServiceType.INCOME_TAX_RETURN,
            ServiceType.AUDIT,
            ServiceType.ACCOUNTING,
          ],
          autoVerifyCAAfterDays: 0,
          requireDocumentUpload: true,
          minimumExperienceYears: 0,
          requirePhoneVerification: true,
          requireEmailVerification: true,
          escrowAutoReleaseDays: 7,
          allowInstantPayments: false,
          minimumPaymentAmount: 100.0,
          maximumPaymentAmount: null,
          allowClientRefunds: true,
          refundProcessingDays: 5,
          partialRefundMinPercent: 10.0,
          partialRefundMaxPercent: 90.0,
          disputeAutoCloseDays: 30,
          requireDisputeEvidence: true,
          allowCAResponse: true,
          maxActiveRequestsPerClient: 10,
          maxActiveRequestsPerCA: 15,
          requestCancellationHours: 24,
          isMaintenanceMode: false,
          maintenanceMessage: null,
        },
      });
    }

    return config;
  }

  /**
   * Update platform configuration
   */
  static async updateConfig(updates: PlatformConfigUpdate) {
    // Get existing config or create default
    let config = await this.getConfig();

    // Validate updates
    this.validateConfig(updates);

    // Update configuration
    const updatedConfig = await prisma.platformConfig.update({
      where: { id: config.id },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });

    return updatedConfig;
  }

  /**
   * Validate configuration values
   */
  private static validateConfig(config: PlatformConfigUpdate) {
    // Validate fee percentages
    if (
      config.individualPlatformFeePercent !== undefined &&
      (config.individualPlatformFeePercent < 0 || config.individualPlatformFeePercent > 100)
    ) {
      throw new Error('Individual platform fee must be between 0 and 100');
    }

    if (
      config.firmPlatformFeePercent !== undefined &&
      (config.firmPlatformFeePercent < 0 || config.firmPlatformFeePercent > 100)
    ) {
      throw new Error('Firm platform fee must be between 0 and 100');
    }

    // Validate refund percentages
    if (
      config.partialRefundMinPercent !== undefined &&
      (config.partialRefundMinPercent < 0 || config.partialRefundMinPercent > 100)
    ) {
      throw new Error('Partial refund min percent must be between 0 and 100');
    }

    if (
      config.partialRefundMaxPercent !== undefined &&
      (config.partialRefundMaxPercent < 0 || config.partialRefundMaxPercent > 100)
    ) {
      throw new Error('Partial refund max percent must be between 0 and 100');
    }

    if (
      config.partialRefundMinPercent !== undefined &&
      config.partialRefundMaxPercent !== undefined &&
      config.partialRefundMinPercent > config.partialRefundMaxPercent
    ) {
      throw new Error('Partial refund min percent cannot exceed max percent');
    }

    // Validate payment amounts
    if (config.minimumPaymentAmount !== undefined && config.minimumPaymentAmount < 0) {
      throw new Error('Minimum payment amount must be non-negative');
    }

    if (
      config.maximumPaymentAmount !== undefined &&
      config.maximumPaymentAmount !== null &&
      config.maximumPaymentAmount < 0
    ) {
      throw new Error('Maximum payment amount must be non-negative');
    }

    if (
      config.minimumPaymentAmount !== undefined &&
      config.maximumPaymentAmount !== undefined &&
      config.maximumPaymentAmount !== null &&
      config.minimumPaymentAmount > config.maximumPaymentAmount
    ) {
      throw new Error('Minimum payment amount cannot exceed maximum payment amount');
    }

    // Validate positive integers
    const positiveIntFields = [
      'autoVerifyCAAfterDays',
      'minimumExperienceYears',
      'escrowAutoReleaseDays',
      'refundProcessingDays',
      'disputeAutoCloseDays',
      'maxActiveRequestsPerClient',
      'maxActiveRequestsPerCA',
      'requestCancellationHours',
    ];

    positiveIntFields.forEach(field => {
      const value = (config as any)[field];
      if (value !== undefined && (value < 0 || !Number.isInteger(value))) {
        throw new Error(`${field} must be a non-negative integer`);
      }
    });

    // Validate service types
    if (config.enabledServiceTypes && config.enabledServiceTypes.length === 0) {
      throw new Error('At least one service type must be enabled');
    }
  }

  /**
   * Enable maintenance mode
   */
  static async enableMaintenanceMode(message: string, adminId: string) {
    const config = await this.getConfig();

    return await prisma.platformConfig.update({
      where: { id: config.id },
      data: {
        isMaintenanceMode: true,
        maintenanceMessage: message,
        updatedBy: adminId,
      },
    });
  }

  /**
   * Disable maintenance mode
   */
  static async disableMaintenanceMode(adminId: string) {
    const config = await this.getConfig();

    return await prisma.platformConfig.update({
      where: { id: config.id },
      data: {
        isMaintenanceMode: false,
        maintenanceMessage: null,
        updatedBy: adminId,
      },
    });
  }

  /**
   * Get service types configuration
   */
  static async getServiceTypes() {
    const config = await this.getConfig();
    return config.enabledServiceTypes;
  }

  /**
   * Get fee configuration
   */
  static async getFeeConfig() {
    const config = await this.getConfig();
    return {
      individualPlatformFeePercent: config.individualPlatformFeePercent,
      firmPlatformFeePercent: config.firmPlatformFeePercent,
    };
  }

  /**
   * Check if platform is in maintenance mode
   */
  static async isMaintenanceMode() {
    const config = await this.getConfig();
    return {
      isMaintenanceMode: config.isMaintenanceMode,
      maintenanceMessage: config.maintenanceMessage,
    };
  }
}

export default PlatformConfigService;
