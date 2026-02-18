/**
 * Unit Tests for routes/index.ts
 *
 * Verifies that registerRoutes mounts all expected route prefixes
 * without requiring a live database or external services.
 */

import express, { Express } from 'express';
import request from 'supertest';

// ─── Mock all route modules ───────────────────────────────────────────────────
// jest.mock calls are hoisted so each must be declared individually.
// Each mock returns a minimal Express router that responds 200 to GET /.

jest.mock('../../../src/routes/auth.routes.secure', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/user.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/ca.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/serviceRequest.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/request.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/message.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/review.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/payment.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/refund.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/availability.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/admin.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/monitoring.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/error-management.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/security-audit.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/analytics.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/reports.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/experiments.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/feature-flags.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/firm.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/firm-registration.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/firm-membership.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/firm-document.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/firm-assignment.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/firm-payment.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/independent-work.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/payment-distribution.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/provider.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/admin-firm-analytics.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/firm-review.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/notification.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/dashboard.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/advanced-search.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/email-template.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/dispute.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});
jest.mock('../../../src/routes/platform-config.routes', () => {
  const express = jest.requireActual('express');
  const r = express.Router();
  r.get('/', (_req: any, res: any) => res.sendStatus(200));
  return r;
});

// ─── Mock shared dependencies ─────────────────────────────────────────────────
jest.mock('../../../src/config', () => ({
  prisma: {
    client: { findUnique: jest.fn().mockResolvedValue(null) },
    charteredAccountant: { findUnique: jest.fn().mockResolvedValue(null) },
    serviceRequest: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  },
}));

jest.mock('../../../src/middleware', () => ({
  asyncHandler: (fn: Function) => fn,
  authenticate: jest.fn((_req: any, _res: any, next: Function) => next()),
  authorize: jest.fn(() => (_req: any, _res: any, next: Function) => next()),
}));

jest.mock('../../../src/utils', () => ({
  sendSuccess: jest.fn((res: any, data: any) => res.json({ success: true, data })),
  sendError: jest.fn((res: any, msg: string, code: number) => res.status(code).json({ error: msg })),
  parsePaginationParams: jest.fn().mockReturnValue({ skip: 0, take: 10 }),
  createPaginationResponse: jest.fn().mockReturnValue({ items: [], total: 0 }),
}));

jest.mock('../../../src/controllers/csp-report.controller', () => ({
  handleCspReport: jest.fn((_req: any, res: any) => res.sendStatus(204)),
}));

