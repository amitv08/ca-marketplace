import { Router, Request, Response } from 'express';
import { authenticate, authorize, asyncHandler } from '../middleware';
import { EmailTemplateService } from '../services/email-template.service';
import { sendSuccess, sendError } from '../utils';

const router = Router();

/**
 * GET /api/email-templates
 * Get list of available email templates (Admin only)
 */
router.get('/', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const templates = EmailTemplateService.getAvailableTemplates();

  sendSuccess(res, {
    templates,
    count: templates.length,
  });
}));

/**
 * POST /api/email-templates/preview
 * Preview email template with sample data (Admin only)
 */
router.post('/preview', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { template, context } = req.body;

  if (!template) {
    return sendError(res, 'Template name is required', 400);
  }

  if (!context) {
    return sendError(res, 'Context data is required', 400);
  }

  try {
    const html = await EmailTemplateService.previewTemplate(template, context);

    sendSuccess(res, {
      template,
      html,
    });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to preview template', 400);
  }
}));

/**
 * POST /api/email-templates/send-test
 * Send test email (Admin only)
 */
router.post('/send-test', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { template, to, context } = req.body;

  if (!template || !to || !context) {
    return sendError(res, 'Template, recipient email, and context are required', 400);
  }

  try {
    const success = await EmailTemplateService.sendEmail({
      to,
      subject: `[TEST] ${context.subject || 'Test Email'}`,
      template,
      context,
    });

    if (success) {
      sendSuccess(res, {
        message: 'Test email sent successfully',
        to,
        template,
      });
    } else {
      sendError(res, 'Failed to send test email', 500);
    }
  } catch (error: any) {
    sendError(res, error.message || 'Failed to send test email', 500);
  }
}));

/**
 * POST /api/email-templates/clear-cache
 * Clear template cache (Admin only)
 */
router.post('/clear-cache', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  EmailTemplateService.clearTemplateCache();

  sendSuccess(res, {
    message: 'Template cache cleared successfully',
  });
}));

export default router;
