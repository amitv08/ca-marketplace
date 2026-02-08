import { Router, Request, Response } from 'express';
import { asyncHandler, authenticate, authorize } from '../middleware';
import { sendSuccess, sendError } from '../utils';
import PlatformConfigService from '../services/platform-config.service';
import { ServiceType } from '@prisma/client';

const router = Router();

/**
 * @route   GET /api/admin/platform-settings
 * @desc    Get platform configuration
 * @access  ADMIN, SUPER_ADMIN
 */
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const config = await PlatformConfigService.getConfig();
    sendSuccess(res, config);
  })
);

/**
 * @route   PUT /api/admin/platform-settings
 * @desc    Update platform configuration
 * @access  ADMIN, SUPER_ADMIN
 */
router.put(
  '/',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      individualPlatformFeePercent,
      firmPlatformFeePercent,
      enabledServiceTypes,
      autoVerifyCAAfterDays,
      requireDocumentUpload,
      minimumExperienceYears,
      requirePhoneVerification,
      requireEmailVerification,
      escrowAutoReleaseDays,
      allowInstantPayments,
      minimumPaymentAmount,
      maximumPaymentAmount,
      allowClientRefunds,
      refundProcessingDays,
      partialRefundMinPercent,
      partialRefundMaxPercent,
      disputeAutoCloseDays,
      requireDisputeEvidence,
      allowCAResponse,
      maxActiveRequestsPerClient,
      maxActiveRequestsPerCA,
      requestCancellationHours,
      isMaintenanceMode,
      maintenanceMessage,
    } = req.body;

    try {
      const updatedConfig = await PlatformConfigService.updateConfig({
        individualPlatformFeePercent,
        firmPlatformFeePercent,
        enabledServiceTypes: enabledServiceTypes as ServiceType[],
        autoVerifyCAAfterDays,
        requireDocumentUpload,
        minimumExperienceYears,
        requirePhoneVerification,
        requireEmailVerification,
        escrowAutoReleaseDays,
        allowInstantPayments,
        minimumPaymentAmount,
        maximumPaymentAmount,
        allowClientRefunds,
        refundProcessingDays,
        partialRefundMinPercent,
        partialRefundMaxPercent,
        disputeAutoCloseDays,
        requireDisputeEvidence,
        allowCAResponse,
        maxActiveRequestsPerClient,
        maxActiveRequestsPerCA,
        requestCancellationHours,
        isMaintenanceMode,
        maintenanceMessage,
        updatedBy: req.user!.userId,
      });

      sendSuccess(res, updatedConfig, 'Platform settings updated successfully');
    } catch (error: any) {
      return sendError(res, error.message || 'Failed to update platform settings', 400);
    }
  })
);

/**
 * @route   GET /api/platform-settings/public
 * @desc    Get public platform settings (for maintenance check, service types, etc.)
 * @access  PUBLIC
 */
router.get(
  '/public',
  asyncHandler(async (req: Request, res: Response) => {
    const maintenanceStatus = await PlatformConfigService.isMaintenanceMode();
    const serviceTypes = await PlatformConfigService.getServiceTypes();
    const feeConfig = await PlatformConfigService.getFeeConfig();

    sendSuccess(res, {
      maintenance: maintenanceStatus,
      serviceTypes,
      fees: feeConfig,
    });
  })
);

/**
 * @route   POST /api/admin/platform-settings/maintenance/enable
 * @desc    Enable maintenance mode
 * @access  SUPER_ADMIN
 */
router.post(
  '/maintenance/enable',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const { message } = req.body;

    if (!message || message.trim().length < 10) {
      return sendError(res, 'Maintenance message must be at least 10 characters', 400);
    }

    const config = await PlatformConfigService.enableMaintenanceMode(
      message,
      req.user!.userId
    );

    sendSuccess(res, config, 'Maintenance mode enabled');
  })
);

/**
 * @route   POST /api/admin/platform-settings/maintenance/disable
 * @desc    Disable maintenance mode
 * @access  SUPER_ADMIN
 */
router.post(
  '/maintenance/disable',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req: Request, res: Response) => {
    const config = await PlatformConfigService.disableMaintenanceMode(req.user!.userId);

    sendSuccess(res, config, 'Maintenance mode disabled');
  })
);

/**
 * @route   GET /api/platform-settings/fees
 * @desc    Get platform fee configuration (public)
 * @access  PUBLIC
 */
router.get(
  '/fees',
  asyncHandler(async (req: Request, res: Response) => {
    const feeConfig = await PlatformConfigService.getFeeConfig();
    sendSuccess(res, feeConfig);
  })
);

/**
 * @route   GET /api/platform-settings/service-types
 * @desc    Get enabled service types (public)
 * @access  PUBLIC
 */
router.get(
  '/service-types',
  asyncHandler(async (req: Request, res: Response) => {
    const serviceTypes = await PlatformConfigService.getServiceTypes();
    sendSuccess(res, serviceTypes);
  })
);

export default router;