// ─── Subject under test ───────────────────────────────────────────────────────
import { registerRoutes } from '../../../src/routes/index';

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('registerRoutes', () => {
  let app: Express;

  beforeEach(() => {
    // resetMocks: true in jest.config wipes jest.fn() implementations before each test.
    // Re-apply implementations here so they are available when registerRoutes() runs.
    const middleware = require('../../../src/middleware');
    middleware.authenticate.mockImplementation((req: any, _res: any, next: Function) => {
      req.user = { userId: 'test-user-id', role: 'CLIENT' };
      next();
    });
    middleware.authorize.mockImplementation(() => (_req: any, _res: any, next: Function) => next());

    const utils = require('../../../src/utils');
    utils.sendSuccess.mockImplementation((res: any, data: any) => res.json({ success: true, data }));
    utils.sendError.mockImplementation((res: any, msg: string, code: number) => res.status(code).json({ error: msg }));
    utils.parsePaginationParams.mockReturnValue({ skip: 0, take: 10 });
    utils.createPaginationResponse.mockReturnValue({ items: [], total: 0 });

    const { handleCspReport } = require('../../../src/controllers/csp-report.controller');
    handleCspReport.mockImplementation((_req: any, res: any) => res.sendStatus(204));

    app = express();
    app.use(express.json());
    registerRoutes(app);
    // Catch unhandled errors so supertest receives a response instead of timing out
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(500).json({ error: err.message });
    });
  });

  // ── Static route mounting ──────────────────────────────────────────────────
  describe('route mounting', () => {
    const routes: Array<[string, string]> = [
      ['get', '/api/auth/'],
      ['get', '/api/users/'],
      ['get', '/api/cas/'],
      ['get', '/api/service-requests/'],
      ['get', '/api/requests/'],
      ['get', '/api/messages/'],
      ['get', '/api/reviews/'],
      ['get', '/api/payments/'],
      ['get', '/api/refunds/'],
      ['get', '/api/availability/'],
      ['get', '/api/admin/'],
      ['get', '/api/monitoring/'],
      ['get', '/api/error-management/'],
      ['get', '/api/admin/security/'],
      ['get', '/api/admin/analytics/'],
      ['get', '/api/admin/reports/'],
      ['get', '/api/admin/firm-analytics/'],
      ['get', '/api/admin/experiments/'],
      ['get', '/api/experiments/'],
      ['get', '/api/admin/feature-flags/'],
      ['get', '/api/feature-flags/'],
      ['get', '/api/firms/'],
      ['get', '/api/firm-invitations/'],
      ['get', '/api/firm-memberships/'],
      ['get', '/api/firm-documents/'],
      ['get', '/api/firm-assignments/'],
      ['get', '/api/firm-payments/'],
      ['get', '/api/independent-work-requests/'],
      ['get', '/api/firm-reviews/'],
      ['get', '/api/providers/'],
      ['get', '/api/notifications/'],
      ['get', '/api/dashboard/'],
      ['get', '/api/search/'],
      ['get', '/api/email-templates/'],
      ['get', '/api/disputes/'],
      ['get', '/api/admin/platform-settings/'],
      ['get', '/api/platform-settings/'],
    ];

    it.each(routes)('%s %s is mounted (not 404)', async (method, path) => {
      const res = await (request(app) as any)[method](path);
      expect(res.status).not.toBe(404);
    });
  });

  // ── Inline client/CA request routes ───────────────────────────────────────
  describe('inline routes', () => {
    it('GET /api/client/requests returns 404 when client profile not found', async () => {
      const res = await request(app).get('/api/client/requests');
      expect(res.status).toBe(404);
    });

    it('GET /api/ca/requests returns 404 when CA profile not found', async () => {
      const res = await request(app).get('/api/ca/requests');
      expect(res.status).toBe(404);
    });

    it('GET /api/client/requests returns 200 when client exists', async () => {
      const { prisma } = require('../../../src/config');
      (prisma.client.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'client-1' });

      const res = await request(app).get('/api/client/requests?page=1&limit=5');
      expect(res.status).toBe(200);
    });

    it('GET /api/ca/requests returns 200 when CA exists', async () => {
      const { prisma } = require('../../../src/config');
      (prisma.charteredAccountant.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'ca-1' });

      const res = await request(app).get('/api/ca/requests');
      expect(res.status).toBe(200);
    });
  });

  // ── Query parameter filtering on inline routes ─────────────────────────────
  describe('query parameter handling', () => {
    it('passes status filter into where clause for client requests', async () => {
      const { prisma } = require('../../../src/config');
      (prisma.client.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'client-1' });

      await request(app).get('/api/client/requests?status=PENDING');

      expect(prisma.serviceRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING', clientId: 'client-1' }),
        })
      );
    });

    it('passes status filter into where clause for CA requests', async () => {
      const { prisma } = require('../../../src/config');
      (prisma.charteredAccountant.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'ca-1' });

      await request(app).get('/api/ca/requests?status=IN_PROGRESS');

      expect(prisma.serviceRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'IN_PROGRESS', caId: 'ca-1' }),
        })
      );
    });

    it('omits status from where clause when not provided', async () => {
      const { prisma } = require('../../../src/config');
      (prisma.client.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'client-1' });

      await request(app).get('/api/client/requests');

      expect(prisma.serviceRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clientId: 'client-1' },
        })
      );
    });
  });

  // ── CSP report ─────────────────────────────────────────────────────────────
  describe('CSP report endpoint', () => {
    it('POST /api/csp-report is reachable', async () => {
      const res = await request(app)
        .post('/api/csp-report')
        .set('Content-Type', 'application/json')
        .send({ 'csp-report': {} });
      expect(res.status).not.toBe(404);
    });
  });

  // ── Disabled routes ────────────────────────────────────────────────────────
  describe('disabled routes', () => {
    it('GET /api/escrow/ returns 404 (route is commented out)', async () => {
      const res = await request(app).get('/api/escrow/');
      expect(res.status).toBe(404);
    });

    it('GET /api/assignments/ returns 404 (hybrid assignment route disabled)', async () => {
      const res = await request(app).get('/api/assignments/');
      expect(res.status).toBe(404);
    });
  });
});
