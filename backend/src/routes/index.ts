import { Express, Router, Request, Response } from 'express';
import authRoutes from './auth.routes.secure';
import userRoutes from './user.routes';
import caRoutes from './ca.routes';
import serviceRequestRoutes from './serviceRequest.routes';
import requestRoutes from './request.routes';
import messageRoutes from './message.routes';
import reviewRoutes from './review.routes';
import paymentRoutes from './payment.routes';
import availabilityRoutes from './availability.routes';
import adminRoutes from './admin.routes';
import monitoringRoutes from './monitoring.routes';
import errorManagementRoutes from './error-management.routes';
import securityAuditRoutes from './security-audit.routes';
import analyticsRoutes from './analytics.routes';
import reportsRoutes from './reports.routes';
import experimentsRoutes from './experiments.routes';
import featureFlagsRoutes from './feature-flags.routes';
import firmRoutes from './firm.routes';
import firmRegistrationRoutes from './firm-registration.routes';
import firmMembershipRoutes from './firm-membership.routes';
import firmDocumentRoutes from './firm-document.routes';
import firmAssignmentRoutes from './firm-assignment.routes';
import firmPaymentRoutes from './firm-payment.routes';
import hybridAssignmentRoutes from './hybrid-assignment.routes';
import independentWorkRoutes from './independent-work.routes';
// import firmReviewRoutes from './firm-review.routes'; // TODO: Fix FirmReview schema (review, isFlagged, flaggedAt fields)
import { handleCspReport } from '../controllers/csp-report.controller';
import { prisma } from '../config';
import { asyncHandler, authenticate, authorize } from '../middleware';
import { sendSuccess, sendError, parsePaginationParams, createPaginationResponse } from '../utils';

export const registerRoutes = (app: Express): void => {
  // Authentication routes
  app.use('/api/auth', authRoutes);

  // User routes
  app.use('/api/users', userRoutes);

  // CA routes (alias for /api/users/chartered-accountants)
  app.use('/api/cas', caRoutes);

  // Service request routes
  app.use('/api/service-requests', serviceRequestRoutes);

  // Request routes (Phase-5 spec)
  app.use('/api/requests', requestRoutes);

  // Client-specific request routes (Phase-5)
  const clientRequestRouter = Router();
  clientRequestRouter.get('/', authenticate, authorize('CLIENT'), asyncHandler(async (req: Request, res: Response) => {
    const { status, page, limit } = req.query;
    const { skip, take } = parsePaginationParams(page as string, limit as string);

    const client = await prisma.client.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!client) {
      return sendError(res, 'Client profile not found', 404);
    }

    const whereClause: any = {
      clientId: client.id,
    };

    if (status) {
      whereClause.status = status;
    }

    const [requests, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where: whereClause,
        skip,
        take,
        include: {
          ca: {
            include: {
              user: {
                select: {
                  name: true,
                  email: true,
                  phone: true,
                  profileImage: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.serviceRequest.count({ where: whereClause }),
    ]);

    const pageNum = parseInt(page as string || '1', 10);
    const limitNum = parseInt(limit as string || '10', 10);

    sendSuccess(res, createPaginationResponse(requests, total, pageNum, limitNum));
  }));
  app.use('/api/client/requests', clientRequestRouter);

  // CA-specific request routes (Phase-5)
  const caRequestRouter = Router();
  caRequestRouter.get('/', authenticate, authorize('CA'), asyncHandler(async (req: Request, res: Response) => {
    const { status, page, limit } = req.query;
    const { skip, take } = parsePaginationParams(page as string, limit as string);

    const ca = await prisma.charteredAccountant.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!ca) {
      return sendError(res, 'CA profile not found', 404);
    }

    const whereClause: any = {
      caId: ca.id,
    };

    if (status) {
      whereClause.status = status;
    }

    const [requests, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where: whereClause,
        skip,
        take,
        include: {
          client: {
            include: {
              user: {
                select: {
                  name: true,
                  email: true,
                  phone: true,
                  profileImage: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.serviceRequest.count({ where: whereClause }),
    ]);

    const pageNum = parseInt(page as string || '1', 10);
    const limitNum = parseInt(limit as string || '10', 10);

    sendSuccess(res, createPaginationResponse(requests, total, pageNum, limitNum));
  }));
  app.use('/api/ca/requests', caRequestRouter);

  // Message routes
  app.use('/api/messages', messageRoutes);

  // Review routes
  app.use('/api/reviews', reviewRoutes);

  // Payment routes
  app.use('/api/payments', paymentRoutes);

  // Availability routes
  app.use('/api/availability', availabilityRoutes);

  // Admin routes (protected)
  app.use('/api/admin', adminRoutes);

  // Monitoring routes
  app.use('/api/monitoring', monitoringRoutes);

  // Error management routes (admin only)
  app.use('/api/error-management', errorManagementRoutes);

  // Security audit routes (admin only)
  app.use('/api/admin/security', securityAuditRoutes);

  // Analytics routes (admin only)
  app.use('/api/admin/analytics', analyticsRoutes);

  // Reports routes (admin only)
  app.use('/api/admin/reports', reportsRoutes);

  // Experiments routes (admin for management, public for variant assignment)
  app.use('/api/admin/experiments', experimentsRoutes);
  app.use('/api/experiments', experimentsRoutes);

  // Feature flags routes (admin for management, public for checking)
  app.use('/api/admin/feature-flags', featureFlagsRoutes);
  app.use('/api/feature-flags', featureFlagsRoutes);

  // CA Firms routes
  app.use('/api/firms', firmRoutes);
  app.use('/api/firms', firmRegistrationRoutes); // Registration workflow routes
  app.use('/api/firm-invitations', firmRegistrationRoutes); // Invitation routes
  app.use('/api/firm-memberships', firmMembershipRoutes);
  app.use('/api/firm-documents', firmDocumentRoutes);
  app.use('/api/firm-assignments', firmAssignmentRoutes);
  app.use('/api/firm-payments', firmPaymentRoutes);
  app.use('/api/assignments', hybridAssignmentRoutes); // Hybrid assignment system
  app.use('/api/independent-work-requests', independentWorkRoutes); // Independent work management
  // app.use('/api/firm-reviews', firmReviewRoutes); // TODO: Fix schema

  // CSP report endpoint (public - called by browsers)
  app.post('/api/csp-report', handleCspReport);
};
